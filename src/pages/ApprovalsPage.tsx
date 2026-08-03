import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApprovalAPI, getApiErrorMessage, type PendingApproval } from '../lib/api';
import { CheckSquare, Check, X, Eye } from 'lucide-react';
import { useToast } from '../components/ToastProvider';

export const ApprovalsPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [pending, setPending] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [selectedRequest, setSelectedRequest] = useState<PendingApproval | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'disapprove' | null>(null);
  const [remarks, setRemarks] = useState('');
  const [reasonForRejection, setReasonForRejection] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadPending();
  }, []);

  const loadPending = async () => {
    setLoading(true);
    try {
      const data = await ApprovalAPI.getPending();
      setPending(data);
    } catch (e) {
      console.error(e);
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
        await ApprovalAPI.approve(selectedRequest.leaveRequestId, { remarks });
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

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1>Pending Approvals</h1>
        <p>Review and act on leave requests pending your approval</p>
      </div>

      <div className="page-body">
        <div className="glass-card">
          <div className="glass-card-header">
            <h2><CheckSquare size={18} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />Requests Requiring Your Action</h2>
          </div>
          <div className="glass-card-body p-0">
            {loading ? (
              <div className="loading-spinner"><div className="spinner"></div></div>
            ) : pending.length === 0 ? (
              <div className="empty-state">
                <CheckSquare size={48} />
                <h3>All Caught Up!</h3>
                <p>You have no pending leave requests to approve.</p>
              </div>
            ) : (
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Leave Type</th>
                      <th>Date Range</th>
                      <th>Duration</th>
                      <th>Action Required As</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pending.map(p => (
                      <tr key={p.approvalStepId}>
                        <td>
                          <div className="font-bold">{p.employeeName}</div>
                          <div className="text-xs text-muted">{p.department}</div>
                        </td>
                        <td>
                          <div className="font-bold text-primary">{p.leaveTypeCode}</div>
                          <div className="text-xs text-muted">{p.leaveTypeDescription}</div>
                        </td>
                        <td>{new Date(p.dateFrom).toLocaleDateString()} - {new Date(p.dateTo).toLocaleDateString()}</td>
                        <td>{p.totalHours > 0 ? `${p.totalHours}h` : `${p.totalDays}d`}</td>
                        <td><span className="badge badge-pending">{p.stepLabel}</span></td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button className="btn btn-ghost text-primary p-2 mr-1" onClick={() => navigate(`/leave/${p.leaveRequestId}`)} title="View Details">
                            <Eye size={18} />
                          </button>
                          <button className="btn btn-ghost text-success p-2 mr-1" onClick={() => { setSelectedRequest(p); setActionType('approve'); setRemarks(''); }} title="Approve">
                            <Check size={18} />
                          </button>
                          <button className="btn btn-ghost text-danger p-2" onClick={() => { setSelectedRequest(p); setActionType('disapprove'); setRemarks(''); setReasonForRejection(''); }} title="Disapprove">
                            <X size={18} />
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

      {/* Action Modal */}
      {selectedRequest && actionType && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => setSelectedRequest(null)} />
          <div className="modal-content animate-slide-up">
            <div className="modal-header">
              <h2>{actionType === 'approve' ? 'Approve' : 'Disapprove'} Leave Request</h2>
              <button className="modal-close" onClick={() => setSelectedRequest(null)}><X size={20} /></button>
            </div>
            <form onSubmit={handleAction}>
              <div className="mb-4">
                <div className="text-sm">Action for: <strong>{selectedRequest.employeeName}</strong></div>
                <div className="text-sm">Leave Type: {selectedRequest.leaveTypeCode} ({selectedRequest.totalHours > 0 ? `${selectedRequest.totalHours}h` : `${selectedRequest.totalDays}d`})</div>
              </div>

              <div className="form-group">
                <label className="form-label">Remarks (Optional)</label>
                <textarea className="form-textarea" value={remarks} onChange={e => setRemarks(e.target.value)} rows={3} placeholder="Add any comments here..." />
              </div>

              {actionType === 'disapprove' && (
                <div className="form-group">
                  <label className="form-label">Reason for Disapproval <span className="text-danger">*</span></label>
                  <textarea className="form-textarea" value={reasonForRejection} onChange={e => setReasonForRejection(e.target.value)} rows={3} required placeholder="State the reason for rejection..." />
                </div>
              )}

              <div className="flex justify-end gap-2 mt-6">
                <button type="button" className="btn btn-outline" onClick={() => setSelectedRequest(null)}>Cancel</button>
                <button type="submit" className={`btn ${actionType === 'approve' ? 'btn-success' : 'btn-danger'}`} disabled={submitting}>
                  {submitting ? 'Processing...' : actionType === 'approve' ? 'Confirm Approval' : 'Confirm Disapproval'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
