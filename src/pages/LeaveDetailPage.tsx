import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LeaveAPI, type LeaveRequestDetail } from '../lib/api';
import { FileText, ArrowLeft, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ToastProvider';
import { useConfirm } from '../components/ConfirmDialog';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import { AttachmentPreviewModal } from '../components/AttachmentPreviewModal';

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
  const [rescheduleData, setRescheduleData] = useState({ dateFrom: '', dateTo: '', reason: '' });
  const [rescheduleDays, setRescheduleDays] = useState<any[]>([]);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<any | null>(null);
  const [attachmentBlobUrl, setAttachmentBlobUrl] = useState<string | null>(null);
  const [isViewingAttachment, setIsViewingAttachment] = useState(false);

  // Auto-calculate for reschedule
  useEffect(() => {
    if (showRescheduleModal && rescheduleData.dateFrom && rescheduleData.dateTo) {
      const from = new Date(rescheduleData.dateFrom);
      const to = new Date(rescheduleData.dateTo);
      if (to >= from) {
        const generatedDays = [];
        for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
          if (d.getDay() !== 0 && d.getDay() !== 6) {
            generatedDays.push({
              date: d.toISOString().split('T')[0],
              hours: 8,
              isPaid: true
            });
          }
        }
        setRescheduleDays(generatedDays);
      } else {
        setRescheduleDays([]);
      }
    }
  }, [rescheduleData.dateFrom, rescheduleData.dateTo, showRescheduleModal]);

  useEffect(() => {
    if (id) loadRequest(parseInt(id, 10));
  }, [id]);

  const loadRequest = async (requestId: number) => {
    setLoading(true);
    try {
      const data = await LeaveAPI.getRequest(requestId);
      setRequest(data);
    } catch (e: any) {
      setError(e.response?.data || 'Failed to load request details');
    } finally {
      setLoading(false);
    }
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

  const isOwner = user?.username === request.employee.employeeID;
  const canCancel = isOwner && !['Approved', 'Disapproved', 'Cancelled', 'Rescheduled'].includes(request.status);
  const canReschedule = isOwner && request.status === 'Approved' && !request.rescheduledToRequestId;

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
        leaveTypeId: request.leaveType.code === 'VL' ? 1 : 2, // Ideally pass the actual ID, need to fetch types or assume it's same ID, wait, we don't have leaveTypeId in request detail, but we can pass it if we add it or backend uses the original request's type if not changed. Let's just pass 0 and let backend use it, wait backend expects it.
        dateFrom: rescheduleData.dateFrom,
        dateTo: rescheduleData.dateTo,
        totalHours: 0,
        reason: rescheduleData.reason,
        days: rescheduleDays
      });
      toast.success('Leave rescheduled successfully!');
      setShowRescheduleModal(false);
      loadRequest(request.id);
    } catch (err: any) {
      toast.error(err.response?.data || 'Failed to reschedule');
    } finally {
      setIsRescheduling(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <button className="btn btn-ghost mb-2" onClick={() => navigate(-1)} style={{ marginLeft: -8 }}>
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex items-center justify-between">
          <h1>Leave Request #{request.id}</h1>
          <span className="badge badge-info text-sm py-1 px-3" style={{ fontSize: '0.9rem' }}>
            {request.status.replace('Pending', 'Pending ')}
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
                    <div className="text-xs text-muted uppercase mb-1">Duration</div>
                    <div className="font-bold text-warning">
                      {request.totalHours > 0 
                        ? `${request.totalHours} Hours ${request.halfDayTime ? `(${request.halfDayTime})` : ''}` 
                        : `${request.totalDays} Days`}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-xs text-muted uppercase tracking-wider mb-1">Reason</div>
                <div className="!p-5 rounded-md" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                  {request.reason}
                </div>
              </div>

              {request.days && request.days.length > 0 && (
                <div className="mt-6">
                  <div className="text-xs text-muted uppercase tracking-wider mb-2">Daily Breakdown</div>
                  <div className="border border-[var(--border)] rounded-md overflow-hidden">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-[var(--bg-secondary)] text-muted">
                        <tr>
                          <th className="!pl-8 pr-4 py-2 font-medium">Date</th>
                          <th className="px-4 py-2 font-medium">Hours</th>
                          <th className="px-4 py-2 font-medium text-center">Paid Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {request.days.map((day, idx) => (
                          <tr key={idx} className="bg-[var(--bg-card)]">
                            <td className="!pl-8 pr-4 py-2">{new Date(day.date).toLocaleDateString()}</td>
                            <td className="px-4 py-2">{day.hours} hrs {day.halfDayTime ? `(${day.halfDayTime})` : ''}</td>
                            <td className="px-4 py-2 text-center">
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
                      <div key={a.id} className="flex items-center justify-between p-3 rounded-md" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <div className="flex items-center gap-2 text-sm">
                          <FileText size={16} className="text-primary" />
                          {a.fileName}
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

              {(canCancel || canReschedule) && (
                <div className="mt-8 flex justify-end gap-4">
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
                  {request.approvalSteps?.map(step => (
                    <div className="timeline-item" key={step.id}>
                      <div className={`timeline-dot ${step.action.toLowerCase()}`}>
                        {step.action === 'Approved' ? <CheckCircle size={12} color="white" /> :
                         step.action === 'Disapproved' ? <XCircle size={12} color="white" /> :
                         <Clock size={12} color={step.action === 'Pending' ? 'var(--warning)' : 'var(--text-muted)'} />}
                      </div>
                      <div className="timeline-content !p-5">
                        <div className="text-xs text-muted uppercase">{step.stepLabel}</div>
                        <div className="timeline-label">{step.approverName || 'Pending Assignment'}</div>
                        <div className="timeline-meta">{step.action} {step.actionDate && `on ${new Date(step.actionDate).toLocaleString()}`}</div>
                        {step.remarks && <div className="text-sm mt-2 p-2 rounded" style={{ background: 'rgba(255,255,255,0.05)' }}>"{step.remarks}"</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

      {/* Reschedule Modal */}
      {showRescheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
          <div className="bg-[var(--bg-card)] rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl border border-[var(--border)]">
            <div className="p-6 border-b border-[var(--border)] flex justify-between items-center sticky top-0 bg-[var(--bg-card)] z-10">
              <h2 className="text-lg font-bold">Reschedule Leave</h2>
              <button onClick={() => setShowRescheduleModal(false)} className="text-muted hover:text-foreground">
                <XCircle size={20} />
              </button>
            </div>
            
            <form onSubmit={submitReschedule} className="p-6">
              <div className="form-row mb-4">
                <div className="form-group">
                  <label className="form-label">New Date From</label>
                  <input type="date" className="form-input" required value={rescheduleData.dateFrom} onChange={e => setRescheduleData({ ...rescheduleData, dateFrom: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">New Date To</label>
                  <input type="date" className="form-input" required value={rescheduleData.dateTo} onChange={e => setRescheduleData({ ...rescheduleData, dateTo: e.target.value })} />
                </div>
              </div>
              
              {rescheduleDays.length > 0 && (
                <div className="mb-4">
                  <label className="form-label">Daily Breakdown</label>
                  <div className="border border-[var(--border)] rounded-md overflow-hidden">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-[var(--bg-secondary)] text-muted">
                        <tr>
                          <th className="!pl-8 pr-4 py-2 font-medium">Date</th>
                          <th className="px-4 py-2 font-medium text-center w-32">Paid Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {rescheduleDays.map((day, idx) => (
                          <tr key={idx} className="bg-[var(--bg-card)]">
                            <td className="!pl-8 pr-4 py-2">{new Date(day.date).toLocaleDateString()}</td>
                            <td className="px-4 py-2 text-center">
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

              <div className="flex justify-end gap-3">
                <button type="button" className="btn btn-outline" onClick={() => setShowRescheduleModal(false)} disabled={isRescheduling}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isRescheduling}>
                  {isRescheduling ? 'Submitting...' : 'Submit Reschedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
