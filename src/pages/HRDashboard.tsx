import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HRAPI, LeaveAPI, ApprovalAPI, getApiErrorMessage } from '../lib/api';
import { FileBarChart, X, CheckSquare, LayoutDashboard, Download, Eye, Clock, Paperclip, BellRing } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ToastProvider';
import { DialogOverlay } from '../components/ui/DialogOverlay';
import { NotificationService } from '../services/notificationService';
import { PageError, PageLoading } from '../components/ui/PageState';
import { useLatestRequest } from '../hooks/useLatestRequest';
import { AttachmentPreviewModal } from '../components/AttachmentPreviewModal';
import { approvalStageLabel } from '../lib/approvalLabels';
import { ReportDesigner } from '../components/ReportDesigner';
import { useConfirm } from '../components/ConfirmDialog';

const formatRequestDuration = (request: { totalDays?: number; totalHours?: number }) => {
  const hours = Number(request.totalHours) || 0;
  if (hours > 0) return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  const days = Number(request.totalDays) || 0;
  return `${days} ${days === 1 ? 'day' : 'days'}`;
};

export const HRDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState<'overview' | 'ledger' | 'company-pending' | 'reports'>('overview');
  const [summary, setSummary] = useState<any>(null);
  const [overviewError, setOverviewError] = useState(false);
  const [ledger, setLedger] = useState<any[]>([]);
  const [companyPending, setCompanyPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const loadRequest = useLatestRequest();

  // Finalize Request State
  const [finalizingRequest, setFinalizingRequest] = useState<any | null>(null);
  const [viewingRequest, setViewingRequest] = useState<any | null>(null);
  const [viewingRequestLoading, setViewingRequestLoading] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<any | null>(null);
  const [attachmentBlobUrl, setAttachmentBlobUrl] = useState<string | null>(null);
  const [overviewModal, setOverviewModal] = useState<{ kind: 'pending' | 'on-leave' | 'low-balance' | 'decisions'; title: string; items: any[] } | null>(null);
  const [overviewModalLoading, setOverviewModalLoading] = useState(false);
  const [finalizeForm, setFinalizeForm] = useState({ notedByHR: '', hrRemarks: '' });

  const [reportDateFrom, setReportDateFrom] = useState('');
  const [reportDateTo, setReportDateTo] = useState('');

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
    setFinalizeForm(prev => ({ ...prev, notedByHR: user?.username || '' }));
  }, [activeTab]);

  useEffect(() => {
    const refresh = () => { void loadData(); };
    const unsubscribeNotifications = NotificationService.subscribe(notification => {
      if (!notification || notification.type.includes('Leave') || notification.type.includes('Approval') || notification.type.includes('HR')) refresh();
    });
    const unsubscribeOrganization = NotificationService.subscribeOrganizationChanges(refresh);
    const onVisibility = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      unsubscribeNotifications();
      unsubscribeOrganization();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [activeTab]);

  const loadData = async () => {
    const request = loadRequest.begin();
    setLoading(true);
    try {
      if (activeTab === 'overview') {
        try {
          const data = await HRAPI.getLeaveSummary();
          if (!loadRequest.isCurrent(request)) return;
          setSummary(data || null);
          setOverviewError(!data);
          setLoadError('');
        } catch (e) {
          console.error("Failed to load overview data:", e);
          if (!loadRequest.isCurrent(request)) return;
          setOverviewError(true);
          setSummary(null);
          setLoadError(getApiErrorMessage(e, 'Could not load the HR overview.'));
        }
      } else if (activeTab === 'ledger') {
        const data = await HRAPI.getFinalizationPending();
        if (!loadRequest.isCurrent(request)) return;
        setLedger(data);
      } else if (activeTab === 'company-pending') {
        const data = await ApprovalAPI.getAllPending();
        if (!loadRequest.isCurrent(request)) return;
        setCompanyPending(data);
      }
      if (loadRequest.isCurrent(request) && activeTab !== 'overview') setLoadError('');
    } catch (e) {
      if (loadRequest.isCurrent(request)) setLoadError(getApiErrorMessage(e, 'Could not load this HR view.'));
    } finally {
      if (loadRequest.isCurrent(request)) setLoading(false);
    }
  };

  const handleFinalizeClick = (request: any) => {
    setFinalizingRequest(request);
    setFinalizeForm({ notedByHR: user?.username || '', hrRemarks: '' });
  };

  const handleViewRequest = async (request: any) => {
    setViewingRequest(request);
    setViewingRequestLoading(true);
    try {
      setViewingRequest(await LeaveAPI.getRequest(request.leaveRequestId || request.id));
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to load request details'));
    } finally {
      setViewingRequestLoading(false);
    }
  };

  const handleViewAttachment = async (attachment: any) => {
    try {
      const blob = await LeaveAPI.getAttachment(attachment.id);
      if (attachmentBlobUrl) URL.revokeObjectURL(attachmentBlobUrl);
      setAttachmentBlobUrl(URL.createObjectURL(blob));
      setSelectedAttachment(attachment);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to open attachment'));
    }
  };

  const closeAttachment = () => {
    if (attachmentBlobUrl) URL.revokeObjectURL(attachmentBlobUrl);
    setAttachmentBlobUrl(null);
    setSelectedAttachment(null);
  };

  const openOverviewModal = async (kind: 'pending' | 'on-leave' | 'low-balance' | 'decisions', title: string) => {
    setOverviewModal({ kind, title, items: [] });
    setOverviewModalLoading(true);
    try {
      let items: any[];
      if (kind === 'pending') {
        items = await ApprovalAPI.getAllPending();
      } else if (kind === 'low-balance') {
        const employees = await HRAPI.getEmployeeBalances();
        items = employees.filter((employee: any) => employee.balances?.some((balance: any) => Number(balance.totalCredits) + Number(balance.carryOver) > 0 && Number(balance.available) < 3));
      } else {
        const requests = await HRAPI.getLeaveLedger();
        const now = new Date();
        if (kind === 'on-leave') {
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
          items = requests.filter((request: any) => request.status === 'Approved' && new Date(request.dateFrom).getTime() <= today && new Date(request.dateTo).getTime() >= today);
        } else {
          items = requests.filter((request: any) => {
            const decisionDate = request.updatedAt || request.dateProcessed ? new Date(request.updatedAt || request.dateProcessed) : null;
            return ['Approved', 'Disapproved'].includes(request.status) && decisionDate?.getMonth() === now.getMonth() && decisionDate?.getFullYear() === now.getFullYear();
          });
        }
      }
      setOverviewModal(current => current?.kind === kind ? { ...current, items } : current);
    } catch (error) {
      toast.error(getApiErrorMessage(error, `Failed to load ${title.toLowerCase()}`));
      setOverviewModal(null);
    } finally {
      setOverviewModalLoading(false);
    }
  };

  const handleFinalizeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!finalizingRequest) return;

    setSubmitting(true);
    try {
      await HRAPI.finalize(finalizingRequest.leaveRequestId || finalizingRequest.id, finalizeForm);
      setFinalizingRequest(null);
      toast.success('Leave request finalized successfully');
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data || 'Failed to finalize request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadAnnualReport = async () => {
    try {
      toast.info('Generating report...');
      if (reportDateFrom && reportDateTo && reportDateFrom > reportDateTo) {
        toast.error('Date To must be on or after Date From.');
        return;
      }
      const response = await HRAPI.exportLeaveReport(new Date().getFullYear(), reportDateFrom || undefined, reportDateTo || undefined);
      const disposition = response.headers['content-disposition'] as string | undefined;
      const encodedName = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
      const quotedName = disposition?.match(/filename="?([^";]+)"?/i)?.[1];
      const filename = encodedName ? decodeURIComponent(encodedName) : quotedName || `Leave_Report_${new Date().getFullYear()}.csv`;
      const url = window.URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
      toast.success('CSV report downloaded.');
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Failed to generate report'));
    }
  };

  const handleNotifyApprover = async (leaveRequestId: number) => {
    if (!await confirm({ title: 'Notify approver', message: 'Send a reminder to the approver assigned to this pending request? Reminders are limited to once every four hours per approval step.', confirmText: 'Send reminder' })) return;
    try { await HRAPI.notifyApprover(leaveRequestId); toast.success('Approver notified.'); }
    catch (error) { toast.error(getApiErrorMessage(error, 'Could not notify the approver.')); }
  };

  return (
    <div className="animate-fade-in hr-page">
      <div className="page-header">
        <h1>HR Administration</h1>
        <p>Review employee leaves, finalize requests, and generate reports</p>
      </div>

      <div className="page-body">
        {/* Tabs */}
        <div className="md:hidden mb-5"><label className="form-label" htmlFor="hr-mobile-section">HR Section</label><select id="hr-mobile-section" className="form-select" value={activeTab} onChange={event => setActiveTab(event.target.value as typeof activeTab)}><option value="overview">Overview</option><option value="ledger">Finalize Requests</option><option value="company-pending">Company Pending</option><option value="reports">Analytics & Reports</option></select></div>
        <div className="hr-desktop-tabs hidden md:flex gap-2 mb-6 border-b scroll-x-auto" style={{ borderColor: 'var(--border)', paddingBottom: 16 }}>
          <button className={`btn ${activeTab === 'overview' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('overview')}>
            <LayoutDashboard size={16} /> Overview
          </button>

          <button className={`btn ${activeTab === 'ledger' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('ledger')}>
            <CheckSquare size={16} /> Finalize Requests
          </button>
          <button className={`btn ${activeTab === 'company-pending' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('company-pending')}>
            <Clock size={16} /> Company Pending
          </button>
          <button className={`btn ${activeTab === 'reports' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('reports')}>
            <FileBarChart size={16} /> Analytics & Reports
          </button>
        </div>

        {loading ? (
          <PageLoading label="Loading HR dashboard"/>
        ) : loadError && activeTab !== 'overview' ? (
          <PageError message={loadError} onRetry={() => void loadData()}/>
        ) : (
          <div className="glass-card">
            {activeTab === 'overview' && (
              <>
                {overviewError || !summary ? (
                  <div className="empty-state-card glass-card">
                    <LayoutDashboard size={48} className="empty-state-icon" />
                    <h3 className="mb-2">{overviewError ? 'Unable to load HR overview data.' : 'No HR overview data available yet.'}</h3>
                    <p className="text-muted mb-6">Use the tools below to manage HR activities.</p>
                    <div className="flex flex-wrap justify-center gap-3">
                      <button className="btn btn-primary min-h-[44px]" onClick={() => navigate('/hr/employment-status')}>Go to Employee Hub</button>
                      <button className="btn btn-outline min-h-[44px]" onClick={() => setActiveTab('ledger')}>Finalize Requests</button>
                      <button className="btn btn-outline min-h-[44px]" onClick={() => setActiveTab('reports')}>Generate Reports</button>
                    </div>
                  </div>
                ) : (
                  <div className="glass-card-body">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  <button type="button" className="stat-card text-left w-full cursor-pointer hover:border-primary transition-colors" onClick={() => openOverviewModal('pending', 'Pending Leave Requests')}>
                    <div className="stat-title">Pending Leave Requests</div>
                    <div className="stat-value text-warning">{summary.totalPending}</div>
                    <div className="text-[11px] text-muted mt-1">Click to view</div>
                  </button>
                  <button type="button" className="stat-card text-left w-full cursor-pointer hover:border-primary transition-colors" onClick={() => openOverviewModal('on-leave', 'Employees on Leave')}>
                    <div className="stat-title">Employees on Leave</div>
                    <div className="stat-value text-info">{summary.employeesOnLeave}</div>
                    <div className="text-[11px] text-muted mt-1">Click to view</div>
                  </button>
                  <button type="button" className="stat-card text-left w-full cursor-pointer hover:border-primary transition-colors" onClick={() => openOverviewModal('low-balance', 'Employees with Low Balance')}>
                    <div className="stat-title">Low Balance (&lt; 3 Days)</div>
                    <div className="stat-value text-danger">{summary.employeesLowBalance}</div>
                    <div className="text-[11px] text-muted mt-1">Click to view</div>
                  </button>
                  <button type="button" className="stat-card text-left w-full cursor-pointer hover:border-primary transition-colors" onClick={() => openOverviewModal('decisions', 'Approved / Rejected This Month')}>
                    <div className="stat-title">Approved / Rejected This Month</div>
                    <div className="stat-value">
                      <span className="text-success">{summary.approvedThisMonth}</span> / <span className="text-danger">{summary.rejectedThisMonth}</span>
                    </div>
                    <div className="text-[11px] text-muted mt-1">Click to view</div>
                  </button>
                </div>
                
                <h3 className="mb-4">Department Leave Summary</h3>
                <div className="data-table-wrapper">
                  <table className="data-table mobile-record-table" role="table">
                    <thead>
                      <tr>
                        <th scope="col">Department</th>
                        <th scope="col">Approved Leaves (YTD)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.departmentSummary?.map((d: any) => (
                        <tr key={d.department}>
                          <td className="font-bold" data-label="Department">{d.department}</td>
                          <td data-label="Approved Leaves (YTD)">{d.approvedLeaves}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
                )}
              </>
            )}
            
            {activeTab === 'ledger' && (
              <div className="glass-card-body p-0">
                <div className="md:hidden space-y-3 p-3">
                  {ledger.map((r: any) => <article key={r.id} className="mobile-ledger-card rounded-xl border border-border bg-base/40 p-4">
                    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="font-bold break-words">{r.employeeName}</div><div className="text-xs text-muted">{r.employeeID} · {r.leaveTypeCode}</div></div><span className="badge badge-pending shrink-0">{r.status}</span></div>
                    <div className="grid grid-cols-2 gap-3 mt-4 text-xs"><div><span className="text-muted block">Date filed</span><strong>{new Date(r.dateFiled).toLocaleDateString()}</strong></div><div><span className="text-muted block">Leave dates</span><strong>{new Date(r.dateFrom).toLocaleDateString()} – {new Date(r.dateTo).toLocaleDateString()}</strong></div></div>
                    {r.reason && <p className="text-sm mt-3 line-clamp-2">{r.reason}</p>}
                    <div className="grid grid-cols-2 gap-2 mt-4" onClick={event=>event.stopPropagation()}><button className="btn btn-outline btn-sm" onClick={()=>handleViewRequest(r)}><Eye size={14}/> View details</button>{r.dateProcessed?<div className="text-xs text-success flex items-center justify-center">Processed</div>:<button className="btn btn-primary btn-sm" onClick={()=>handleFinalizeClick(r)}>Finalize</button>}</div>
                  </article>)}
                  {ledger.length===0&&<div className="empty-state py-8">No requests to finalize.</div>}
                </div>
                <div className="data-table-wrapper hidden md:block">
                  <table className="data-table mobile-record-table" role="table">
                    <thead>
                      <tr>
                        <th scope="col">Employee</th>
                        <th scope="col">Type</th>
                        <th scope="col">Date Filed</th>
                        <th scope="col">Leave Dates</th>
                        <th scope="col">Duration</th>
                        <th scope="col">Reason</th>
                        <th scope="col">Status</th>
                        <th scope="col">HR Processing</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledger.map((r: any) => (
                        <tr key={r.id} onClick={() => handleViewRequest(r)} className="cursor-pointer" title="Click to view request details">
                          <td data-label="Employee">
                            <div className="font-bold">{r.employeeName}</div>
                            <div className="text-xs text-muted">{r.employeeID}</div>
                          </td>
                          <td data-label="Type"><span className="font-bold">{r.leaveTypeCode}</span></td>
                          <td className="whitespace-nowrap" data-label="Date Filed">{new Date(r.dateFiled).toLocaleDateString()}</td>
                          <td data-label="Leave Dates">{new Date(r.dateFrom).toLocaleDateString()} - {new Date(r.dateTo).toLocaleDateString()}</td>
                          <td className="whitespace-nowrap" data-label="Duration">{formatRequestDuration(r)}</td>
                          <td className="max-w-[240px] truncate" title={r.reason} data-label="Reason">{r.reason || '—'}</td>
                          <td data-label="Status"><span className="badge badge-pending">{r.status}</span></td>
                          <td data-label="HR Processing">
                            <div className="flex gap-2" onClick={event => event.stopPropagation()}>
                            <button className="btn btn-ghost btn-sm" onClick={() => handleViewRequest(r)}><Eye size={14} /> View</button>
                            {r.dateProcessed ? (
                              <div className="text-xs text-success">Processed</div>
                            ) : (
                              <button className="btn btn-outline btn-sm" onClick={() => handleFinalizeClick(r)}>
                                Finalize
                              </button>
                            )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {ledger.length === 0 && (
                        <tr>
                          <td colSpan={8} className="text-center p-8 text-muted">No requests to finalize.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'company-pending' && (
              <div className="glass-card-body p-0">
                <div className="data-table-wrapper">
                  <table className="data-table mobile-record-table" role="table">
                    <thead>
                      <tr>
                        <th scope="col">Employee</th>
                        <th scope="col">Type</th>
                        <th scope="col">Date Filed</th>
                        <th scope="col">Leave Dates</th>
                        <th scope="col">Duration</th>
                        <th scope="col">Reason</th>
                        <th scope="col">Status</th>
                        <th scope="col">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {companyPending.map((r: any) => (
                        <tr key={r.leaveRequestId || r.id} onClick={() => handleViewRequest(r)} className="cursor-pointer" title="Click to view request details">
                          <td data-label="Employee">
                            <div className="font-bold">{r.employeeName}</div>
                            <div className="text-xs text-muted">{r.employeeID || r.department}</div>
                          </td>
                          <td data-label="Type"><span className="font-bold">{r.leaveTypeCode}</span></td>
                          <td className="whitespace-nowrap" data-label="Date Filed">{new Date(r.dateFiled).toLocaleDateString()}</td>
                          <td data-label="Leave Dates">{new Date(r.dateFrom).toLocaleDateString()} - {new Date(r.dateTo).toLocaleDateString()}</td>
                          <td className="whitespace-nowrap" data-label="Duration">{formatRequestDuration(r)}</td>
                          <td className="max-w-[240px] truncate" title={r.reason} data-label="Reason">{r.reason || '—'}</td>
                          <td data-label="Status"><span className="badge badge-pending">{r.status}</span></td>
                          <td onClick={event => event.stopPropagation()} data-label="Actions">
                            <button className="btn btn-outline btn-sm" onClick={() => handleViewRequest(r)}>
                              <Eye size={14} /> View
                            </button>
                            <button className="btn btn-outline btn-sm ml-2" onClick={() => void handleNotifyApprover(r.leaveRequestId || r.id)} title="Notify current approver"><BellRing size={14} /> Notify Approver</button>
                          </td>
                        </tr>
                      ))}
                      {companyPending.length === 0 && (
                        <tr>
                          <td colSpan={8} className="text-center p-8 text-muted">No pending requests found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {activeTab === 'reports' && (
              <div>
                <ReportDesigner />
                <div className="glass-card-body p-8 text-center" style={{ overflow: 'hidden' }}>
                <FileBarChart size={48} className="text-muted mx-auto mb-4" />
                <h3>Analytics Dashboard</h3>
                <p className="text-muted">Generate comprehensive Excel reports and view department summaries.</p>
                
                <div className="max-w-md mx-auto mt-6 bg-base/50 p-6 rounded-lg border border-border">
                  <h4 className="text-sm font-bold uppercase mb-4 tracking-wider">Export Leaves (Date Range)</h4>
                  <div className="form-row mb-4">
                    <div className="form-group text-left">
                      <label className="form-label text-xs">Date From</label>
                      <input type="date" className="form-input" value={reportDateFrom} onChange={e => setReportDateFrom(e.target.value)} />
                    </div>
                    <div className="form-group text-left">
                      <label className="form-label text-xs">Date To</label>
                      <input type="date" className="form-input" value={reportDateTo} onChange={e => setReportDateTo(e.target.value)} />
                    </div>
                  </div>
                  <button className="btn btn-primary w-full flex gap-2 items-center justify-center min-h-[44px]" onClick={handleDownloadAnnualReport}>
                    <Download size={18} /> Download CSV Report
                  </button>
                </div>
                
                <div className="mt-8 flex justify-center">
                  <button className="btn btn-outline min-h-[44px]" onClick={() => navigate('/departments')}>View Department Summary</button>
                </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {overviewModal && (
        <DialogOverlay onClose={() => setOverviewModal(null)} label={overviewModal.title} closeOnBackdrop closeOnEscape>
          <div className="modal-content animate-slide-up" style={{ maxWidth: 900 }}>
            <div className="modal-header">
              <div><h2>{overviewModal.title}</h2><p className="text-xs text-muted mt-1">{overviewModal.items.length} record{overviewModal.items.length === 1 ? '' : 's'} found</p></div>
              <button className="modal-close" aria-label={`Close ${overviewModal.title}`} onClick={() => setOverviewModal(null)}><X size={20} /></button>
            </div>
            {overviewModalLoading ? <div className="p-10 text-center"><div className="spinner" /></div> : overviewModal.items.length === 0 ? (
              <div className="p-10 text-center text-muted">No records found for this overview.</div>
            ) : overviewModal.kind === 'low-balance' ? (
              <div className="data-table-wrapper" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
                <table className="data-table mobile-record-table" role="table"><thead><tr><th scope="col">Employee</th><th scope="col">Department</th><th scope="col">Low Leave Balances</th><th scope="col">Action</th></tr></thead>
                  <tbody>{overviewModal.items.map((employee: any) => <tr key={employee.id}>
                    <td data-label="Employee"><strong>{employee.fullName}</strong><div className="text-xs text-muted">{employee.employeeID}</div></td>
                    <td data-label="Department">{employee.department || '—'}</td>
                    <td data-label="Low Leave Balances">{employee.balances?.filter((balance: any) => Number(balance.totalCredits) + Number(balance.carryOver) > 0 && Number(balance.available) < 3).map((balance: any) => <span key={balance.leaveTypeCode} className="badge badge-pending mr-1">{balance.leaveTypeCode}: {balance.available}</span>)}</td>
                    <td data-label="Action"><button className="btn btn-outline btn-sm" onClick={() => { setOverviewModal(null); navigate('/hr/employment-status'); }}><Eye size={14} /> View</button></td>
                  </tr>)}</tbody>
                </table>
              </div>
            ) : (
              <div className="data-table-wrapper" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
                <table className="data-table mobile-record-table" role="table"><thead><tr><th scope="col">Employee</th><th scope="col">Type</th><th scope="col">Date Filed</th><th scope="col">Leave Dates</th><th scope="col">Reason</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead>
                  <tbody>{overviewModal.items.map((request: any) => <tr key={request.leaveRequestId || request.id} className="cursor-pointer" onClick={() => { setOverviewModal(null); void handleViewRequest(request); }}>
                    <td data-label="Employee"><strong>{request.employeeName}</strong><div className="text-xs text-muted">{request.employeeID || request.department}</div></td>
                    <td data-label="Type"><strong>{request.leaveTypeCode}</strong></td>
                    <td className="whitespace-nowrap" data-label="Date Filed">{new Date(request.dateFiled).toLocaleDateString()}</td>
                    <td className="whitespace-nowrap" data-label="Leave Dates">{new Date(request.dateFrom).toLocaleDateString()} – {new Date(request.dateTo).toLocaleDateString()}</td>
                    <td className="max-w-[180px] truncate" title={request.reason} data-label="Reason">{request.reason || '—'}</td>
                    <td data-label="Status"><span className="badge badge-pending">{request.status}</span></td>
                    <td data-label="Action"><button className="btn btn-outline btn-sm" onClick={event => { event.stopPropagation(); setOverviewModal(null); void handleViewRequest(request); }}><Eye size={14} /> View</button></td>
                  </tr>)}</tbody>
                </table>
              </div>
            )}
            <div className="flex justify-end border-t border-border pt-4 mt-4"><button className="btn btn-outline" onClick={() => setOverviewModal(null)}>Close</button></div>
          </div>
        </DialogOverlay>
      )}

      {viewingRequest && (
        <DialogOverlay onClose={() => setViewingRequest(null)} label="Leave request details" closeOnBackdrop closeOnEscape>
          <div className="modal-content animate-slide-up" style={{ maxWidth: 760 }}>
            <div className="modal-header">
              <div><h2>Leave Request Details</h2><p className="text-xs text-muted mt-1">Review the request without leaving the HR list.</p></div>
              <button className="modal-close" aria-label="Close request details" onClick={() => setViewingRequest(null)}><X size={20} /></button>
            </div>
            {viewingRequestLoading ? <div className="p-8 text-center"><div className="spinner" /></div> : (
              <div className="space-y-5 overflow-y-auto min-h-0 pr-1 overscroll-contain">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted block text-xs">Employee</span><strong>{viewingRequest.employee?.fullName || viewingRequest.employeeName}</strong><div className="text-xs text-muted">{viewingRequest.employee?.employeeID || viewingRequest.employeeID}</div></div>
                  <div><span className="text-muted block text-xs">Department</span><strong>{viewingRequest.employee?.department || viewingRequest.department || '—'}</strong></div>
                  <div><span className="text-muted block text-xs">Date Filed</span><strong>{new Date(viewingRequest.dateFiled).toLocaleString()}</strong></div>
                  <div><span className="text-muted block text-xs">Status</span><span className="badge badge-pending">{viewingRequest.status}</span></div>
                  <div><span className="text-muted block text-xs">Leave Type</span><strong>{viewingRequest.leaveType?.code || viewingRequest.leaveTypeCode} — {viewingRequest.leaveType?.description || viewingRequest.leaveTypeDescription || ''}</strong>{viewingRequest.balanceDeductionLeaveType && <div>Deduct from: <strong>{viewingRequest.balanceDeductionLeaveType.code}</strong></div>}{(viewingRequest.leaveType?.code || viewingRequest.leaveTypeCode)?.toUpperCase() === 'UT' && <div className="text-warning">Unpaid UT — no leave deduction</div>}</div>
                  <div><span className="text-muted block text-xs">Leave Dates</span><strong>{new Date(viewingRequest.dateFrom).toLocaleDateString()} – {new Date(viewingRequest.dateTo).toLocaleDateString()}</strong></div>
                  <div><span className="text-muted block text-xs">{Number(viewingRequest.totalHours) > 0 ? 'Time of Leave' : 'Duration'}</span><strong>{Number(viewingRequest.totalHours) > 0 ? `${viewingRequest.halfDayTime || ''} · ${viewingRequest.totalHours} hours` : `${viewingRequest.totalDays} ${Number(viewingRequest.totalDays) === 1 ? 'day' : 'days'}`}</strong></div>
                </div>
                <div className="p-4 rounded-lg border border-border bg-base/40"><span className="text-muted block text-xs mb-1">Reason</span><p className="whitespace-pre-wrap">{viewingRequest.reason || 'No reason provided.'}</p></div>
                <div><h3 className="mb-2">Attachments</h3>{viewingRequest.attachments?.length?<div className="grid sm:grid-cols-2 gap-2">{viewingRequest.attachments.map((attachment:any)=><button type="button" key={attachment.id} className="flex items-center gap-3 text-left p-3 rounded-lg border border-border bg-base/40 hover:border-primary min-w-0" onClick={()=>void handleViewAttachment(attachment)}><Paperclip size={17} className="text-primary shrink-0"/><span className="min-w-0"><strong className="block truncate">{attachment.fileName}</strong><small className="text-muted">{(attachment.fileSize/1024).toFixed(1)} KB · Tap to preview</small></span></button>)}</div>:<p className="text-sm text-muted p-3 rounded-lg border border-border">No attachments submitted.</p>}</div>
                {viewingRequest.approvalSteps?.length > 0 && <div><h3 className="mb-2">Leave Progress</h3><div className="space-y-2">{viewingRequest.approvalSteps.map((step: any,index:number) => <div key={step.id || step.stepOrder} className="grid grid-cols-[32px_minmax(0,1fr)] gap-3 p-3 rounded-lg border border-border text-sm"><span className="w-8 h-8 rounded-full bg-primary/10 text-primary grid place-items-center font-bold">{index+1}</span><div className="min-w-0">{step.stageKind === 'RECOMMENDING' && <div className="text-xs font-semibold text-muted mb-1">Recommending By</div>}<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"><strong>{approvalStageLabel(step.stepLabel, index)}</strong><span className={`badge ${step.action==='Approved'?'badge-success':step.action==='Disapproved'?'badge-danger':step.action==='Skipped'?'badge-cancelled':'badge-pending'} self-start`}>{step.action}</span></div><div className="text-muted mt-1 break-words">{step.approverName || 'Approver not assigned'}</div>{step.actionDate&&<div className="text-xs text-muted mt-1">{new Date(step.actionDate).toLocaleString()}</div>}</div></div>)}</div></div>}
                <div className="flex justify-end border-t border-border pt-4"><button className="btn btn-outline" onClick={() => setViewingRequest(null)}>Close</button></div>
              </div>
            )}
          </div>
        </DialogOverlay>
      )}

      <AttachmentPreviewModal isOpen={Boolean(selectedAttachment)} onClose={closeAttachment} attachment={selectedAttachment} blobUrl={attachmentBlobUrl} />

      {/* Finalize Request Modal */}
      {finalizingRequest && (
        <DialogOverlay onClose={() => setFinalizingRequest(null)} label="Finalize leave request" closeOnBackdrop={!submitting} closeOnEscape={!submitting}>
          <div className="modal-content animate-slide-up">
            <div className="modal-header">
              <h2>Finalize Request</h2>
              <button className="modal-close" onClick={() => setFinalizingRequest(null)}><X size={20} /></button>
            </div>
            <form onSubmit={handleFinalizeSubmit}>
              <div className="mb-4 text-sm">
                <p><strong>Employee:</strong> {finalizingRequest.employeeName}</p>
                <p><strong>Leave Type:</strong> {finalizingRequest.leaveTypeCode}</p>
                <p><strong>Dates:</strong> {new Date(finalizingRequest.dateFrom).toLocaleDateString()} - {new Date(finalizingRequest.dateTo).toLocaleDateString()}</p>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="finalize-noted-by">Noted By (HR Staff)</label>
                <input 
                  type="text" 
                  id="finalize-noted-by"
                  autoComplete="name"
                  className="form-input" 
                  value={finalizeForm.notedByHR} 
                  onChange={e => setFinalizeForm({...finalizeForm, notedByHR: e.target.value})} 
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">HR Remarks (Optional)</label>
                <textarea 
                  className="form-textarea" 
                  rows={2} 
                  value={finalizeForm.hrRemarks} 
                  onChange={e => setFinalizeForm({...finalizeForm, hrRemarks: e.target.value})} 
                  placeholder="Any final remarks before closing this request..." 
                />
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" className="btn btn-outline" onClick={() => setFinalizingRequest(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Processing...' : 'Mark as Processed'}
                </button>
              </div>
            </form>
          </div>
        </DialogOverlay>
      )}
    </div>
  );
};
