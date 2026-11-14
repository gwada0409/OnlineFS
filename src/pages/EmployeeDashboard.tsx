import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LeaveAPI, ApprovalAPI, getApiErrorMessage, type LeaveBalance, type LeaveRequest, type LeaveRequestDetail, type DashboardStats, type PendingApproval, type HREmployee } from '../lib/api';
import { CalendarDays, FileText, CheckCircle, Clock, Plus, TrendingUp, CheckSquare, LayoutDashboard, ClipboardList, X, Paperclip } from 'lucide-react';
import { LeaveSummaryForm } from '../components/LeaveSummaryForm';
import { DialogOverlay } from '../components/ui/DialogOverlay';
import { PageError, PageLoading } from '../components/ui/PageState';
import { useLatestRequest } from '../hooks/useLatestRequest';
import { NotificationService } from '../services/notificationService';
import { isApprovedLeaveForYear, isPendingLeaveStatus, leaveStatusBadgeClass, leaveStatusLabel } from '../lib/statusFormat';
import { AttachmentPreviewModal } from '../components/AttachmentPreviewModal';
import { approvalStageLabel } from '../lib/approvalLabels';
import { ApprovalRequestCard } from '../components/ApprovalRequestCard';
import { LeaveRequestConversation } from '../components/LeaveRequestConversation';

