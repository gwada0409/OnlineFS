import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HRAPI, LeaveAPI, ApprovalAPI } from '../lib/api';
import { Users, FileBarChart, X, CheckSquare, LayoutDashboard, Download, Eye, Edit2, User, Clock } from 'lucide-react';
import { EmployeeLeaveDetail } from '../components/EmployeeLeaveDetail';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ToastProvider';

export const HRDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'overview' | 'ledger' | 'balances' | 'company-pending' | 'reports'>('overview');
  const [summary, setSummary] = useState<any>(null);
  const [overviewError, setOverviewError] = useState(false);
  const [ledger, setLedger] = useState<any[]>([]);
  const [companyPending, setCompanyPending] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingEmployee, setViewingEmployee] = useState<any | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('');

  // Edit Balance State
  const [editingEmployee, setEditingEmployee] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ leaveTypeId: 0, totalCredits: 0, carryOver: 0, hrRemarks: '' });
  
  // Finalize Request State
  const [finalizingRequest, setFinalizingRequest] = useState<any | null>(null);
  const [finalizeForm, setFinalizeForm] = useState({ notedByHR: '', hrRemarks: '' });

  const [reportDateFrom, setReportDateFrom] = useState('');
  const [reportDateTo, setReportDateTo] = useState('');

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
    if (leaveTypes.length === 0) {
      LeaveAPI.getTypes().then(setLeaveTypes).catch(console.error);
    }
    setFinalizeForm(prev => ({ ...prev, notedByHR: user?.username || '' }));
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'overview') {
        try {
          const data = await HRAPI.getLeaveSummary();
          setSummary(data || null);
          setOverviewError(!data);
        } catch (e) {
          console.error("Failed to load overview data:", e);
          setOverviewError(true);
          setSummary(null);
        }
      } else if (activeTab === 'ledger') {
        const data = await HRAPI.getLeaveLedger(); // Actually gets pending leave requests to finalize
        setLedger(data);
      } else if (activeTab === 'balances') {
        const data = await HRAPI.getEmployeeBalances();
        setBalances(data);
      } else if (activeTab === 'company-pending') {
        const data = await ApprovalAPI.getAllPending();
        setCompanyPending(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (employee: any) => {
    setEditingEmployee(employee);
    // Default to the first leave type
    if (leaveTypes.length > 0) {
      const typeId = leaveTypes[0].id;
      const existingBal = employee.balances?.find((b: any) => b.leaveTypeCode === leaveTypes[0].code);
      setEditForm({
        leaveTypeId: typeId,
        totalCredits: existingBal?.totalCredits || 0,
        carryOver: existingBal?.carryOver || 0,
        hrRemarks: existingBal?.hrRemarks || ''
      });
    }
  };

  const handleLeaveTypeChange = (typeId: number) => {
    const typeCode = leaveTypes.find(t => t.id === typeId)?.code;
    const existingBal = editingEmployee?.balances?.find((b: any) => b.leaveTypeCode === typeCode);
    setEditForm({
      leaveTypeId: typeId,
      totalCredits: existingBal?.totalCredits || 0,
      carryOver: existingBal?.carryOver || 0,
      hrRemarks: existingBal?.hrRemarks || ''
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee || editForm.leaveTypeId === 0) return;
    
    setSubmitting(true);
    try {
      await HRAPI.updateBalance(editingEmployee.id, editForm);
      setEditingEmployee(null);
      toast.success('Leave balance updated successfully');
      loadData(); // Refresh balances
    } catch (err: any) {
      toast.error(err.response?.data || 'Failed to update balance');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinalizeClick = (request: any) => {
    setFinalizingRequest(request);
    setFinalizeForm({ notedByHR: user?.username || '', hrRemarks: '' });
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

  const downloadCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) {
      toast.error('No data to export');
      return;
    }
    const headers = Object.keys(data[0]);
    const csvRows = [];
    csvRows.push(headers.join(','));
    
    for (const row of data) {
      const values = headers.map(header => {
        const val = row[header] === null || row[header] === undefined ? '' : row[header];
        return `"${String(val).replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(','));
    }
    
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleDownloadAnnualReport = async () => {
    try {
      toast.info('Generating report...');
      const data = await HRAPI.getAnnualReport(new Date().getFullYear(), reportDateFrom || undefined, reportDateTo || undefined);
      
      const formatted = data.map((b: any) => ({
        EmployeeID: b.employeeID,
        Name: b.fullName,
        Department: b.department,
        Total_Leaves_Taken: b.totalLeavesTaken,
        Total_Days: b.totalDays,
        VL_Taken: b.byType?.find((x:any)=>x.leaveType==='VL')?.count || 0,
        VL_Days: b.byType?.find((x:any)=>x.leaveType==='VL')?.days || 0,
        SL_Taken: b.byType?.find((x:any)=>x.leaveType==='SL')?.count || 0,
        SL_Days: b.byType?.find((x:any)=>x.leaveType==='SL')?.days || 0,
      }));
      downloadCSV(formatted, `Annual_Leave_Report_${new Date().getFullYear()}.csv`);
    } catch (e) {
      toast.error('Failed to generate report');
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1>HR Administration</h1>
        <p>Manage employee leaves, balances, and generate reports</p>
      </div>

      <div className="page-body">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b scroll-x-auto" style={{ borderColor: 'var(--border)', paddingBottom: 16 }}>
          <button className={`btn ${activeTab === 'overview' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('overview')}>
            <LayoutDashboard size={16} /> Overview
          </button>
          <button className={`btn ${activeTab === 'balances' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('balances')}>
            <Users size={16} /> Employee Balances
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
          <div className="loading-spinner"><div className="spinner"></div></div>
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
                      <button className="btn btn-primary min-h-[44px]" onClick={() => setActiveTab('balances')}>Go to Employee Balances</button>
                      <button className="btn btn-outline min-h-[44px]" onClick={() => setActiveTab('ledger')}>Finalize Requests</button>
                      <button className="btn btn-outline min-h-[44px]" onClick={() => setActiveTab('reports')}>Generate Reports</button>
                    </div>
                  </div>
                ) : (
                  <div className="glass-card-body">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  <div className="stat-card">
                    <div className="stat-title">Pending Leave Requests</div>
                    <div className="stat-value text-warning">{summary.totalPending}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-title">Employees on Leave</div>
                    <div className="stat-value text-info">{summary.employeesOnLeave}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-title">Low Balance (&lt; 3 Days)</div>
                    <div className="stat-value text-danger">{summary.employeesLowBalance}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-title">Approved / Rejected This Month</div>
                    <div className="stat-value">
                      <span className="text-success">{summary.approvedThisMonth}</span> / <span className="text-danger">{summary.rejectedThisMonth}</span>
                    </div>
                  </div>
                </div>
                
                <h3 className="mb-4">Department Leave Summary</h3>
                <div className="data-table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Department</th>
                        <th>Approved Leaves (YTD)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.departmentSummary?.map((d: any) => (
                        <tr key={d.department}>
                          <td className="font-bold">{d.department}</td>
                          <td>{d.approvedLeaves}</td>
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
                <div className="data-table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Type</th>
                        <th>Dates</th>
                        <th>Status</th>
                        <th>HR Processing</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledger.map((r: any) => (
                        <tr key={r.id}>
                          <td>
                            <div className="font-bold">{r.employeeName}</div>
                            <div className="text-xs text-muted">{r.employeeID}</div>
                          </td>
                          <td><span className="font-bold">{r.leaveTypeCode}</span></td>
                          <td>{new Date(r.dateFrom).toLocaleDateString()} - {new Date(r.dateTo).toLocaleDateString()}</td>
                          <td><span className="badge badge-pending">{r.status}</span></td>
                          <td>
                            {r.dateProcessed ? (
                              <div className="text-xs text-success">Processed</div>
                            ) : (
                              <button className="btn btn-outline btn-sm" onClick={() => handleFinalizeClick(r)}>
                                Finalize
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {ledger.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center p-8 text-muted">No requests to finalize.</td>
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
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Type</th>
                        <th>Dates</th>
                        <th>Duration</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {companyPending.map((r: any) => (
                        <tr key={r.id}>
                          <td>
                            <div className="font-bold">{r.employeeName}</div>
                            <div className="text-xs text-muted">{r.department}</div>
                          </td>
                          <td><span className="font-bold">{r.leaveTypeCode}</span></td>
                          <td>{new Date(r.dateFrom).toLocaleDateString()} - {new Date(r.dateTo).toLocaleDateString()}</td>
                          <td>{r.totalHours > 0 ? `${r.totalHours} hrs` : `${r.totalDays} days`}</td>
                          <td><span className="badge badge-pending">{r.status}</span></td>
                          <td>
                            <button className="btn btn-outline btn-sm" onClick={() => navigate(`/leave/${r.id}`)}>
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                      {companyPending.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center p-8 text-muted">No pending requests found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {activeTab === 'balances' && (
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(520px,0.9fr)_minmax(420px,1.1fr)] gap-6 items-start">
                {/* Left Panel: Employee List */}
                <div className="glass-card flex flex-col">
                  <div className="glass-card-header border-b border-border" style={{ padding: '32px 32px 24px 32px' }}>
                    <h2 className="flex items-center gap-2 font-bold text-lg"><Users size={18} className="text-primary" /> Employee Balances</h2>
                  </div>
                  
                  <div className="border-b border-border bg-base flex flex-col md:flex-row gap-4 shrink-0" style={{ padding: '24px 32px' }}>
                    <input 
                      type="text" 
                      placeholder="Search employee..." 
                      className="form-input flex-1"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                    <select 
                      className="form-select flex-1 md:max-w-[240px]"
                      value={deptFilter}
                      onChange={e => setDeptFilter(e.target.value)}
                    >
                      <option value="">All Departments</option>
                      {Array.from(new Set(balances.map(b => b.department).filter(Boolean))).map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-4 overflow-y-auto max-h-[700px] lg:max-h-[800px]" style={{ padding: '32px' }}>
                    {balances.filter(b => 
                      ((b.fullName || '').toLowerCase().includes(searchQuery.toLowerCase()) || (b.employeeID || '').toLowerCase().includes(searchQuery.toLowerCase())) &&
                      (deptFilter === '' || (b.department || '') === deptFilter)
                    ).map((b: any) => {
                      const totalUsed = b.balances?.reduce((acc: number, curr: any) => acc + curr.used, 0) || 0;
                      const totalPending = b.balances?.reduce((acc: number, curr: any) => acc + curr.pending, 0) || 0;
                      const totalAvailable = b.balances?.reduce((acc: number, curr: any) => acc + curr.available, 0) || 0;
                      const isSelected = selectedEmployee?.id === b.id;

                      return (
                        <div 
                          key={b.id} 
                          className={`glass-card flex flex-col gap-3 transition-colors cursor-pointer ${isSelected ? 'border-primary ring-1 ring-primary' : 'hover:border-border-active'}`}
                          onClick={() => setSelectedEmployee(b)}
                          style={{ padding: '24px' }}
                        >
                          <div>
                            <div className="font-bold text-lg text-text-primary">{b.fullName.toUpperCase()}</div>
                            <div className="text-sm text-muted">{b.department} | ID: {b.employeeID}</div>
                          </div>
                          
                          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm bg-base/50 p-3 rounded-md border border-border/50">
                            <div><span className="text-muted">Available:</span> <span className="font-bold text-success ml-1">{totalAvailable}</span></div>
                            <div><span className="text-muted">Used:</span> <span className="font-bold text-danger ml-1">{totalUsed}</span></div>
                            <div><span className="text-muted">Pending:</span> <span className="font-bold text-warning ml-1">{totalPending}</span></div>
                            <div><span className="text-muted">Projected:</span> <span className="font-bold text-primary ml-1">{totalAvailable - totalPending}</span></div>
                          </div>
                          
                          <div className="flex gap-2 mt-2">
                            <button className="btn btn-primary flex-1 min-h-[40px]" onClick={(e) => { e.stopPropagation(); setViewingEmployee(b); }}>
                              <Eye size={16} /> View Details
                            </button>
                            <button className="btn btn-outline min-h-[40px] flex-1" onClick={(e) => { e.stopPropagation(); handleEditClick(b); }}>
                              <Edit2 size={16} /> Edit
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {balances.filter(b => 
                      ((b.fullName || '').toLowerCase().includes(searchQuery.toLowerCase()) || (b.employeeID || '').toLowerCase().includes(searchQuery.toLowerCase())) &&
                      (deptFilter === '' || (b.department || '') === deptFilter)
                    ).length === 0 && (
                      <div className="text-center p-8 text-muted border border-dashed border-border rounded-lg">No employees found.</div>
                    )}
                  </div>
                </div>

                {/* Right Panel: Detail summary */}
                <div className="hidden lg:block sticky top-6">
                  {selectedEmployee ? (
                    <div className="glass-card flex flex-col border-primary">
                      <div className="glass-card-header flex justify-between items-center p-4 border-b border-border bg-base/50">
                        <h2 className="flex items-center gap-2 font-bold text-lg"><User size={18} className="text-primary" /> Employee Summary</h2>
                        <button className="modal-close" onClick={() => setSelectedEmployee(null)}><X size={18} /></button>
                      </div>
                      <div className="glass-card-body p-6">
                        <div className="text-center mb-6">
                          <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-3 text-2xl font-bold">
                            {selectedEmployee.fullName.charAt(0).toUpperCase()}
                          </div>
                          <h3 className="text-xl font-bold text-text-primary">{selectedEmployee.fullName.toUpperCase()}</h3>
                          <p className="text-muted">{selectedEmployee.department} | {selectedEmployee.employeeID}</p>
                        </div>
                        
                        <h4 className="font-bold text-sm text-text-secondary uppercase tracking-wider mb-3">Leave Balances</h4>
                        <div className="flex flex-col gap-3">
                          {selectedEmployee.balances?.map((bal: any) => (
                            <div key={bal.leaveTypeCode} className="bg-base/30 p-3 rounded-lg border border-border/50 flex justify-between items-center">
                              <div>
                                <div className="font-bold text-primary">{bal.leaveTypeCode}</div>
                                <div className="text-xs text-muted">{bal.totalCredits} Total Credits</div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-lg">{bal.available} <span className="text-xs text-muted font-normal">Avail</span></div>
                                <div className="text-xs text-muted">{bal.used} Used | {bal.pending} Pend</div>
                              </div>
                            </div>
                          ))}
                          {(!selectedEmployee.balances || selectedEmployee.balances.length === 0) && (
                            <p className="text-sm text-muted">No balances recorded.</p>
                          )}
                        </div>
                        
                        <div className="mt-8 flex flex-col gap-3">
                          <button className="btn btn-primary w-full min-h-[44px]" onClick={() => setViewingEmployee(selectedEmployee)}>
                            <Eye size={18} /> Open Full Details
                          </button>
                          <button className="btn btn-outline w-full min-h-[44px]" onClick={() => handleEditClick(selectedEmployee)}>
                            <Edit2 size={18} /> Edit Balances
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="empty-state-card glass-card flex flex-col items-center justify-center p-8 text-center border-dashed min-h-[400px]">
                      <Users size={48} className="text-muted mb-4 opacity-50" />
                      <h3 className="mb-2 text-text-primary">Select an employee</h3>
                      <p className="text-muted">Click on an employee card from the list to view their leave balance summary.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            {activeTab === 'reports' && (
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
            )}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {viewingEmployee && (
        <EmployeeLeaveDetail employee={viewingEmployee} onClose={() => setViewingEmployee(null)} />
      )}

      {/* Edit Balance Modal */}
      {editingEmployee && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => setEditingEmployee(null)} />
          <div className="modal-content animate-slide-up">
            <div className="modal-header">
              <h2>Edit Balances: {editingEmployee.fullName}</h2>
              <button className="modal-close" onClick={() => setEditingEmployee(null)}><X size={20} /></button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="form-group">
                <label className="form-label">Leave Type</label>
                <select 
                  className="form-select" 
                  value={editForm.leaveTypeId} 
                  onChange={e => handleLeaveTypeChange(Number(e.target.value))}
                >
                  {leaveTypes.map(lt => (
                    <option key={lt.id} value={lt.id}>{lt.code} - {lt.description}</option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Total Credits (Current Year)</label>
                  <input 
                    type="number" 
                    step="0.5" 
                    className="form-input" 
                    value={editForm.totalCredits} 
                    onChange={e => setEditForm({...editForm, totalCredits: Number(e.target.value)})} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Carry Over (From Last Year)</label>
                  <input 
                    type="number" 
                    step="0.5" 
                    className="form-input" 
                    value={editForm.carryOver} 
                    onChange={e => setEditForm({...editForm, carryOver: Number(e.target.value)})} 
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">HR Remarks (Optional)</label>
                <textarea 
                  className="form-textarea" 
                  rows={2} 
                  value={editForm.hrRemarks} 
                  onChange={e => setEditForm({...editForm, hrRemarks: e.target.value})} 
                  placeholder="Reason for manual adjustment..." 
                />
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button type="button" className="btn btn-outline" onClick={() => setEditingEmployee(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Finalize Request Modal */}
      {finalizingRequest && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => setFinalizingRequest(null)} />
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
                <label className="form-label">Noted By (HR Staff)</label>
                <input 
                  type="text" 
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
        </div>
      )}
    </div>
  );
};


