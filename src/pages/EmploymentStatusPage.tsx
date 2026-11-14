import { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, RefreshCw, Search, Eye, Edit2, X } from 'lucide-react';
import api, { HRAPI, LeaveAPI, getApiErrorMessage, type HREmployee, type LeaveBalance, type LeaveRequest } from '../lib/api';
import { useToast } from '../components/ToastProvider';

import { EmployeeLeaveDetail } from '../components/EmployeeLeaveDetail';
import { LeaveSummaryForm } from '../components/LeaveSummaryForm';
import { DialogOverlay } from '../components/ui/DialogOverlay';
import { useLatestRequest } from '../hooks/useLatestRequest';
import { NotificationService } from '../services/notificationService';

interface EmployeeStatusRow {
  id: number;
  employeeID: string;
  fullName: string;
  department: string;
  position: string;
  employmentStatus: string;
}

export const EmploymentStatusPage = () => {
  const toast = useToast();
  const [employees, setEmployees] = useState<EmployeeStatusRow[]>([]);
  const [balances, setBalances] = useState<Array<EmployeeStatusRow & { balances: LeaveBalance[] }>>([]);
  const [leaveTypes, setLeaveTypes] = useState<Array<{ id: number; code: string; description: string }>>([]);
  const [deptFilter, setDeptFilter] = useState('');
  const [balanceError, setBalanceError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [viewingEmployee, setViewingEmployee] = useState<(EmployeeStatusRow & { balances: LeaveBalance[] }) | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<(EmployeeStatusRow & { balances: LeaveBalance[] }) | null>(null);
  const [editForm, setEditForm] = useState({ leaveTypeId: 0, totalCredits: 0, carryOver: 0, hrRemarks: '' });
  const [submitting, setSubmitting] = useState(false);
  const [leaveSummary, setLeaveSummary] = useState<{ employee: HREmployee; balances: LeaveBalance[]; requests: LeaveRequest[] } | null>(null);
  const [loadingLeaveSummary, setLoadingLeaveSummary] = useState(false);
  const loadRequest = useLatestRequest();
  const summaryRequest = useLatestRequest();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);

  const loadData = async () => {
    const request = loadRequest.begin();
    setLoading(true);
    const [statuses, balanceResult, types] = await Promise.allSettled([
      api.get<EmployeeStatusRow[]>('/hr/employment-statuses'),
      HRAPI.getEmployeeBalances(), LeaveAPI.getTypes()
    ]);
    if (!loadRequest.isCurrent(request)) return;
    if (statuses.status === 'fulfilled') { setEmployees(statuses.value.data); setLoadError(''); }
    else { setLoadError(getApiErrorMessage(statuses.reason, 'Could not load employees.')); }
    if (balanceResult.status === 'fulfilled') {
      setBalances(balanceResult.value);
      setBalanceError('');
      setViewingEmployee(current => current ? { ...current, ...(balanceResult.value.find((row: EmployeeStatusRow) => row.id === current.id) ?? { balances: [] }) } : null);
    } else { setBalanceError(getApiErrorMessage(balanceResult.reason, 'Could not load leave balances. Refresh to try again.')); }
    if (types.status === 'fulfilled') setLeaveTypes(types.value);
    else { setLeaveTypes([]); toast.error(getApiErrorMessage(types.reason, 'Could not load leave types. Refresh to enable editing.')); }
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
    const refresh = () => { void loadData(); };
    const unsubscribe = NotificationService.subscribe(notification => {
      if (!notification || /Leave|Approval|HR/.test(notification.type)) refresh();
    });
    const unsubscribeOrganization = NotificationService.subscribeOrganizationChanges(refresh);
    const onVisibility = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { unsubscribe(); unsubscribeOrganization(); document.removeEventListener('visibilitychange', onVisibility); loadRequest.begin(); summaryRequest.begin(); };
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return employees.filter(employee => (!deptFilter || employee.department === deptFilter) &&
      [employee.employeeID, employee.fullName, employee.department, employee.position, employee.employmentStatus]
        .some(value => (value || '').toLowerCase().includes(term)));
  }, [employees, search, deptFilter]);

  const withBalances = (employee: EmployeeStatusRow) => ({
    ...employee, balances: balances.find(row => row.id === employee.id)?.balances ?? []
  });

  const handleEditClick = (employee: EmployeeStatusRow & { balances: LeaveBalance[] }) => {
    if (leaveTypes.length === 0) {
      toast.error('Leave types are still loading. Please try again.');
      return;
    }
    setEditingEmployee(employee);
    // Start with sick leave, while preserving the existing type selector.
    if (leaveTypes.length > 0) {
      const defaultType = leaveTypes.find(type => type.code === 'SL') ?? leaveTypes[0];
      const typeId = defaultType.id;
      const existingBal = employee.balances?.find((b: LeaveBalance) => b.leaveTypeCode === defaultType.code);
      setEditForm({
        leaveTypeId: typeId,
        totalCredits: existingBal?.totalCredits || 0,
        carryOver: existingBal?.carryOver || 0,
        hrRemarks: existingBal?.hrRemarks || ''
      });
    }
  };

  const handleOpenLeaveSummary = async (employee: EmployeeStatusRow) => {
    const request = summaryRequest.begin();
    setLoadingLeaveSummary(true);
    try {
      const summary = await HRAPI.getEmployeeLeaveSummary(employee.id, new Date().getFullYear());
      if (summaryRequest.isCurrent(request)) setLeaveSummary(summary);
    } catch (error) {
      if (summaryRequest.isCurrent(request)) toast.error(getApiErrorMessage(error, 'Could not load the leave summary.'));
    } finally {
      if (summaryRequest.isCurrent(request)) setLoadingLeaveSummary(false);
    }
  };

  const handleLeaveTypeChange = (typeId: number) => {
    const typeCode = leaveTypes.find(t => t.id === typeId)?.code;
    const existingBal = editingEmployee?.balances?.find((b: LeaveBalance) => b.leaveTypeCode === typeCode);
    setEditForm({
      leaveTypeId: typeId,
      totalCredits: existingBal?.totalCredits || 0,
      carryOver: existingBal?.carryOver || 0,
      hrRemarks: existingBal?.hrRemarks || ''
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;
    if (!editForm.leaveTypeId || !Number.isFinite(editForm.totalCredits) || !Number.isFinite(editForm.carryOver)
      || editForm.totalCredits < 0 || editForm.carryOver < 0) {
      toast.error('Select a leave type and enter nonnegative credits and carry-over.');
      return;
    }
    
    setSubmitting(true);
    try {
      await HRAPI.updateBalance(editingEmployee.id, editForm);
      setEditingEmployee(null);
      toast.success('Leave balance updated successfully');
      await loadData();
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, 'Failed to update balance'));
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (employee: EmployeeStatusRow, employmentStatus: string) => {
    const previous = employee.employmentStatus;
    setEmployees(rows => rows.map(row => row.id === employee.id ? { ...row, employmentStatus } : row));
    setSavingId(employee.id);
    try {
      await api.put(`/hr/employment-statuses/${employee.id}`, { employmentStatus });
      toast.success(`${employee.fullName} is now ${employmentStatus}.`);
    } catch (error) {
      setEmployees(rows => rows.map(row => row.id === employee.id ? { ...row, employmentStatus: previous } : row));
      toast.error(getApiErrorMessage(error, 'Could not update employment status.'));
    } finally { setSavingId(null); }
  };

  return <div className="employee-hub space-y-6 animate-fade-in">
    <div className="page-header">
      <div className="flex items-center gap-3"><BadgeCheck size={28} className="text-primary"/><div><h1>Employee Hub</h1><a href="/hr/leave-administration" className="btn btn-outline mt-2">Annual leave credits &amp; recovery</a><p className="text-muted">View employee leave summaries and manage balances and employment status.</p></div></div>
      <button className="btn btn-outline" onClick={() => void loadData()} disabled={loading}><RefreshCw size={16}/> Refresh</button>
    </div>
    {loadError && <div role="alert" className="text-danger">{loadError}</div>}
    {balanceError && <div role="alert" className="text-danger">{balanceError}</div>}
    <section className="glass-card">
      <div className="glass-card-header flex flex-wrap items-center justify-between gap-3">
        <div><h2>Employees</h2><p className="text-xs text-muted mt-1">HR Operations staff can change these values.</p></div>
        <div className="employee-hub-filters flex flex-wrap gap-3 w-full sm:w-auto"><label className="relative w-full sm:w-auto sm:min-w-[280px]"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"/><input className="form-input w-full" style={{ paddingLeft: 36 }} value={search} onChange={event => setSearch(event.target.value)} placeholder="Search ID, name, department…" aria-label="Search employees"/></label><select className="form-select w-full sm:w-auto" aria-label="Filter by department" value={deptFilter} onChange={event => setDeptFilter(event.target.value)}><option value="">All Departments</option>{Array.from(new Set(employees.map(row => row.department).filter(Boolean))).sort().map(department => <option key={department} value={department}>{department}</option>)}</select></div>
      </div>
      <div className="data-table-wrapper">
        <table className="data-table mobile-record-table employee-hub-table" role="table"><thead><tr><th scope="col">Employee</th><th scope="col">Department</th><th scope="col">Position</th><th scope="col">Employment Status</th><th scope="col">Actions</th></tr></thead>
          <tbody>{filtered.map(employee => <tr key={employee.id}><td data-label="Employee"><button type="button" className="employee-hub-name font-bold text-primary text-left min-h-[44px] hover:underline" disabled={loadingLeaveSummary || savingId !== null} onClick={() => void handleOpenLeaveSummary(employee)} aria-label={`Leave summary for ${employee.fullName}`}>{employee.fullName}</button><div className="text-xs text-muted">{employee.employeeID}</div></td><td data-label="Department">{employee.department || 'Unassigned'}</td><td data-label="Position">{employee.position || '—'}</td><td data-label="Employment Status"><select className="form-select min-w-[150px]" value={employee.employmentStatus?.toUpperCase() === 'NON-REGULAR' ? 'NON-REGULAR' : 'REGULAR'} disabled={savingId !== null || loading} onChange={event => void updateStatus(employee, event.target.value)} aria-label={`Employment status for ${employee.fullName}`}><option value="REGULAR">REGULAR</option><option value="NON-REGULAR">NON-REGULAR</option></select></td><td data-label="Actions"><div className="flex flex-wrap gap-2"><button className="btn btn-outline btn-sm min-h-[44px]" disabled={loading || !!balanceError} onClick={() => setViewingEmployee(withBalances(employee))} aria-label={`View leave balances for ${employee.fullName}`}><Eye size={16}/> View Leave Balances</button><button className="btn btn-outline btn-sm min-h-[44px]" disabled={loading || !!balanceError || leaveTypes.length === 0} onClick={() => handleEditClick(withBalances(employee))} aria-label={`Edit leave balances for ${employee.fullName}`}><Edit2 size={16}/> Edit Leave Balances</button></div></td></tr>)}</tbody>
        </table>
        {!loading && filtered.length === 0 && <div className="empty-state p-8">No employees match your search.</div>}
        {loading && <div className="loading-spinner min-h-[240px]"><div className="spinner"/></div>}
      </div>
    </section>
    {viewingEmployee && <EmployeeLeaveDetail employee={viewingEmployee} onClose={() => setViewingEmployee(null)} />}
    {leaveSummary && <LeaveSummaryForm {...leaveSummary} onClose={() => setLeaveSummary(null)} />}
      {editingEmployee && (
        <DialogOverlay onClose={() => setEditingEmployee(null)} label={`Edit leave balances for ${editingEmployee.fullName}`} closeOnBackdrop={!submitting} closeOnEscape={!submitting}>
          <div className="modal-content animate-slide-up">
            <div className="modal-header">
              <h2>Edit Balances: {editingEmployee.fullName}</h2>
              <button className="modal-close" disabled={submitting} onClick={() => setEditingEmployee(null)}><X size={20} /></button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="form-group">
                <label className="form-label">Leave Type</label>
                <select 
                  className="form-select" 
                  aria-label="Leave Type"
                  disabled={submitting}
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
                    inputMode="decimal"
                    step="any"
                    min="0"
                    required 
                    className="form-input" 
                    aria-label="Total Credits"
                    disabled={submitting}
                    value={editForm.totalCredits} 
                    onChange={e => setEditForm({...editForm, totalCredits: Number(e.target.value)})} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Carry Over (From Last Year)</label>
                  <input 
                    type="number" 
                    inputMode="decimal"
                    step="any"
                    min="0"
                    required 
                    className="form-input" 
                    aria-label="Carry Over"
                    disabled={submitting}
                    value={editForm.carryOver} 
                    onChange={e => setEditForm({...editForm, carryOver: Number(e.target.value)})} 
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">HR Remarks (Optional)</label>
                <textarea 
                  className="form-textarea" 
                  aria-label="HR Remarks"
                  disabled={submitting}
                  rows={2} 
                  value={editForm.hrRemarks} 
                  onChange={e => setEditForm({...editForm, hrRemarks: e.target.value})} 
                  placeholder="Reason for manual adjustment..." 
                />
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button type="button" className="btn btn-outline" disabled={submitting} onClick={() => setEditingEmployee(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </DialogOverlay>
      )}

  </div>;
};
