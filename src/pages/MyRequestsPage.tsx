import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LeaveAPI, type LeaveRequest } from '../lib/api';
import { Clock, Filter, Eye, Trash2, CalendarClock, Ban, X } from 'lucide-react';
import { useToast } from '../components/ToastProvider';
import { useConfirm } from '../components/ConfirmDialog';
import { NotificationService } from '../services/notificationService';
import { canRequestLeaveChange, leaveChangeDateIsOpen, leaveStatusBadgeClass, leaveStatusLabel } from '../lib/statusFormat';

export const MyRequestsPage: React.FC = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [cancellationTarget, setCancellationTarget] = useState<LeaveRequest | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [submittingCancellation, setSubmittingCancellation] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();

  const handleDelete = async (id: number) => {
    if (await confirm({
      title: 'Delete Request',
      message: 'Are you sure you want to permanently delete this pending leave request? This action cannot be undone.',
      confirmText: 'Delete',
      variant: 'danger'
    })) {
      try {
        await LeaveAPI.deleteRequest(id);
        toast.success('Leave request deleted successfully');
        loadRequests();
      } catch (err: any) {
        toast.error(err.response?.data || 'Failed to delete request');
      }
    }
  };

  const submitCancellation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!cancellationTarget || !cancellationReason.trim()) return;
    setSubmittingCancellation(true);
    try {
      const result = await LeaveAPI.requestCancellation(cancellationTarget.id, cancellationReason.trim());
      if (result.notificationsQueued) toast.success('Approved leave cancelled. Your approvers have been notified.');
      else toast.info('Approved leave cancelled. An approver notification could not be queued; please contact HR.');
      setCancellationTarget(null);
      setCancellationReason('');
      await loadRequests();
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.response?.data || 'Failed to request cancellation');
    } finally {
      setSubmittingCancellation(false);
    }
  };

  useEffect(() => {
    loadRequests();
    return NotificationService.subscribe(notification => { if (!notification || notification.type.includes('Leave') || notification.type.includes('Approval')) void loadRequests(); });
  }, [filter]);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const data = await LeaveAPI.getMyRequests(filter);
      setRequests(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1>My Leave Requests</h1>
        <p>View and track the status of your leave applications</p>
      </div>

      <div className="page-body">
        <div className="glass-card">
          <div className="glass-card-header">
            <div className="flex items-center gap-4">
              <Clock size={18} />
              <h2>All Requests</h2>
            </div>
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-muted" />
              <select data-tutorial="requests-filter" aria-label="Filter requests by status" className="form-select btn-sm" value={filter} onChange={e => setFilter(e.target.value)} style={{ minWidth: 160 }}>
                <option value="">All Statuses</option>
                <option value="Approved">Approved</option>
                <option value="Disapproved">Disapproved</option>
                <option value="Cancelled">Cancelled</option>
                <option value="PendingSupervisor">Pending Supervisor</option>
                <option value="PendingDepartmentManager">Pending Dept Manager</option>
                <option value="PendingHRSection">Pending HR</option>
                <option value="Pending HR Review">Pending HR Review (SL)</option>
                <option value="Pending Noted by">Pending Noted by</option>
                <option value="Pending Recommending">Pending Recommending</option>
                <option value="Pending Approver">Pending Approver</option>
              </select>
            </div>
          </div>

          <div data-tutorial="requests-list" className="glass-card-body p-0">
            {loading ? (
              <div className="loading-spinner"><div className="spinner"></div></div>
            ) : requests.length === 0 ? (
              <div className="empty-state flex flex-col items-center justify-center py-16 text-center">
                <Clock size={48} className="text-muted mb-4 opacity-50" />
                <h3 className="text-lg font-medium text-white mb-2">No Requests Found</h3>
                <p className="text-sm text-muted">You haven't filed any leave requests matching the selected filter.</p>
              </div>
            ) : (
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date Filed</th>
                      <th>Leave Type</th>
                      <th>Request</th>
                      <th>Date Range</th>
                      <th>Duration</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map(r => (
                      <tr key={r.id}>
                        <td>{new Date(r.dateFiled).toLocaleDateString()}</td>
                        <td>
                          <div className="font-bold">{r.leaveTypeCode}{r.balanceDeductionLeaveTypeCode && <span className="text-xs text-muted"> · charged to {r.balanceDeductionLeaveTypeCode}</span>}{r.leaveTypeCode.toUpperCase() === 'UT' && <span className="text-xs text-warning"> · unpaid UT (not leave)</span>}</div>
                          <div className="text-xs text-muted">{r.leaveTypeDescription}</div>
                        </td>
                        <td>{r.requestKind === 'Cancellation' ? 'Cancellation' : r.requestKind === 'Reschedule' ? 'Reschedule' : 'Leave'}</td>
                        <td>
                          {new Date(r.dateFrom).toLocaleDateString()}
                          {r.dateFrom !== r.dateTo && ` - ${new Date(r.dateTo).toLocaleDateString()}`}
                        </td>
                        <td>{r.totalHours > 0 ? `${r.totalHours}h` : `${r.totalDays}d`}</td>
                        <td><span className={`badge ${leaveStatusBadgeClass(r.status)}`}><span className="badge-dot"></span>{leaveStatusLabel(r.status, r.requestKind)}</span></td>
                        <td style={{ textAlign: 'right' }}>
                          {r.status.startsWith('Pending') && (!r.requestKind || r.requestKind === 'Leave') && (
                            <button 
                              className="btn btn-ghost btn-sm text-danger mr-2" 
                              onClick={() => handleDelete(r.id)}
                              title="Delete Request"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                          {r.status === 'Approved' && !r.rescheduledToRequestId && (!r.requestKind || r.requestKind === 'Leave') && canRequestLeaveChange(r.leaveTypeCode) && leaveChangeDateIsOpen(r.dateTo) && (
                            <>
                              <button className="btn btn-outline btn-sm mr-2" onClick={() => navigate(`/leave/${r.id}?action=reschedule`)} title="Request rescheduling">
                                <CalendarClock size={14} /> Reschedule
                              </button>
                              <button className="btn btn-outline btn-sm text-danger mr-2" onClick={() => { setCancellationTarget(r); setCancellationReason(''); }} title="Cancel approved leave">
                                <Ban size={14} /> Cancel
                              </button>
                            </>
                          )}
                          {r.status === 'Approved' && r.rescheduledToRequestId && (!r.requestKind || r.requestKind === 'Leave') && (
                            r.pendingChangeKind === 'Cancellation' ? <button className="btn btn-outline btn-sm text-danger mr-2" onClick={() => { setCancellationTarget(r); setCancellationReason(''); }}><Ban size={14}/> Complete Cancellation</button> : <span className="text-xs text-muted mr-3">Change pending/processed</span>
                          )}
                          <button className="btn btn-outline btn-sm" onClick={() => navigate(`/leave/${r.id}`)}>
                            <Eye size={14} /> View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {cancellationTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" role="dialog" aria-modal="true" aria-labelledby="cancel-request-title">
          <div className="glass-card w-full max-w-lg">
            <div className="glass-card-header flex items-center justify-between">
              <div><h2 id="cancel-request-title">Cancel Approved Leave</h2><p className="text-sm text-muted mt-1">Cancellation takes effect immediately. Your approvers will be notified.</p></div>
              <button className="btn btn-ghost btn-sm" onClick={() => setCancellationTarget(null)} aria-label="Close"><X size={18}/></button>
            </div>
            <form className="glass-card-body" onSubmit={submitCancellation}>
              <div className="alert alert-info mb-4">Your approved leave and balance will be updated immediately. This action cannot be undone.</div>
              <div className="form-group">
                <label className="form-label" htmlFor="cancellation-reason">Reason for cancellation</label>
                <textarea id="cancellation-reason" className="form-textarea" rows={4} maxLength={500} required autoFocus value={cancellationReason} onChange={event => setCancellationReason(event.target.value)} placeholder="Explain why this approved leave should be cancelled..." />
                <div className="text-xs text-muted text-right mt-1">{cancellationReason.length}/500</div>
              </div>
              <div className="flex justify-end gap-3 mt-5">
                <button type="button" className="btn btn-outline" disabled={submittingCancellation} onClick={() => setCancellationTarget(null)}>Keep Leave</button>
                <button type="submit" className="btn btn-primary" disabled={submittingCancellation || !cancellationReason.trim()}>{submittingCancellation ? 'Cancelling...' : 'Confirm Cancellation'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

