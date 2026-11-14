import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ApprovalAPI, LeaveAPI, getApiErrorMessage, type LeaveRequestDetail, type PendingApproval } from '../lib/api';
import { FileText, ArrowLeft, CheckCircle, XCircle, Clock, MessageCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ToastProvider';
import { useConfirm } from '../components/ConfirmDialog';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import { AttachmentPreviewModal } from '../components/AttachmentPreviewModal';
import { canRequestLeaveChange, leaveChangeDateIsOpen, leaveStatusLabel } from '../lib/statusFormat';
import { NotificationService } from '../services/notificationService';
import { approvalStageLabel } from '../lib/approvalLabels';
import { LeaveRequestConversation } from '../components/LeaveRequestConversation';
import { DialogOverlay } from '../components/ui/DialogOverlay';
import { calculateLeaveHours, WORK_START, WORK_END } from '../lib/leaveTime';
import { SickLeaveExtensionDialog } from '../components/SickLeaveExtensionDialog';

export const LeaveDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [request, setRequest] = useState<LeaveRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showApprovedCancel, setShowApprovedCancel] = useState(false);
  const [approvedCancelReason, setApprovedCancelReason] = useState('');
  const [cancellingApproved, setCancellingApproved] = useState(false);
  const [rescheduleData, setRescheduleData] = useState({ dateFrom: '', dateTo: '', reason: '' });
  const [rescheduleDays, setRescheduleDays] = useState<any[]>([]);
  const [rescheduleFiles, setRescheduleFiles] = useState<File[]>([]);
  const [holidayDates, setHolidayDates] = useState<Set<string>>(new Set());
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [revision, setRevision] = useState({ dateFrom: '', dateTo: '', reason: '', timeFrom: '07:00', timeTo: '12:00' });
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [expandedConversationStepId, setExpandedConversationStepId] = useState<number | null>(null);
  const [actionableApproval, setActionableApproval] = useState<PendingApproval | null>(null);
  const [decision, setDecision] = useState<'approve' | 'disapprove' | null>(null);
  const [decisionRemarks, setDecisionRemarks] = useState('');
  const [fitnessAssessment, setFitnessAssessment] = useState('');
  const [extensionOpen, setExtensionOpen] = useState(false);
  const [disapprovalReason, setDisapprovalReason] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [revisionFiles, setRevisionFiles] = useState<File[]>([]);
  const [isRevising, setIsRevising] = useState(false);
  const [conversationReload, setConversationReload] = useState(0);
  const [selectedAttachment, setSelectedAttachment] = useState<any | null>(null);
  const [attachmentBlobUrl, setAttachmentBlobUrl] = useState<string | null>(null);
  const [isViewingAttachment, setIsViewingAttachment] = useState(false);
  const loadVersion = useRef(0);

  const loadRequest = useCallback(async (requestId: number, showLoading = true) => {
    const version = ++loadVersion.current;
    if (showLoading) setLoading(true);
    try {
      const data = await LeaveAPI.getRequest(requestId);
      if (version !== loadVersion.current) return;
      setRequest(data);
      setError('');
      if (data.status === 'Approved' && !data.rescheduledToRequestId && canRequestLeaveChange(data.leaveType.code) && new URLSearchParams(window.location.search).get('action') === 'reschedule') {
        setRescheduleData({ dateFrom: data.dateFrom.slice(0, 10), dateTo: data.dateTo.slice(0, 10), reason: '' });
        setShowRescheduleModal(true);
      }
    } catch (e: any) {
      if (version === loadVersion.current && showLoading)
        setError(e.response?.data || 'Failed to load request details');
    } finally {
      if (version === loadVersion.current && showLoading) setLoading(false);
    }
  }, []);

  // Auto-calculate for reschedule
  useEffect(() => {
    if (showRescheduleModal) {
      LeaveAPI.getHolidays(new Date(rescheduleData.dateFrom || request?.dateFrom || Date.now()).getFullYear())
        .then(items => setHolidayDates(new Set(items.map(item => item.date.slice(0, 10)))))
        .catch(() => setHolidayDates(new Set()));
    }
  }, [showRescheduleModal, rescheduleData.dateFrom]);

  useEffect(() => {
    if (showRescheduleModal && rescheduleData.dateFrom && rescheduleData.dateTo) {
      const from = new Date(rescheduleData.dateFrom);
      const to = new Date(rescheduleData.dateTo);
      if (to >= from) {
        const generatedDays = [];
        for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
          const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          if (d.getDay() !== 0 && d.getDay() !== 6 && !holidayDates.has(localDate)) {
            generatedDays.push({
              date: localDate,
              hours: request?.leaveType.isHoursBased ? request.totalHours : 8,
              isPaid: true,
              halfDayTime: request?.leaveType.isHoursBased ? request.halfDayTime : undefined
            });
          }
        }
        setRescheduleDays(generatedDays);
      } else {
        setRescheduleDays([]);
      }
    }
  }, [rescheduleData.dateFrom, rescheduleData.dateTo, showRescheduleModal, holidayDates, request]);

  useEffect(() => {
    const requestId = Number(id);
    if (!Number.isInteger(requestId) || requestId <= 0) return;

    void loadRequest(requestId);
    const unsubscribe = NotificationService.subscribe(notification => {
      const isMatchingRequest = !notification
        || notification.leaveRequestId === requestId
        || (notification.entityType === 'LeaveRequest' && Number(notification.entityId) === requestId);
      if (isMatchingRequest) void loadRequest(requestId, false);
    });
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void loadRequest(requestId, false);
    };
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      loadVersion.current++;
      unsubscribe();
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [id, loadRequest]);

  useEffect(() => {
    setActionableApproval(null);
    setDecision(null);
    setFitnessAssessment('');
    if (!request || request.conversationAccess?.isEmployeeOwner || !request.conversationAccess?.canComment || request.status.toLowerCase() === 'pending employee details') return;
    let active = true;
    void ApprovalAPI.getPending()
      .then(items => { if (active) setActionableApproval(items.find(item => item.leaveRequestId === request.id) ?? null); })
      .catch(() => { if (active) setActionableApproval(null); });
    return () => { active = false; };
  }, [request?.id, request?.status, request?.dateTo, request?.conversationAccess?.canComment, request?.conversationAccess?.isEmployeeOwner, request?.approvalSteps?.find(step => step.action === 'Pending')?.id]);

  const submitDecision = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!request || !decision || !actionableApproval) return;
    setSubmittingDecision(true);
    try {
      if (decision === 'approve') await ApprovalAPI.approve(request.id, { remarks: decisionRemarks,
        fitnessAssessment: actionableApproval.stageKind === 'HR_REVIEW' ? fitnessAssessment : undefined,
        expectedDateTo: actionableApproval.stageKind === 'HR_REVIEW' ? actionableApproval.dateTo : undefined });
      else await ApprovalAPI.disapprove(request.id, { remarks: decisionRemarks, reasonForRejection: disapprovalReason });
      toast.success(decision === 'approve' ? 'Leave request approved.' : 'Leave request disapproved.');
      setDecision(null);
      setActionableApproval(null);
      await loadRequest(request.id, false);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'Could not process this decision. Please refresh the request.'));
      setActionableApproval(null);
      await loadRequest(request.id, false);
    } finally { setSubmittingDecision(false); }
  };

  const handleCancel = async () => {
    const confirmed = await confirm({
      title: 'Cancel Leave Request',
      message: 'Are you sure you want to cancel this leave request? This action cannot be undone.',
      confirmText: 'Yes, Cancel It',
      variant: 'danger'
    });
    if (!confirmed) return;
    try {
      await LeaveAPI.cancel(request!.id);
      toast.success('Leave request cancelled successfully');
      loadRequest(request!.id);
    } catch (e: any) {
      toast.error(e.response?.data || 'Failed to cancel request');
    }
  };

  const handleApprovedCancel = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!request || !approvedCancelReason.trim()) return;
    setCancellingApproved(true);
    try {
      const result = await LeaveAPI.requestCancellation(request.id, approvedCancelReason.trim());
      if (result.notificationsQueued) toast.success('Approved leave cancelled. Approvers have been notified.');
      else toast.info('Approved leave cancelled. An approver notification could not be queued; please contact HR.');
      setShowApprovedCancel(false);
      setApprovedCancelReason('');
      await loadRequest(request.id);
    } catch (error) { toast.error(getApiErrorMessage(error, 'Could not cancel approved leave.')); }
    finally { setCancellingApproved(false); }
  };

  const handleViewAttachment = async (a: any) => {
    try {
      setIsViewingAttachment(true);
      setSelectedAttachment(a);
      const token = sessionStorage.getItem('token');
      const res = await fetch(`/api/leave/attachments/${a.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load attachment');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      setAttachmentBlobUrl(url);
    } catch (e) {
      console.error(e);
      alert('Failed to view attachment. It may not exist on the server.');
      setIsViewingAttachment(false);
      setSelectedAttachment(null);
    }
  };

  const closeAttachmentModal = () => {
    setIsViewingAttachment(false);
    setTimeout(() => {
      if (attachmentBlobUrl) {
        window.URL.revokeObjectURL(attachmentBlobUrl);
      }
      setAttachmentBlobUrl(null);
      setSelectedAttachment(null);
    }, 300); // Wait for animation
  };

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;
  if (error) return <div className="alert alert-error m-6">{error}</div>;
  if (!request) return <div className="alert alert-error m-6">Request not found</div>;

  // HR is one shared stage; retain member rows only for authorization and audit.
  const timelineSteps = (request.approvalSteps ?? []).filter(step => {
    if (step.stageKind !== 'HR_REVIEW') return true;
    const members = request.approvalSteps!.filter(member => member.stageKind === 'HR_REVIEW'
      && (member.stageOrder ?? member.stepOrder) === (step.stageOrder ?? step.stepOrder));
    const representative = members.find(member => member.action === 'Approved' || member.action === 'Disapproved')
      ?? members.find(member => member.id === actionableApproval?.approvalStepId)
      ?? members.find(member => member.action === 'Pending') ?? members[0];
    return step === representative;
  });

  const isOwner = request.conversationAccess?.isEmployeeOwner ?? (user?.username === request.employee.employeeID);
  const isOriginalRequest = request.requestKind === 'Leave' || !request.requestKind;
  const canCancel = isOwner && isOriginalRequest && !['Approved', 'Disapproved', 'Cancelled', 'Rescheduled'].includes(request.status);
  const canReschedule = isOwner && isOriginalRequest && request.status === 'Approved' && !request.rescheduledToRequestId && canRequestLeaveChange(request.leaveType.code) && leaveChangeDateIsOpen(request.dateTo);
  const canCancelApproved = isOwner && isOriginalRequest && request.status === 'Approved' && (!request.rescheduledToRequestId || request.pendingChangeKind === 'Cancellation') && canRequestLeaveChange(request.leaveType.code) && leaveChangeDateIsOpen(request.dateTo);
  const canRevisePending = (request.conversationAccess?.canRevise ?? isOwner) && isOriginalRequest && request.status.toLowerCase() === 'pending employee details';

  const handleRescheduleDayUpdate = (index: number, field: string, value: any) => {
    const newDays = [...rescheduleDays];
    newDays[index] = { ...newDays[index], [field]: value };
    setRescheduleDays(newDays);
  };

  const submitReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRescheduling(true);
    try {
      await LeaveAPI.reschedule(request.id, {
        leaveTypeId: request.leaveType.id,
        dateFrom: rescheduleData.dateFrom,
        dateTo: rescheduleData.dateTo,
        totalHours: request.leaveType.isHoursBased ? request.totalHours : 0,
        halfDayTime: request.leaveType.isHoursBased ? request.halfDayTime : undefined,
        balanceDeductionLeaveTypeId: request.balanceDeductionLeaveType?.id,
        reason: rescheduleData.reason,
        days: rescheduleDays
      }, rescheduleFiles);
      toast.success('Rescheduling request submitted for approval.');
      setShowRescheduleModal(false);
      loadRequest(request.id);
    } catch (err: any) {
      toast.error(err.response?.data || 'Failed to reschedule');
    } finally {
      setIsRescheduling(false);
    }
  };

  const submitPendingRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRevising(true);
    try {
      const revisedHours = request.leaveType.isHoursBased ? calculateLeaveHours(revision.timeFrom, revision.timeTo) : 0;
      if (request.leaveType.isHoursBased && revisedHours <= 0) throw new Error('Select a valid work-time range between 7:00 AM and 5:35 PM.');
      const revisedRange = `${revision.timeFrom}-${revision.timeTo}`;
      const days = request.leaveType.isHoursBased ? [{ date: revision.dateFrom, hours: revisedHours, isPaid: request.leaveType.code.toUpperCase() !== 'UT', halfDayTime: revisedRange }] : undefined;
      await LeaveAPI.revisePending(request.id, { leaveTypeId: request.leaveType.id, dateFrom: revision.dateFrom, dateTo: revision.dateTo, totalHours: revisedHours, halfDayTime: request.leaveType.isHoursBased ? revisedRange : undefined, reason: revision.reason, days }, revisionFiles);
      toast.success('Revised leave request sent back to the approver.');
      setRevisionOpen(false);
      await loadRequest(request.id);
    } catch (err: any) { toast.error(err.response?.data?.message || err.response?.data || 'Could not revise leave request.'); }
    finally { setIsRevising(false); }
  };

  return (
    <div className="animate-fade-in leave-detail-page">
      <div className="page-header">
        <button className="btn btn-ghost mb-2" onClick={() => navigate(-1)} style={{ marginLeft: -8 }}>
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex items-center justify-between">
          <h1>Leave Request Details</h1>
          <span className="badge badge-info text-sm py-1 px-3" style={{ fontSize: '0.9rem' }}>
            {leaveStatusLabel(request.status, request.requestKind)}
          </span>
        </div>
      </div>

      <div className="page-body">
        <div className="form-row">
          <div className="glass-card" style={{ flex: 2 }}>
            <div className="glass-card-header">
              <h2><FileText size={18} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />Request Details</h2>
            </div>
            <div className="glass-card-body">
              <div className="form-row mb-6">
                <div>
                  <div className="text-xs text-muted uppercase tracking-wider mb-1">Employee</div>
                  <div className="font-bold text-lg">{request.employee.fullName}</div>
                  <div className="text-sm">{request.employee.position} — {request.employee.department}</div>
                </div>
                  <div>
                    <div className="text-xs text-muted uppercase tracking-wider mb-1">Leave Type</div>
                    <div className="font-bold text-lg text-primary">{request.leaveType.code}</div>
                    <div className="text-sm">{request.leaveType.description}</div>
                    {request.leaveType.code.toUpperCase() === 'HDL' && request.balanceDeductionLeaveType && <div className="text-sm mt-1">Deducted from: <strong>{request.balanceDeductionLeaveType.code} — {request.balanceDeductionLeaveType.description}</strong></div>}
                    {request.leaveType.code.toUpperCase() === 'UT' && <div className="text-sm mt-1 text-warning"><strong>Unpaid UT · no leave balance deduction</strong></div>}
                </div>
              </div>

              <div className="glass-card !p-5 mb-6" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="form-row">
                  <div>
                    <div className="text-xs text-muted uppercase mb-1">Date From</div>
                    <div className="font-bold">{new Date(request.dateFrom).toLocaleDateString()}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted uppercase mb-1">Date To</div>
                    <div className="font-bold">{new Date(request.dateTo).toLocaleDateString()}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted uppercase mb-1">{request.leaveType.isHoursBased ? 'Time of Leave' : 'Duration'}</div>
                    <div className="font-bold text-warning">
                      {request.totalHours > 0 
                        ? `${request.halfDayTime || ''} (${request.totalHours} hours)` 
                        : `${request.totalDays} ${request.totalDays === 1 ? 'Day' : 'Days'}`}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-xs text-muted uppercase tracking-wider mb-2">Reason</div>
                <div className="p-4 rounded-lg text-sm leading-relaxed" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                  {request.reason}
                </div>
              </div>

              {request.days && request.days.length > 0 && (
                <div className="mt-6">
                  <div className="text-xs text-muted uppercase tracking-wider mb-2">Daily Breakdown</div>
                  <div className="border border-[var(--border)] rounded-lg overflow-hidden">
                    <table className="w-full text-xs text-left mobile-record-table" role="table">
                      <thead className="bg-[var(--bg-secondary)] text-muted">
                        <tr>
                          <th className="px-4 py-3 font-medium" scope="col">Date</th>
                          <th className="px-4 py-3 font-medium" scope="col">Hours</th>
                          <th className="px-4 py-3 font-medium text-center" scope="col">Paid Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {request.days.map((day, idx) => (
                          <tr key={idx} className="bg-[var(--bg-card)] hover:bg-muted/20">
                            <td className="px-4 py-3" data-label="Date">{new Date(day.date).toLocaleDateString()}</td>
                            <td className="px-4 py-3" data-label="Hours">{day.hours} hrs {day.halfDayTime ? `(${day.halfDayTime})` : ''}</td>
                            <td className="px-4 py-3 text-center" data-label="Paid Status">
                              <span className={`badge ${day.isPaid ? 'badge-success' : 'badge-warning'}`}>
                                {day.isPaid ? 'Paid' : 'Unpaid'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {request.attachments.length > 0 && (
                <div className="mt-6">
                  <div className="text-xs text-muted uppercase tracking-wider mb-2">Attachments</div>
                  <div className="flex flex-col gap-2">
                    {request.attachments.map(a => (
                      <div key={a.id} className="detail-attachment flex items-center justify-between p-3 rounded-md" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <div className="flex items-center gap-2 text-sm">
                          <FileText size={16} className="text-primary" />
                          <span className="attachment-name">{a.fileName}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-xs text-muted">{(a.fileSize / 1024).toFixed(1)} KB</div>
                          <button 
                            className="btn btn-sm btn-ghost text-primary hover:bg-primary/20 p-1 px-3" 
                            onClick={() => handleViewAttachment(a)}
                          >
                            View
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(canCancel || canReschedule || canCancelApproved) && (
                <div className="mt-8 flex justify-end gap-4 mobile-actions">
                  {canCancel && (
                    <button className="btn btn-outline text-danger border-danger hover:bg-danger hover:text-white" onClick={handleCancel}>
                      <XCircle size={16} /> Cancel Request
                    </button>
                  )}
                  {canReschedule && (
                    <button className="btn btn-outline text-primary border-primary hover:bg-primary hover:text-white" onClick={() => setShowRescheduleModal(true)}>
                      <Clock size={16} /> Reschedule
                    </button>
                  )}
                  {canCancelApproved && <button className="btn btn-outline text-danger border-danger" onClick={() => setShowApprovedCancel(true)}><XCircle size={16}/> Cancel Approved Leave</button>}
                </div>
              )}
            </div>
          </div>

          <div className="glass-card" style={{ flex: 1 }}>
            <div className="glass-card-header">
              <h2>Approval Timeline</h2>
            </div>
            <div className="glass-card-body p-0">
              <div className="approval-timeline space-y-5">
                {/* Start Point */}
                <div className="timeline-item">
                  <div className="timeline-dot approved"><CheckCircle size={12} color="white" /></div>
                  <div className="timeline-content !p-5">
                    <div className="timeline-label">Request Filed</div>
                    <div className="timeline-meta">{new Date(request.dateFiled).toLocaleString()}</div>
                  </div>
                </div>

                  {/* Approval Steps */}
                  {timelineSteps.map((step, index) => (
                    <div className="timeline-item" key={step.id}>
                      <div className={`timeline-dot ${step.action.toLowerCase()}`}>
                        {step.action === 'Approved' ? <CheckCircle size={12} color="white" /> :
                         step.action === 'Disapproved' ? <XCircle size={12} color="white" /> :
                         <Clock size={12} color={step.action === 'Pending' ? 'var(--warning)' : 'var(--text-muted)'} />}
                      </div>
                      <div className="timeline-content !p-5">
                        <div className="text-xs text-muted uppercase">{approvalStageLabel(step.stepLabel, index)}</div>
                        <div className="timeline-label font-semibold">{step.stageKind === 'HR_REVIEW' ? (step.action === 'Approved' || step.action === 'Disapproved' ? `HR · ${step.approverName}` : 'HR') : step.approverName || 'Pending Assignment'}</div>
                        {step.stageKind === 'HR_REVIEW' && step.action === 'Pending' && <p className="text-sm text-muted mt-1">Any eligible HR user can review this request. One HR decision completes this stage.</p>}
                        {step.wasDelegated && (
                          <div className="text-xs font-semibold text-info mt-1 bg-info/10 p-1.5 rounded inline-block">
                            ↳ Delegated Action
                          </div>
                        )}
                        <div className="timeline-meta">{step.action} {step.actionDate && `on ${new Date(step.actionDate).toLocaleString()}`}</div>
                        {step.remarks && <div className="text-sm mt-2 p-2 rounded" style={{ background: 'rgba(255,255,255,0.05)' }}>Remarks: "{step.remarks}"</div>}
                        {step.reasonForRejection && <div className="text-sm mt-2 p-2 rounded text-danger" style={{ background: 'rgba(239,68,68,0.1)' }}>Rejection Reason: "{step.reasonForRejection}"</div>}
                        {step.action === 'Pending' && request.conversationAccess?.canComment && (
                          <>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm mt-3"
                              aria-expanded={expandedConversationStepId === step.id}
                              aria-controls={`approver-conversation-${step.id}`}
                              onClick={() => setExpandedConversationStepId(current => current === step.id ? null : step.id ?? null)}
                            >
                              <MessageCircle size={15}/>
                              {expandedConversationStepId === step.id ? 'Hide request conversation' : 'Show request conversation'}
                            </button>
                            <div id={`approver-conversation-${step.id}`} hidden={expandedConversationStepId !== step.id} className="min-w-0">
                              {expandedConversationStepId === step.id && <LeaveRequestConversation
                                key={`approver-${conversationReload}`}
                                request={request}
                                onUpdated={() => { setConversationReload(value => value + 1); void loadRequest(request.id, false); }}
                                onOpenAttachment={handleViewAttachment}
                              />}
                              {expandedConversationStepId === step.id && canRevisePending && <div className="mt-4"><button type="button" className="btn btn-outline" onClick={() => { const range = (request.halfDayTime || '07:00-12:00').split('-'); setRevision({ dateFrom: request.dateFrom.slice(0, 10), dateTo: request.dateTo.slice(0, 10), reason: request.reason, timeFrom: range[0] || '07:00', timeTo: range[1] || '12:00' }); setRevisionOpen(value => !value); }}><Clock size={16}/>{revisionOpen ? 'Close date revision' : 'Change dates or duration'}</button>
                                {revisionOpen && <form className="mt-4 p-4 rounded-lg border border-border space-y-4" onSubmit={submitPendingRevision}>
                                  <p className="text-sm text-muted">The request will be recalculated under the leave policies. The leave type and approval route stay unchanged.</p>
                                  <div className="form-row"><div className="form-group"><label className="form-label">Date from</label><input className="form-input" type="date" required value={revision.dateFrom} onChange={event => setRevision(value => ({ ...value, dateFrom: event.target.value, ...(request.leaveType.isHoursBased ? { dateTo: event.target.value } : {}) }))}/></div><div className="form-group"><label className="form-label">Date to</label><input className="form-input" type="date" required disabled={request.leaveType.isHoursBased} value={revision.dateTo} onChange={event => setRevision(value => ({ ...value, dateTo: event.target.value }))}/></div></div>
                                  {request.leaveType.isHoursBased && <div className="form-group"><label className="form-label">Time of Leave</label><div className="grid grid-cols-2 gap-3 mobile-form-grid"><label className="text-sm">From<input aria-label="Revised Time of Leave from" type="time" className="form-input mt-1" min={WORK_START} max={WORK_END} required value={revision.timeFrom} onChange={event => setRevision(value => ({ ...value, timeFrom: event.target.value }))}/></label><label className="text-sm">To<input aria-label="Revised Time of Leave to" type="time" className="form-input mt-1" min={WORK_START} max={WORK_END} required value={revision.timeTo} onChange={event => setRevision(value => ({ ...value, timeTo: event.target.value }))}/></label></div><p className="text-xs text-muted mt-1">Break allocations are deducted across the staggered windows (including 5-minute cleaning). Calculated: {calculateLeaveHours(revision.timeFrom, revision.timeTo).toFixed(2)} hours.</p></div>}
                                  <div className="form-group"><label className="form-label">Reason</label><textarea className="form-textarea" required rows={3} maxLength={500} value={revision.reason} onChange={event => setRevision(value => ({ ...value, reason: event.target.value }))}/></div>
                                  <div className="form-group"><label className="form-label">Additional supporting documents</label><input className="form-input" type="file" multiple accept=".svg,.png,.jpg,.jpeg,.pdf,.docx" onChange={event => setRevisionFiles(Array.from(event.target.files ?? []))}/></div>
                                  <div className="flex justify-end"><button className="btn btn-primary" disabled={isRevising}>{isRevising ? 'Submitting…' : 'Submit revised request'}</button></div>
                                </form>}
                              </div>}
                            </div>
                          </>
                        )}
                        {step.action === 'Pending' && actionableApproval && actionableApproval.approvalStepId === step.id && (
                          <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4 mobile-actions">
                            {actionableApproval.stageKind === 'HR_REVIEW' && <button type="button" className="btn btn-outline btn-sm" onClick={() => setExtensionOpen(true)}>Extend SL</button>}
                            <button type="button" className="btn btn-success btn-sm" onClick={() => { setDecisionRemarks(''); setFitnessAssessment(''); setDecision('approve'); }}><CheckCircle size={15}/>{actionableApproval.stageKind === 'HR_REVIEW' ? 'Complete HR Review' : 'Approve'}</button>
                            <button type="button" className="btn btn-danger btn-sm" onClick={() => { setDecisionRemarks(''); setDisapprovalReason(''); setDecision('disapprove'); }}><XCircle size={15}/>Disapprove</button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

      {decision && actionableApproval && <DialogOverlay
        onClose={() => { if (!submittingDecision) setDecision(null); }}
        label={`${decision === 'approve' ? 'Approve' : 'Disapprove'} leave request`}
        closeOnBackdrop={!submittingDecision}
        closeOnEscape={!submittingDecision}
      >
        <div className="modal-content animate-slide-up max-w-md w-full p-6">
          <div className="modal-header">
            <h2>{decision === 'approve' ? 'Approve' : 'Disapprove'} Leave Request</h2>
            <button type="button" className="modal-close" disabled={submittingDecision} aria-label="Close decision" onClick={() => setDecision(null)}><XCircle size={18}/></button>
          </div>
          <form onSubmit={submitDecision} className="space-y-4 text-xs">
            <div className="bg-muted/40 p-4 rounded-xl text-xs space-y-1.5 border border-border">
              <div>Applicant: <strong>{actionableApproval.employeeName}</strong> ({actionableApproval.department})</div>
              <div>Approval stage: <strong>{approvalStageLabel(actionableApproval.stepLabel, actionableApproval.stepOrder ? actionableApproval.stepOrder - 1 : undefined)}</strong></div>
              <div>Dates being approved: <strong>{new Date(request.dateFrom).toLocaleDateString()} – {new Date(request.dateTo).toLocaleDateString()}</strong></div>
              {actionableApproval.isDelegatedApproval && <div className="text-info font-medium pt-1">↳ Acting for <strong>{actionableApproval.originalApproverName}</strong></div>}
            </div>
            <div className="form-group">
              {decision === 'approve' && actionableApproval.stageKind === 'HR_REVIEW' && <>
                <label htmlFor="detail-fitness-assessment" className="form-label">Fit-to-work assessment *</label>
                <select id="detail-fitness-assessment" className="form-select mb-3" required value={fitnessAssessment} onChange={event => setFitnessAssessment(event.target.value)}>
                  <option value="">Select assessment…</option>
                  <option value="FitToWork">Fit to work</option>
                  <option value="RestRequired">Additional rest required — leave dates extended</option>
                </select>
                <p className="text-xs text-muted mb-3">Use Extend SL before selecting additional rest. Completing HR review activates the next stage.</p>
              </>}
              <label className="form-label" htmlFor="detail-decision-remarks">Remarks (Optional)</label>
              <textarea id="detail-decision-remarks" className="form-textarea" value={decisionRemarks} onChange={event => setDecisionRemarks(event.target.value)} rows={3} maxLength={500} placeholder="Add any comments here..." />
            </div>
            {decision === 'disapprove' && <div className="form-group">
              <label className="form-label" htmlFor="detail-disapproval-reason">Reason for Disapproval <span className="text-danger">*</span></label>
              <textarea id="detail-disapproval-reason" className="form-textarea" value={disapprovalReason} onChange={event => setDisapprovalReason(event.target.value)} rows={3} maxLength={500} required placeholder="State the reason for disapproval..." />
            </div>}
            <div className="flex justify-end gap-2.5 pt-3 border-t border-border mt-6">
              <button type="button" className="btn btn-outline text-xs py-2 px-3.5" disabled={submittingDecision} onClick={() => setDecision(null)}>Cancel</button>
              <button type="submit" className={`btn text-xs py-2 px-4 ${decision === 'approve' ? 'btn-success' : 'btn-danger'}`} disabled={submittingDecision}>
                {submittingDecision ? 'Processing...' : decision === 'approve' ? actionableApproval.stageKind === 'HR_REVIEW' ? 'Complete HR Review' : 'Confirm Approval' : 'Confirm Disapproval'}
              </button>
            </div>
          </form>
        </div>
      </DialogOverlay>}

      {showApprovedCancel && <DialogOverlay onClose={() => setShowApprovedCancel(false)} label="Cancel approved leave" closeOnEscape>
        <form className="modal-content p-6 space-y-4" style={{ maxWidth: 500 }} onSubmit={handleApprovedCancel}>
          <h2>Cancel Approved Leave</h2>
          <p className="text-sm text-muted">Cancellation takes effect immediately and restores your leave balance. Your approvers will be notified.</p>
          <label className="form-group"><span className="form-label">Reason for cancellation</span><textarea className="form-textarea" maxLength={500} required value={approvedCancelReason} onChange={event => setApprovedCancelReason(event.target.value)} /></label>
          <div className="flex justify-end gap-3"><button className="btn btn-outline" type="button" onClick={() => setShowApprovedCancel(false)}>Keep Leave</button><button className="btn btn-primary" disabled={cancellingApproved || !approvedCancelReason.trim()}>{cancellingApproved ? 'Cancelling…' : 'Confirm Cancellation'}</button></div>
        </form>
      </DialogOverlay>}

      {/* Reschedule Modal */}
      {showRescheduleModal && (
        <DialogOverlay label="Reschedule leave" onClose={() => setShowRescheduleModal(false)} closeOnEscape={!isRescheduling} className="reschedule-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in" style={{ padding: 16 }}>
          <div data-dialog-content className="reschedule-panel bg-[var(--bg-card)] rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl border border-[var(--border)]">
            <div className="p-6 border-b border-[var(--border)] flex justify-between items-center sticky top-0 bg-[var(--bg-card)] z-10">
              <h2 className="text-lg font-bold">Reschedule Leave</h2>
              <button type="button" aria-label="Close reschedule" disabled={isRescheduling} onClick={() => setShowRescheduleModal(false)} className="text-muted hover:text-foreground">
                <XCircle size={20} />
              </button>
            </div>
            
            <form onSubmit={submitReschedule} className="p-6">
              <div className="form-row mb-4">
                <div className="form-group">
                  <label className="form-label">New Date From</label>
                  <input type="date" className="form-input" required value={rescheduleData.dateFrom} onChange={e => setRescheduleData({ ...rescheduleData, dateFrom: e.target.value, ...(request.leaveType.isHoursBased ? { dateTo: e.target.value } : {}) })} />
                </div>
                <div className="form-group">
                  <label className="form-label">New Date To</label>
                  <input type="date" className="form-input" required disabled={request.leaveType.isHoursBased} value={rescheduleData.dateTo} onChange={e => setRescheduleData({ ...rescheduleData, dateTo: e.target.value })} />
                </div>
              </div>
              
              {rescheduleDays.length > 0 && (
                <div className="mb-4">
                  <label className="form-label">Daily Breakdown</label>
                  <div className="border border-[var(--border)] rounded-md overflow-hidden">
                    <table className="w-full text-sm text-left mobile-record-table" role="table">
                      <thead className="bg-[var(--bg-secondary)] text-muted">
                        <tr>
                          <th className="!pl-8 pr-4 py-2 font-medium" scope="col">Date</th>
                          <th className="px-4 py-2 font-medium text-center w-32" scope="col">Paid Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {rescheduleDays.map((day, idx) => (
                          <tr key={idx} className="bg-[var(--bg-card)]">
                            <td className="!pl-8 pr-4 py-2" data-label="Date">{new Date(day.date).toLocaleDateString()}</td>
                            <td className="px-4 py-2 text-center" data-label="Paid Status">
                              <div className="flex items-center justify-center w-full gap-2">
                                <Checkbox 
                                  id={`reschedule-paid-${idx}`}
                                  checked={day.isPaid}
                                  onCheckedChange={(checked) => handleRescheduleDayUpdate(idx, 'isPaid', !!checked)}
                                  className="border-[rgba(255,255,255,0.4)]"
                                />
                                <Label 
                                  htmlFor={`reschedule-paid-${idx}`}
                                  className="text-muted cursor-pointer"
                                >
                                  {day.isPaid ? 'Paid' : 'Unpaid'}
                                </Label>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="form-group mb-6">
                <label className="form-label">Reason for Rescheduling</label>
                <textarea className="form-textarea" required rows={3} value={rescheduleData.reason} onChange={e => setRescheduleData({ ...rescheduleData, reason: e.target.value })} placeholder="Why are you rescheduling this leave?"></textarea>
              </div>

              <div className="form-group mb-6">
                <label className="form-label">Supporting Documents</label>
                <input type="file" className="form-input" multiple accept=".svg,.png,.jpg,.jpeg,.pdf,.docx" onChange={event => setRescheduleFiles(Array.from(event.target.files ?? []))} />
                <p className="text-xs text-muted mt-1">Required for Sick Leave of two or more working days, or a one-day Sick Leave on Monday or Friday. Maximum 5 files, 10 MB each.</p>
              </div>

              <div className="flex justify-end gap-3">
                <button type="button" className="btn btn-outline" onClick={() => setShowRescheduleModal(false)} disabled={isRescheduling}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isRescheduling}>
                  {isRescheduling ? 'Submitting...' : 'Submit Reschedule'}
                </button>
              </div>
            </form>
          </div>
        </DialogOverlay>
      )}

      {extensionOpen && actionableApproval && <SickLeaveExtensionDialog request={{ ...actionableApproval, dateTo: request.dateTo, totalDays: request.totalDays }} onClose={() => setExtensionOpen(false)} onExtended={async () => { await loadRequest(request.id, false); toast.success('Sick Leave extended. Review the new dates before completing HR review.'); }} />}
      {/* Attachment Preview Modal */}
      <AttachmentPreviewModal 
        isOpen={isViewingAttachment}
        onClose={closeAttachmentModal}
        attachment={selectedAttachment}
        blobUrl={attachmentBlobUrl}
      />
    </div>
  );
};