export const EmployeeDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { canViewPendingApprovals } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentRequests, setRecentRequests] = useState<LeaveRequest[]>([]);
  const [allRequests, setAllRequests] = useState<LeaveRequest[]>([]);
  const [employeeProfile, setEmployeeProfile] = useState<HREmployee | null>(null);
  const [showLeaveSummary, setShowLeaveSummary] = useState(false);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [overviewModal, setOverviewModal] = useState<'pending' | 'approved' | 'balances' | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequestDetail | LeaveRequest | null>(null);
  const [requestLoading, setRequestLoading] = useState(false);
  const [conversationReload, setConversationReload] = useState(0);
  const [selectedAttachment, setSelectedAttachment] = useState<any | null>(null);
  const [attachmentBlobUrl, setAttachmentBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [requestError, setRequestError] = useState('');
  const dashboardRequest = useLatestRequest();
  const detailRequest = useLatestRequest();

  useEffect(() => {
    void loadData();
    const unsubscribe = NotificationService.subscribe(notification => {
      if (!notification || notification.type.includes('Leave') || notification.type.includes('Approval')) void loadData(false);
    });
    const onVisibility = () => { if (document.visibilityState === 'visible') void loadData(false); };
    const unsubscribeOrganization = NotificationService.subscribeOrganizationChanges(() => { void loadData(false); });
    document.addEventListener('visibilitychange', onVisibility);
    return () => { unsubscribe(); unsubscribeOrganization(); document.removeEventListener('visibilitychange', onVisibility); };
  }, [canViewPendingApprovals]);

  const loadData = useCallback(async (showLoading = true) => {
    const request = dashboardRequest.begin();
    if (showLoading) setLoading(true);
    try {
      const promises: [Promise<DashboardStats>, Promise<LeaveRequest[]>, Promise<LeaveBalance[]>, Promise<HREmployee>, Promise<PendingApproval[]>?] = [
        LeaveAPI.getDashboardStats(),
        LeaveAPI.getMyRequests(),
        LeaveAPI.getBalance(),
        LeaveAPI.getMyProfile()
      ];
      if (canViewPendingApprovals) {
        promises.push(ApprovalAPI.getPending());
      }
      const [statsData, requests, bal, profile, pending] = await Promise.all(promises);
      if (!dashboardRequest.isCurrent(request)) return;
      setStats(statsData);
      setAllRequests(requests);
      setRecentRequests(requests.slice(0, 5));
      setBalances(bal);
      setEmployeeProfile(profile);
      if (pending) {
        setPendingApprovals(pending);
      }
      setLoadError('');
    } catch (e) {
      if (dashboardRequest.isCurrent(request)) setLoadError(getApiErrorMessage(e, 'Check your connection and try again.'));
    } finally {
      if (dashboardRequest.isCurrent(request)) setLoading(false);
    }
  }, [canViewPendingApprovals, dashboardRequest]);

  const openRequest = async (request: LeaveRequest | number) => {
    const id = typeof request === 'number' ? request : request.id;
    const version = detailRequest.begin();
    setSelectedRequest(typeof request === 'number' ? ({ id } as LeaveRequest) : request);
    setRequestLoading(true);
    setRequestError('');
    try {
      const detail = await LeaveAPI.getRequest(id);
      if (detailRequest.isCurrent(version)) setSelectedRequest(detail);
    } catch (error) {
      if (detailRequest.isCurrent(version)) setRequestError(getApiErrorMessage(error, 'Could not load request details.'));
    } finally {
      if (detailRequest.isCurrent(version)) setRequestLoading(false);
    }
  };

  const openAttachment = async (attachment: any) => {
    try {
      const blob = await LeaveAPI.getAttachment(attachment.id);
      if (attachmentBlobUrl) URL.revokeObjectURL(attachmentBlobUrl);
      setAttachmentBlobUrl(URL.createObjectURL(blob));
      setSelectedAttachment(attachment);
    } catch (error) {
      setRequestError(getApiErrorMessage(error, 'Unable to open the attachment.'));
    }
  };

  const closeAttachment = () => {
    if (attachmentBlobUrl) URL.revokeObjectURL(attachmentBlobUrl);
    setAttachmentBlobUrl(null);
    setSelectedAttachment(null);
  };

  const pendingRequests = allRequests.filter(request => isPendingLeaveStatus(request.status));
  const combinedBalance = balances.find(b => b.leaveTypeCode === 'NPL');
  const approvedRequests = allRequests.filter(request => combinedBalance
    ? request.status === 'Approved' && request.requestKind !== 'Cancellation' && request.leaveTypeCode !== 'UT'
      && request.dateFrom.slice(0, 10) >= `${combinedBalance.year}-11-01` && request.dateFrom.slice(0, 10) < `${combinedBalance.year + 1}-11-01`
    : isApprovedLeaveForYear(request, new Date().getFullYear()));
  const approvedDaysThisYear = approvedRequests.reduce((total, request) => total + request.totalDays, 0);
  const approvedDaysLabel = Number.isInteger(approvedDaysThisYear)
    ? approvedDaysThisYear.toFixed(0)
    : approvedDaysThisYear.toFixed(1);

  if (loading) return <PageLoading label="Loading employee dashboard"/>;
  if (loadError && !stats) return <PageError message={loadError} onRetry={() => void loadData()}/>;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <LayoutDashboard size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-tight">Dashboard</h1>
              <p className="text-xs text-text-secondary mt-0.5">Welcome back! Here's your leave overview.</p>
            </div>
          </div>
          <button className="btn btn-primary flex items-center gap-2" onClick={() => navigate('/file-leave')}>
            <Plus size={16} /> File Leave
          </button>
        </div>
      </div>

      <div className="page-body">
        {loadError && <div className="alert alert-danger mb-4" role="alert">Some dashboard information could not be refreshed. <button className="btn btn-sm btn-outline ml-2" onClick={() => void loadData(false)}>Retry</button></div>}
        {/* Pending Approval Section - Only rendered for Approvers */}
        {canViewPendingApprovals && (
          <div className="glass-card mb-6">
            <div className="glass-card-header flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CheckSquare size={18} className="text-warning shrink-0" />
                <h2 className="text-base font-bold flex items-center gap-2">
                  Pending Approvals
                </h2>
                <span className="badge badge-pending text-xs">{pendingApprovals.length} Pending</span>
              </div>
              <button className="btn btn-outline btn-sm flex items-center gap-1.5" onClick={() => navigate('/approvals')}>
                View All Approvals
              </button>
            </div>
            <div className="glass-card-body p-0">
              {pendingApprovals.length === 0 ? (
                <div className="flex items-center gap-3 px-5 py-4 text-sm">
                  <CheckSquare size={21} className="text-success shrink-0" />
                  <span className="text-muted">No requests need your approval right now.</span>
                </div>
              ) : (
                <>
                  <div className="approval-mobile-list" aria-label="Pending approvals">
                    {pendingApprovals.slice(0, 5).map(p => <ApprovalRequestCard key={p.approvalStepId} request={p} onOpen={() => navigate(`/leave/${p.leaveRequestId}`)} />)}
                  </div>
                <div className="data-table-wrapper approval-desktop-table">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Leave Type</th>
                        <th>Date Range</th>
                        <th>Duration</th>
                        <th>Step Label</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingApprovals.map(p => (
                        <tr key={p.approvalStepId}>
                          <td>
                            <div className="font-bold">{p.employeeName}</div>
                            <div className="text-xs text-muted">{p.department}</div>
                          </td>
                          <td>
                            <div className="font-bold text-primary">{p.leaveTypeCode}{p.balanceDeductionLeaveTypeCode && <span className="block text-xs text-muted">Deduct from {p.balanceDeductionLeaveTypeCode}</span>}{p.leaveTypeCode.toUpperCase() === 'UT' && <span className="block text-xs text-warning">Unpaid UT</span>}</div>
                            <div className="text-xs text-muted">{p.leaveTypeDescription}</div>
                          </td>
                          <td>{new Date(p.dateFrom).toLocaleDateString()} - {new Date(p.dateTo).toLocaleDateString()}</td>
                          <td>{p.totalHours > 0 ? `${p.totalHours}h` : `${p.totalDays}d`}</td>
                          <td><span className="badge badge-pending">{approvalStageLabel(p.stepLabel, p.stepOrder ? p.stepOrder - 1 : undefined)}</span></td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <button className="btn btn-outline btn-sm" onClick={() => navigate('/approvals')}>
                              Review
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
        )}

        {/* Stat Cards */}
        <div className="stat-grid">
          <button type="button" className="stat-card text-left cursor-pointer hover:border-primary transition-colors" onClick={() => setOverviewModal('pending')} style={{ '--accent-color': 'var(--warning)' } as React.CSSProperties}>
            <div className="stat-card-icon" style={{ background: 'var(--warning-light)', color: 'var(--warning)' }}>
              <Clock size={22} />
            </div>
            <div className="stat-card-value">{stats?.pendingRequests ?? 0}</div>
            <div className="stat-card-label">Pending Requests</div>
          </button>
          <button type="button" className="stat-card text-left cursor-pointer hover:border-primary transition-colors" onClick={() => setOverviewModal('approved')} style={{ '--accent-color': 'var(--success)' } as React.CSSProperties}>
            <div className="stat-card-icon" style={{ background: 'var(--success-light)', color: 'var(--success)' }}>
              <CheckCircle size={22} />
            </div>
            <div className="stat-card-value">{approvedDaysLabel}</div>
            <div className="stat-card-label">Approved Leave Days</div>
            <div className="text-xs text-muted mt-1">{stats?.approvedThisYear ?? approvedRequests.length} approved request{(stats?.approvedThisYear ?? approvedRequests.length) === 1 ? '' : 's'} this year</div>
          </button>
          <button type="button" className="stat-card text-left cursor-pointer hover:border-primary transition-colors" onClick={() => setOverviewModal('balances')} style={{ '--accent-color': 'var(--primary)' } as React.CSSProperties}>
            <div className="stat-card-icon" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
              <TrendingUp size={22} />
            </div>
            <div className="stat-card-value">
              {stats?.balances?.reduce((sum, b) => sum + b.available, 0)?.toFixed(0) ?? 0}
            </div>
            <div className="stat-card-label">Total Available Days</div>
          </button>
        </div>

        {balances.some(b => b.leaveTypeCode === 'NPL') && <section className="glass-card p-4 space-y-2" aria-label="Newcomer paid leave policy"><h2>Combined paid leave · 25-day maximum</h2><p>Your policy year runs November 1–October 31. Unused credits carry into your next HR allocation, capped at 25 days. HR confirms whether disapproved or voided leave was taken with pay; paid exceptions deduct credits and require disciplinary review.</p></section>}
        {combinedBalance && allRequests.some(r => r.hrConfirmedPaidException) && <section className="glass-card p-4 space-y-2" aria-label="HR-confirmed paid exceptions"><h2>HR-confirmed paid leave</h2><p className="text-sm text-muted">These days were deducted from your combined credits. Their approval status remains unchanged and disciplinary review is required.</p>{allRequests.filter(r => r.hrConfirmedPaidException).map(r => <button key={r.id} className="btn btn-outline min-h-11 w-full" onClick={() => void openRequest(r)}>Request #{r.id} · {r.totalDays} days · {r.status} · Paid</button>)}</section>}
        {/* Leave Balances */}
        <div className="glass-card mb-6">
          <div className="glass-card-header flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CalendarDays size={18} className="text-primary shrink-0" />
              <h2 className="text-base font-bold">Leave Balances</h2>
            </div>
            <button className="btn btn-outline btn-sm flex items-center gap-1.5" disabled={!employeeProfile} onClick={() => setShowLeaveSummary(true)}>
              <ClipboardList size={15} /> View Leave Summary
            </button>
          </div>
          <div className="glass-card-body">
            <div className="balance-grid">
              {balances.filter(b => b.totalCredits > 0 || b.used > 0 || b.carryOver > 0).map(b => {
                const total = b.totalCredits + b.carryOver;
                const pct = total > 0 ? Math.min(100, ((total - b.available) / total) * 100) : 0;
                return (
                  <button type="button" className="balance-card text-left cursor-pointer" key={b.id} onClick={() => setOverviewModal('balances')}>
                    <div className="balance-card-code">{b.leaveTypeCode}</div>
                    <div className="balance-card-value">{b.available.toFixed(1)}</div>
                    <div className="balance-card-label">Available of {total.toFixed(0)}</div>
                    <div className="balance-bar">
                      <div className="balance-bar-fill" style={{
                        width: `${pct}%`,
                        background: pct > 80 ? 'var(--danger)' : pct > 50 ? 'var(--warning)' : 'linear-gradient(90deg, var(--primary), var(--info))'
                      }} />
                    </div>
                    <div className="text-xs text-muted mt-2">
                      Used: {b.used.toFixed(1)} | Pending: {b.pending.toFixed(1)}
                    </div>
                  </button>
                );
              })}
              {balances.filter(b => b.totalCredits > 0 || b.used > 0 || b.carryOver > 0).length === 0 && (
                <div className="empty-state py-8 flex flex-col items-center justify-center text-center" style={{ gridColumn: '1 / -1' }}>
                  <CalendarDays size={40} className="text-muted opacity-50 mb-2" />
                  <h3 className="font-bold text-base">No Leave Balances</h3>
                  <p className="text-xs text-muted">Your leave balances will appear here once HR sets them up.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Requests */}
        <div data-tutorial="dashboard-recent" className="glass-card">
          <div className="glass-card-header flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <FileText size={18} className="text-info shrink-0" />
              <h2 className="text-base font-bold">Recent Requests</h2>
            </div>
            <button className="btn btn-outline btn-sm flex items-center gap-1.5" onClick={() => navigate('/my-requests')}>View All</button>
          </div>
          <div className="glass-card-body">
            {recentRequests.length === 0 ? (
              <div className="empty-state">
                <FileText size={48} />
                <h3>No Leave Requests</h3>
                <p>You haven't filed any leave requests yet.</p>
              </div>
            ) : (
              <div className="data-table-wrapper">
                <table className="data-table mobile-record-table" role="table">
                  <thead>
                    <tr>
                      <th scope="col">Date Filed</th>
                      <th scope="col">Type</th>
                      <th scope="col">Date From</th>
                      <th scope="col">Date To</th>
                      <th scope="col">Days/Hrs</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentRequests.map(r => (
                      <tr key={r.id} tabIndex={0} role="button" aria-label={`View ${r.leaveTypeCode} request filed ${new Date(r.dateFiled).toLocaleDateString()}`} style={{ cursor: 'pointer' }} onClick={() => openRequest(r)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); void openRequest(r); } }} title="View request details">
                        <td data-label="Date Filed">{new Date(r.dateFiled).toLocaleDateString()}</td>
                        <td data-label="Type"><span className="font-bold">{r.leaveTypeCode}{r.balanceDeductionLeaveTypeCode && <span className="block text-xs text-muted">From {r.balanceDeductionLeaveTypeCode}</span>}{r.leaveTypeCode.toUpperCase() === 'UT' && <span className="block text-xs text-warning">Unpaid UT</span>}</span></td>
                        <td data-label="Date From">{new Date(r.dateFrom).toLocaleDateString()}</td>
                        <td data-label="Date To">{new Date(r.dateTo).toLocaleDateString()}</td>
                        <td data-label="Days/Hrs">{r.totalHours > 0 ? `${r.totalHours}h` : `${r.totalDays}d`}</td>
                        <td data-label="Status"><span className={`badge ${leaveStatusBadgeClass(r.status)}`}><span className="badge-dot"></span>{leaveStatusLabel(r.status, r.requestKind)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
      {showLeaveSummary && employeeProfile && <LeaveSummaryForm employee={employeeProfile} balances={balances} requests={allRequests} onClose={() => setShowLeaveSummary(false)} />}

      {overviewModal && (
        <DialogOverlay onClose={() => setOverviewModal(null)} label={overviewModal === 'pending' ? 'Pending requests' : overviewModal === 'approved' ? 'Approved requests this year' : 'Leave balances'} closeOnBackdrop closeOnEscape>
          <div className="modal-content animate-slide-up" style={{ maxWidth: 820 }}>
            <div className="modal-header">
              <div><h2>{overviewModal === 'pending' ? 'Pending Requests' : overviewModal === 'approved' ? 'Approved Requests This Year' : 'Available Leave Balances'}</h2><p className="text-xs text-muted mt-1">{overviewModal === 'balances' ? 'Your current credits, usage, pending credits, and availability.' : overviewModal === 'approved' ? `${approvedDaysLabel} approved leave day${approvedDaysThisYear === 1 ? '' : 's'} across ${approvedRequests.length} request${approvedRequests.length === 1 ? '' : 's'}.` : 'Select a request to view its complete details.'}</p></div>
              <button className="modal-close" aria-label="Close overview" onClick={() => setOverviewModal(null)}><X size={20} /></button>
            </div>
            {overviewModal === 'balances' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {balances.filter(balance => balance.totalCredits > 0 || balance.used > 0 || balance.carryOver > 0).map(balance => <div key={balance.id} className="p-4 rounded-lg border border-border"><div className="font-bold text-primary mb-2">{balance.leaveTypeCode}</div><div className="grid grid-cols-2 gap-2 text-sm"><span className="text-muted">Total credits</span><strong>{(balance.totalCredits + balance.carryOver).toFixed(1)}</strong><span className="text-muted">Used</span><strong>{balance.used.toFixed(1)}</strong><span className="text-muted">Pending</span><strong>{balance.pending.toFixed(1)}</strong><span className="text-muted">Available</span><strong className="text-success">{balance.available.toFixed(1)}</strong></div></div>)}
              </div>
            ) : (() => {
              const requests = overviewModal === 'pending' ? pendingRequests : approvedRequests;
              return requests.length === 0 ? <div className="empty-state py-8"><FileText size={40}/><h3>No requests found</h3></div> : <div className="data-table-wrapper"><table className="data-table mobile-record-table" role="table"><thead><tr><th scope="col">Date Filed</th><th scope="col">Type</th><th scope="col">Date Range</th><th scope="col">Duration</th><th scope="col">Status</th></tr></thead><tbody>{requests.map(request => <tr key={request.id} className="cursor-pointer" onClick={() => openRequest(request)} title="View request details"><td data-label="Date Filed">{new Date(request.dateFiled).toLocaleDateString()}</td><td data-label="Type"><strong>{request.leaveTypeCode}</strong></td><td data-label="Date Range">{new Date(request.dateFrom).toLocaleDateString()} – {new Date(request.dateTo).toLocaleDateString()}</td><td data-label="Duration">{request.totalHours > 0 ? `${request.totalHours}h` : `${request.totalDays}d`}</td><td data-label="Status"><span className={`badge ${leaveStatusBadgeClass(request.status)}`}>{leaveStatusLabel(request.status, request.requestKind)}</span></td></tr>)}</tbody></table></div>;
            })()}
          </div>
        </DialogOverlay>
      )}

      {selectedRequest && (
        <DialogOverlay onClose={() => setSelectedRequest(null)} label="Leave request details" closeOnBackdrop closeOnEscape>
          <div className="modal-content animate-slide-up" style={{ maxWidth: 760 }}>
            <div className="modal-header"><div><h2>Leave Request Details</h2><p className="text-xs text-muted mt-1">Review this request without leaving the dashboard.</p></div><button className="modal-close" aria-label="Close request details" onClick={() => setSelectedRequest(null)}><X size={20}/></button></div>
            {requestLoading ? <PageLoading label="Loading request details"/> : requestError ? <PageError message={requestError} onRetry={() => void openRequest(selectedRequest.id)}/> : <div className="space-y-5 overflow-y-auto min-h-0 pr-1 overscroll-contain">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm"><div><span className="text-muted block text-xs">Date Filed</span><strong>{new Date(selectedRequest.dateFiled).toLocaleString()}</strong></div><div><span className="text-muted block text-xs">Status</span><span className={`badge ${leaveStatusBadgeClass(selectedRequest.status)}`}>{leaveStatusLabel(selectedRequest.status, selectedRequest.requestKind)}</span></div><div><span className="text-muted block text-xs">Leave Type</span><strong>{selectedRequest.leaveTypeCode || (selectedRequest as any).leaveType?.code || '—'}{(selectedRequest.leaveTypeDescription || (selectedRequest as any).leaveType?.description) ? ` — ${selectedRequest.leaveTypeDescription || (selectedRequest as any).leaveType?.description}` : ''}</strong>{'balanceDeductionLeaveType' in selectedRequest && selectedRequest.balanceDeductionLeaveType && <div>Deduct from: <strong>{selectedRequest.balanceDeductionLeaveType.code}</strong></div>}{selectedRequest.leaveTypeCode?.toUpperCase() === 'UT' && <div className="text-warning">Unpaid UT — no leave deduction</div>}</div><div><span className="text-muted block text-xs">Leave Dates</span><strong>{new Date(selectedRequest.dateFrom).toLocaleDateString()} – {new Date(selectedRequest.dateTo).toLocaleDateString()}</strong></div><div><span className="text-muted block text-xs">{selectedRequest.totalHours > 0 ? 'Time of Leave' : 'Duration'}</span><strong>{selectedRequest.totalHours > 0 ? `${selectedRequest.halfDayTime || ''} · ${selectedRequest.totalHours} hours` : `${selectedRequest.totalDays} ${selectedRequest.totalDays === 1 ? 'day' : 'days'}`}</strong></div></div>
              <div className="p-4 rounded-lg border border-border bg-base/40"><span className="text-muted block text-xs mb-1">Reason</span><p className="whitespace-pre-wrap">{selectedRequest.reason || 'No reason provided.'}</p></div>
              <div><h3 className="mb-2">Attachments</h3>{(selectedRequest as any).attachments?.length?<div className="grid sm:grid-cols-2 gap-2">{(selectedRequest as any).attachments.map((attachment:any)=><button type="button" key={attachment.id} className="flex items-center gap-3 text-left p-3 rounded-lg border border-border bg-base/40 hover:border-primary min-w-0" onClick={()=>void openAttachment(attachment)}><Paperclip size={17} className="text-primary shrink-0"/><span className="min-w-0"><strong className="block truncate">{attachment.fileName}</strong><small className="text-muted">{(attachment.fileSize/1024).toFixed(1)} KB · Tap to preview</small></span></button>)}</div>:<p className="text-sm text-muted p-3 rounded-lg border border-border">No attachments submitted.</p>}</div>
              {selectedRequest.approvalSteps?.length ? <div><h3 className="mb-2">Approval Progress</h3><div className="space-y-2">{selectedRequest.approvalSteps.map((step,index) => <div key={step.id || step.stepOrder} className="grid grid-cols-[32px_minmax(0,1fr)] gap-3 p-3 rounded-lg border border-border text-sm"><span className="w-8 h-8 rounded-full bg-primary/10 text-primary grid place-items-center font-bold">{index+1}</span><div className="min-w-0"><div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"><strong>{approvalStageLabel(step.stepLabel, index)}</strong><span className={`badge ${step.action==='Approved'?'badge-approved':step.action==='Disapproved'?'badge-rejected':step.action==='Skipped'?'badge-cancelled':'badge-pending'} self-start`}>{step.action}</span></div><div className="text-muted mt-1 break-words">{step.approverName || 'Approver not assigned'}</div>{step.actionDate&&<div className="text-xs text-muted mt-1">{new Date(step.actionDate).toLocaleString()}</div>}</div></div>)}</div></div> : null}
              {('employee' in selectedRequest) && <LeaveRequestConversation key={conversationReload} request={selectedRequest as LeaveRequestDetail} onUpdated={() => { setConversationReload(value => value + 1); void openRequest(selectedRequest.id); }} onOpenAttachment={openAttachment} />}
              <div className="flex justify-end border-t border-border pt-4"><button className="btn btn-outline" onClick={() => setSelectedRequest(null)}>Close</button></div>
            </div>}
          </div>
        </DialogOverlay>
      )}
      <AttachmentPreviewModal isOpen={Boolean(selectedAttachment)} onClose={closeAttachment} attachment={selectedAttachment} blobUrl={attachmentBlobUrl}/>
    </div>
  );
};

