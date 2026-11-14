import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApprovalAPI, LeaveAPI, getApiErrorMessage, type LeaveRequestDetail, type PendingApproval } from '../lib/api';
import { CheckSquare, Check, X, Eye, UserCheck, FileBarChart, MessageCircle } from 'lucide-react';
import { useToast } from '../components/ToastProvider';
import { DialogOverlay } from '../components/ui/DialogOverlay';
import { NotificationService } from '../services/notificationService';
import { approvalStageLabel } from '../lib/approvalLabels';
import { LeaveSummaryForm } from '../components/LeaveSummaryForm';
import type { PendingApprovalLeaveSummary } from '../lib/api';
import { LeaveRequestConversation } from '../components/LeaveRequestConversation';
import { SickLeaveExtensionDialog } from '../components/SickLeaveExtensionDialog';
import { ApprovalRequestCard } from '../components/ApprovalRequestCard';

export const ApprovalsPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [pending, setPending] = useState<PendingApproval[]>([]);
  const [waitingOnEmployees, setWaitingOnEmployees] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [selectedRequest, setSelectedRequest] = useState<PendingApproval | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'disapprove' | null>(null);
  const [remarks, setRemarks] = useState('');
  const [reasonForRejection, setReasonForRejection] = useState('');
  const [fitnessAssessment, setFitnessAssessment] = useState('');
  const [extensionRequest, setExtensionRequest] = useState<PendingApproval | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [leaveSummary, setLeaveSummary] = useState<PendingApprovalLeaveSummary | null>(null);
  const [loadingSummaryFor, setLoadingSummaryFor] = useState<number | null>(null);
  const [conversationRequest, setConversationRequest] = useState<LeaveRequestDetail | null>(null);
  const [loadingConversationFor, setLoadingConversationFor] = useState<number | null>(null);
  const remarksRef = useRef<HTMLTextAreaElement>(null);
  const rejectionRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadPending();
    const unsubscribeNotifications = NotificationService.subscribe(notification => { if (!notification || notification.type.includes('Approval') || notification.type.includes('Cancel') || notification.type.includes('LeaveConversation') || notification.type.includes('LeaveRequestRevised') || notification.type === 'LeaveUpdated') void loadPending(); });
    const unsubscribeOrganization = NotificationService.subscribeOrganizationChanges(() => { void loadPending(); });
    return () => { unsubscribeNotifications(); unsubscribeOrganization(); };
  }, []);

  const loadPending = async () => {
    setLoading(true);
    try {
      const [actionable, waiting] = await Promise.all([ApprovalAPI.getPending(), ApprovalAPI.getWaitingOnEmployees()]);
      setPending(actionable);
      setWaitingOnEmployees(waiting.map(item => ({ ...item, waitingForEmployee: true })));
    } catch (e) {
      console.error(e);
      toast.error('Failed to load pending approvals');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest || !actionType) return;
    setSubmitting(true);
    try {
      if (actionType === 'approve') {
        await ApprovalAPI.approve(selectedRequest.leaveRequestId, { remarks,
          fitnessAssessment: selectedRequest.stageKind === 'HR_REVIEW' ? fitnessAssessment : undefined,
          expectedDateTo: selectedRequest.stageKind === 'HR_REVIEW' ? selectedRequest.dateTo : undefined });
      } else {
        await ApprovalAPI.disapprove(selectedRequest.leaveRequestId, { remarks, reasonForRejection });
      }
      setSelectedRequest(null);
      toast.success(actionType === 'approve' ? 'Leave request approved successfully' : 'Leave request disapproved');
      loadPending();
    } catch (e: unknown) {
      const actionLabel = actionType === 'approve' ? 'approve' : 'disapprove';
      toast.error(getApiErrorMessage(e, `Unable to ${actionLabel} this leave request. Please try again.`));
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewLeaveSummary = async (request: PendingApproval) => {
    setLoadingSummaryFor(request.leaveRequestId);
    try {
      const summary = await ApprovalAPI.getPendingLeaveSummary(request.leaveRequestId);
      setLeaveSummary(summary);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'This request is no longer pending with you, or its summary could not be loaded.'));
      void loadPending();
    } finally {
      setLoadingSummaryFor(null);
    }
  };

  const openConversation = async (requestId: number) => {
    setLoadingConversationFor(requestId);
    try { setConversationRequest(await LeaveAPI.getRequest(requestId)); }
    catch (error) { toast.error(getApiErrorMessage(error, 'Could not load the request conversation.')); }
    finally { setLoadingConversationFor(null); }
  };

  const refreshConversation = async () => {
    if (!conversationRequest) return;
    try { setConversationRequest(await LeaveAPI.getRequest(conversationRequest.id)); void loadPending(); }
    catch (error) { toast.error(getApiErrorMessage(error, 'Could not refresh the request conversation.')); }
  };

  const delegatedCount = pending.filter(p => p.isDelegatedApproval).length;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1>Pending Approvals</h1>
        <p>Review and act on leave requests pending your approval</p>
      </div>

      <div className="page-body">
        {delegatedCount > 0 && (
          <div className="alert alert-info mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCheck size={18} className="text-info shrink-0" />
              <span>
                You have <strong>{delegatedCount}</strong> pending approval{delegatedCount > 1 ? 's' : ''} delegated to you as an acting approver.
              </span>
            </div>
            <span className="badge badge-info">Delegated Action</span>
          </div>
        )}

        <div className="glass-card">
          <div className="glass-card-header flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CheckSquare size={18} className="text-warning shrink-0" />
              <h2 className="text-base font-bold m-0">Requests Requiring Your Action ({pending.length})</h2>
            </div>
          </div>
          <div className="glass-card-body p-0">
            {loading ? (
              <div className="loading-spinner min-h-[280px]"><div className="spinner"></div></div>
            ) : pending.length === 0 ? (
              <div className="empty-state min-h-[280px] sm:min-h-[300px] p-6 sm:p-8 flex flex-col items-center justify-center text-center">
                <CheckSquare size={48} className="text-success opacity-90 mb-4 shrink-0" />
                <h3 className="text-base font-bold text-text-primary mb-2">All Caught Up!</h3>
                <p className="text-xs text-text-secondary max-w-sm m-0 leading-relaxed">{waitingOnEmployees.length ? `${waitingOnEmployees.length} request${waitingOnEmployees.length === 1 ? ' is' : 's are'} waiting for an employee response. Approval actions are paused until they reply.` : 'You have no pending leave requests to approve.'}</p>
              </div>
            ) : (
              <>
                <div className="approval-mobile-list" aria-label="Requests requiring your action">
                  {pending.map(p => <ApprovalRequestCard key={p.approvalStepId} request={p} onOpen={() => navigate(`/leave/${p.leaveRequestId}`)} actions={<>
                    <button type="button" className="btn btn-success btn-sm" onClick={() => { setSelectedRequest(p); setActionType('approve'); setRemarks(''); setFitnessAssessment(''); }}><Check size={16} aria-hidden="true" />{p.stageKind === 'HR_REVIEW' ? 'Complete HR Review' : 'Approve'}</button>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => { setSelectedRequest(p); setActionType('disapprove'); setRemarks(''); setReasonForRejection(''); }}><X size={16} aria-hidden="true" />Disapprove</button>
                  </>} secondaryActions={<>
                    <button type="button" className="btn btn-outline" onClick={() => void handleViewLeaveSummary(p)} disabled={loadingSummaryFor === p.leaveRequestId}><FileBarChart size={16} aria-hidden="true" />Leave summary</button>
                    <button type="button" className="btn btn-outline" onClick={() => void openConversation(p.leaveRequestId)} disabled={loadingConversationFor === p.leaveRequestId}><MessageCircle size={16} aria-hidden="true" />Conversation</button>
                    {p.stageKind === 'HR_REVIEW' && <button type="button" className="btn btn-outline" onClick={() => setExtensionRequest(p)}>Extend SL</button>}
                  </>} />)}
                </div>
              <div className="data-table-wrapper approval-desktop-table">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Leave Type</th>
                      <th>Date Range</th>
                      <th>Duration</th>
                      <th>Role & Authority</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pending.map(p => (
                      <tr key={p.approvalStepId}>
                        <td>
                          <div className="font-bold">{p.employeeName}</div>
                          <div className="text-xs text-muted">{p.department} &bull; {p.employeeID}</div>
                        </td>
                        <td>
                          <div className="font-bold text-primary">{p.requestKind === 'Cancellation' ? 'Cancellation' : p.requestKind === 'Reschedule' ? 'Reschedule' : p.leaveTypeCode}</div>
                          {p.requestKind && p.requestKind !== 'Leave' && <div className="text-xs text-muted">{p.leaveTypeCode} · Linked request</div>}
                          <div className="text-xs text-muted">{p.leaveTypeDescription}</div>
                        </td>
                        <td>{new Date(p.dateFrom).toLocaleDateString()} - {new Date(p.dateTo).toLocaleDateString()}</td>
                        <td>{p.totalHours > 0 ? `${p.totalHours}h` : `${p.totalDays}d`}{p.balanceDeductionLeaveTypeCode && <div className="text-xs text-muted">Deduct from {p.balanceDeductionLeaveTypeCode}</div>}{p.leaveTypeCode.toUpperCase() === 'UT' && <div className="text-xs text-warning">Unpaid UT</div>}</td>
                        <td>
                          <div className="flex flex-col gap-1 items-start">
                            <span className="badge badge-pending">{approvalStageLabel(p.stepLabel, p.stepOrder ? p.stepOrder - 1 : undefined)}</span>
                            {p.isDelegatedApproval && (
                              <span className="badge badge-info text-[10px]" title={`Reason: ${p.delegationReason || 'Delegated authority'}`}>
                                ↳ Acting for {p.originalApproverName}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }} className="space-x-1">
                          <button className="btn btn-ghost text-primary p-1.5" onClick={() => void handleViewLeaveSummary(p)} title="View employee leave summary" aria-label={`View leave summary for ${p.employeeName}`} disabled={loadingSummaryFor === p.leaveRequestId}>
                            <FileBarChart size={16} />
                          </button>
                          <button className="btn btn-ghost text-primary p-1.5" onClick={() => navigate(`/leave/${p.leaveRequestId}`)} title="View Details">
                            <Eye size={16} />
                          </button>
                          <button className="btn btn-ghost text-primary p-1.5" onClick={() => void openConversation(p.leaveRequestId)} title="Open request conversation" aria-label={`Open conversation for ${p.employeeName}`} disabled={loadingConversationFor === p.leaveRequestId}>
                            <MessageCircle size={16} />
                          </button>
                          {p.stageKind === 'HR_REVIEW' && <button className="btn btn-outline btn-sm" onClick={() => setExtensionRequest(p)}>Extend SL</button>}
                          <button className="btn btn-ghost text-success p-1.5" onClick={() => { setSelectedRequest(p); setActionType('approve'); setRemarks(''); setFitnessAssessment(''); }} title={p.stageKind === 'HR_REVIEW' ? 'Complete HR Review' : 'Approve'}>
                            <Check size={16} />
                          </button>
                          <button className="btn btn-ghost text-danger p-1.5" onClick={() => { setSelectedRequest(p); setActionType('disapprove'); setRemarks(''); setReasonForRejection(''); }} title="Disapprove">
                            <X size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </div>
        </div>

        {waitingOnEmployees.length > 0 && <div className="glass-card mt-6">
          <div className="glass-card-header flex items-center justify-between gap-3">
            <div className="min-w-0"><h2 className="text-base font-bold m-0">Waiting for employee ({waitingOnEmployees.length})</h2><p className="text-xs text-muted mt-1 mb-0">These requests remain pending, but approval actions are paused until the employee replies or revises the request.</p></div>
          </div>
          <div className="approval-mobile-list" aria-label="Requests waiting for employees">
            {waitingOnEmployees.map(item => <ApprovalRequestCard key={item.approvalStepId} request={item} waiting onOpen={() => navigate(`/leave/${item.leaveRequestId}`)} secondaryActions={
              <button type="button" className="btn btn-outline" onClick={() => void openConversation(item.leaveRequestId)} disabled={loadingConversationFor === item.leaveRequestId}><MessageCircle size={16} aria-hidden="true" />Conversation</button>
            } />)}
          </div>
          <div className="data-table-wrapper approval-desktop-table"><table className="data-table">
            <thead><tr><th>Employee</th><th>Leave Type</th><th>Date Range</th><th>Duration</th><th>Approval Stage</th><th>Actions</th></tr></thead>
            <tbody>{waitingOnEmployees.map(item => <tr key={item.approvalStepId}>
              <td><div className="font-bold">{item.employeeName}</div><div className="text-xs text-muted">{item.department} · {item.employeeID}</div></td>
              <td><div className="font-bold text-primary">{item.leaveTypeCode}</div><div className="text-xs text-muted">{item.leaveTypeDescription}</div></td>
              <td>{new Date(item.dateFrom).toLocaleDateString()} – {new Date(item.dateTo).toLocaleDateString()}</td>
              <td>{item.totalHours > 0 ? `${item.totalHours}h` : `${item.totalDays}d`}{item.balanceDeductionLeaveTypeCode && <div className="text-xs text-muted">Deduct from {item.balanceDeductionLeaveTypeCode}</div>}{item.leaveTypeCode.toUpperCase() === 'UT' && <div className="text-xs text-warning">Unpaid UT</div>}</td>
              <td><span className="badge badge-pending">{approvalStageLabel(item.stepLabel, item.stepOrder ? item.stepOrder - 1 : undefined)} · Waiting for employee</span></td>
              <td className="space-x-1"><button type="button" className="btn btn-ghost text-primary p-1.5" title="Open request conversation" aria-label={`Open conversation for ${item.employeeName}`} onClick={() => void openConversation(item.leaveRequestId)} disabled={loadingConversationFor === item.leaveRequestId}><MessageCircle size={17}/></button><button type="button" className="btn btn-outline btn-sm" onClick={() => navigate(`/leave/${item.leaveRequestId}`)}>View details</button></td>
            </tr>)}</tbody>
          </table></div>
        </div>}
      </div>

      {conversationRequest && <DialogOverlay
        onClose={() => setConversationRequest(null)}
        label={`Conversation for ${conversationRequest.employee.fullName}'s leave request`}
        description="Read and send comments on this leave request."
        closeOnBackdrop
        style={{ background: 'var(--overlay-backdrop)', backdropFilter: 'blur(8px)' }}
      >
        <div className="modal-content animate-slide-up w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 sm:p-6">
          <div className="modal-header flex items-start justify-between gap-3">
            <div><h2 className="flex items-center gap-2"><MessageCircle size={19} className="text-primary"/>Request Conversation</h2><p className="text-sm text-muted mt-1">{conversationRequest.employee.fullName} · {conversationRequest.leaveType.code} · {new Date(conversationRequest.dateFrom).toLocaleDateString()} – {new Date(conversationRequest.dateTo).toLocaleDateString()}</p></div>
            <button type="button" className="modal-close shrink-0" aria-label="Close request conversation" onClick={() => setConversationRequest(null)}><X size={18}/></button>
          </div>
          <LeaveRequestConversation key={conversationRequest.id} request={conversationRequest} onUpdated={() => void refreshConversation()} />
          {loadingConversationFor === conversationRequest.id && <div className="loading-spinner"><div className="spinner"/></div>}
        </div>
      </DialogOverlay>}

      {/* Action Modal */}
      {selectedRequest && actionType && (
        <DialogOverlay onClose={() => { if (!submitting) setSelectedRequest(null); }} label={`${actionType === 'approve' ? 'Approve' : 'Disapprove'} leave request`} closeOnBackdrop={!submitting} closeOnEscape={!submitting} initialFocusRef={actionType === 'disapprove' ? rejectionRef : remarksRef}>
          <div className="modal-content animate-slide-up max-w-md w-full p-6">
            <div className="modal-header">
              <h2>{actionType === 'approve' ? 'Approve' : 'Disapprove'} Leave Request</h2>
              <button type="button" className="modal-close" disabled={submitting} onClick={() => setSelectedRequest(null)}><X size={18} /></button>
            </div>
            <form onSubmit={handleAction} className="space-y-4 text-xs">
              <div className="bg-muted/40 p-4 rounded-xl text-xs space-y-1.5 border border-border">
                <div>Applicant: <strong>{selectedRequest.employeeName}</strong> ({selectedRequest.department})</div>
                <div>Request: <strong>{selectedRequest.requestKind === 'Cancellation' ? 'Cancel approved leave' : selectedRequest.requestKind === 'Reschedule' ? 'Reschedule approved leave' : selectedRequest.leaveTypeCode}</strong> ({selectedRequest.totalHours > 0 ? `${selectedRequest.totalHours}h` : `${selectedRequest.totalDays}d`})</div>
                {selectedRequest.balanceDeductionLeaveTypeCode && <div>HDL deduction: <strong>{selectedRequest.balanceDeductionLeaveTypeCode}</strong></div>}
                {selectedRequest.leaveTypeCode.toUpperCase() === 'UT' && <div className="text-warning">Unpaid UT — no leave balance deduction.</div>}
                <div>Approval Stage: <strong>{approvalStageLabel(selectedRequest.stepLabel, selectedRequest.stepOrder ? selectedRequest.stepOrder - 1 : undefined)}</strong></div>
                <div>Dates being approved: <strong>{new Date(selectedRequest.dateFrom).toLocaleDateString()} – {new Date(selectedRequest.dateTo).toLocaleDateString()}</strong></div>
                {selectedRequest.isDelegatedApproval && (
                  <div className="text-info font-medium pt-1">
                    ↳ You are signing on behalf of <strong>{selectedRequest.originalApproverName}</strong> (Delegation Active)
                  </div>
                )}
              </div>

              {actionType === 'approve' && selectedRequest.stageKind === 'HR_REVIEW' && <div className="form-group">
                <label htmlFor="hr-fitness-assessment" className="form-label">Fit-to-work assessment *</label>
                <select id="hr-fitness-assessment" className="form-select" required value={fitnessAssessment} onChange={event => setFitnessAssessment(event.target.value)}>
                  <option value="">Select assessment…</option>
                  <option value="FitToWork">Fit to work</option>
                  <option value="RestRequired">Additional rest required — leave dates extended</option>
                </select>
                <p className="text-xs text-muted">If additional rest is needed, cancel this dialog and use Extend SL first. Completing this review sends the updated request to the next stage.</p>
              </div>}
              <div className="form-group">
                <label className="form-label">Remarks (Optional)</label>
                <textarea ref={remarksRef} className="form-textarea" value={remarks} onChange={e => setRemarks(e.target.value)} rows={3} maxLength={500} placeholder="Add any comments here..." />
              </div>

              {actionType === 'disapprove' && (
                <div className="form-group">
                  <label className="form-label">Reason for Disapproval <span className="text-danger">*</span></label>
                  <textarea ref={rejectionRef} className="form-textarea" value={reasonForRejection} onChange={e => setReasonForRejection(e.target.value)} rows={3} maxLength={500} required placeholder="State the reason for rejection..." />
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-3 border-t border-border mt-6">
                <button type="button" className="btn btn-outline text-xs py-2 px-3.5" disabled={submitting} onClick={() => setSelectedRequest(null)}>Cancel</button>
                <button type="submit" className={`btn text-xs py-2 px-4 ${actionType === 'approve' ? 'btn-success' : 'btn-danger'}`} disabled={submitting}>
                  {submitting ? 'Processing...' : actionType === 'approve' ? selectedRequest.stageKind === 'HR_REVIEW' ? 'Complete HR Review' : 'Confirm Approval' : 'Confirm Disapproval'}
                </button>
              </div>
            </form>
          </div>
        </DialogOverlay>
      )}
      {leaveSummary && <LeaveSummaryForm {...leaveSummary} onClose={() => setLeaveSummary(null)} />}
      {extensionRequest && <SickLeaveExtensionDialog request={extensionRequest} onClose={() => setExtensionRequest(null)} onExtended={async () => { await loadPending(); toast.success('Sick Leave extended. Complete HR review after checking the updated dates.'); }} />}
    </div>
  );
};
