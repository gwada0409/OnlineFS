import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Calendar, Plus, RefreshCw, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ApproverAbsenceAPI, DepartmentAPI, HRAPI, getApiErrorMessage, type ApproverAbsenceRecord, type DepartmentNode, type HREmployee } from '../lib/api';
import { DialogOverlay } from '../components/ui/DialogOverlay';
import { useToast } from '../components/ToastProvider';
import { NotificationService } from '../services/notificationService';

const today = () => new Date().toLocaleDateString('en-CA');
const formatDate = (date: string) => new Date(`${date.slice(0, 10)}T00:00:00`).toLocaleDateString();
type Filter = 'Current' | 'Scheduled' | 'History' | 'All';

export function ApproverAbsenceManagement() {
  const toast = useToast();
  const [absences, setAbsences] = useState<ApproverAbsenceRecord[]>([]);
  const [employees, setEmployees] = useState<HREmployee[]>([]);
  const [departments, setDepartments] = useState<DepartmentNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('Current');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [ending, setEnding] = useState<ApproverAbsenceRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [reason, setReason] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [records, people, hierarchy] = await Promise.all([ApproverAbsenceAPI.getAll(), HRAPI.getEmployees(), DepartmentAPI.getHierarchy(true)]);
      setAbsences(records); setEmployees(people); setDepartments(hierarchy.flatMap(category => category.departments));
    } catch (failure) { setError(getApiErrorMessage(failure, 'Could not load approver leave coverage.')); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    void load();
    return NotificationService.subscribeOrganizationChanges(() => { void load(); });
  }, []);

  const visible = useMemo(() => absences.filter(record => {
    const matchesFilter = filter === 'All' || (filter === 'Current' && record.status === 'Active') ||
      (filter === 'Scheduled' && record.status === 'Scheduled') || (filter === 'History' && ['Expired', 'Revoked'].includes(record.status));
    return matchesFilter && [record.employeeName, record.employeeDepartment, record.reason].some(value => value?.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  }), [absences, filter, search]);

  const coverage = departments.filter(department => department.isActive).flatMap(department => {
    const id = Number(employeeId);
    const roles = [
      { key: 'notedBy' as const, label: 'Noted by / Line leader', assigned: department.sickLeaveLineLeaderId === id || department.notedByApproverIds?.includes(id) },
      { key: 'recommending' as const, label: 'Recommending', assigned: department.firstApproverId === id || department.firstApproverIds?.includes(id) },
      { key: 'approver' as const, label: 'Approver / 2nd approver', assigned: department.secondApproverId === id },
    ];
    return roles.filter(role => role.assigned).map(role => {
      const backupId = department.backupApprovers?.[role.key];
      const backup = employees.find(employee => employee.id === backupId);
      const unavailable = backupId === id || absences.some(record => record.employeeId === backupId && record.isActive && record.startDate.slice(0, 10) <= endDate && record.endDate.slice(0, 10) >= startDate);
      return { key: `${department.id}-${role.key}`, department: department.name, label: role.label, backup: backup?.fullName, unavailable };
    });
  });

  const openCreate = () => {
    setEmployeeId(''); setEmployeeSearch(''); setStartDate(today()); setEndDate(today()); setReason(''); setFormError(''); setCreating(true);
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setFormError('');
    if (!employeeId || !startDate || !endDate || endDate < startDate || endDate < today() || !reason.trim()) {
      setFormError('Select an employee, valid leave dates ending today or later, and a reason.'); return;
    }
    setSubmitting(true);
    try {
      await ApproverAbsenceAPI.create({ employeeId: Number(employeeId), startDate, endDate, reason: reason.trim() });
      setCreating(false); toast.success('Approver leave recorded. Department backups apply during these dates.'); await load();
    } catch (failure) { setFormError(getApiErrorMessage(failure, 'Could not record approver leave.')); }
    finally { setSubmitting(false); }
  };
  const endAbsence = async (event: React.FormEvent) => {
    event.preventDefault(); if (!ending || !reason.trim()) return;
    setSubmitting(true); setFormError('');
    try {
      await ApproverAbsenceAPI.revoke(ending.id, reason.trim());
      setEnding(null); toast.success('Leave coverage ended. Pending requests return to the original approver.'); await load();
    } catch (failure) { setFormError(getApiErrorMessage(failure, 'Could not end leave coverage.')); }
    finally { setSubmitting(false); }
  };

  return <div className="space-y-5">
    <div className="page-header flex flex-wrap items-center justify-between gap-3">
      <div><h1>Delegation Management</h1><p>Mark an approver on leave to activate the department’s backup approvers.</p></div>
      <div className="mobile-actions flex flex-wrap gap-3">
        <button className="btn btn-outline" onClick={() => void load()} disabled={loading}><RefreshCw size={16} /> Refresh</button>
        <button className="btn btn-primary" onClick={openCreate} disabled={loading || !!error}><Plus size={16} /> Record Approver Leave</button>
      </div>
    </div>
    <div className="glass-card p-4 space-y-2">
      <p>Set department backups for <strong>Noted by / Line leader</strong>, <strong>Recommending</strong>, and <strong>Approver / 2nd approver</strong> in <Link to="/departments" className="text-primary underline">Departments</Link>.</p>
      <p className="text-sm text-muted">During recorded leave, pending requests go to the available backup for manual approval. Operator requests use the backup for their chosen line leader. Existing manual delegations take priority. Completed decisions stay recorded.</p>
    </div>
    {error && <div role="alert" className="alert alert-danger"><AlertCircle size={18} /> {error}</div>}
    <section className="glass-card overflow-hidden" aria-label="Approver leave records">
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex flex-wrap gap-3" aria-label="Filter approver leave records">
          {(['Current', 'Scheduled', 'History', 'All'] as Filter[]).map(value => <button key={value} aria-pressed={filter === value} className={`btn btn-sm ${filter === value ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter(value)}>{value}</button>)}
        </div>
        <label htmlFor="absence-search" className="form-label">Search approver leave</label>
        <input id="absence-search" className="form-input w-full" value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, department, or reason" />
      </div>
      {loading ? <div className="loading-spinner min-h-64"><div className="spinner" /></div> : visible.length ?
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 p-4">{visible.map(record => <article key={record.id} className="rounded-xl border border-border p-4 min-w-0 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="font-bold break-words">{record.employeeName}</h2><p className="text-sm text-muted break-words">{record.employeePosition} · {record.employeeDepartment}</p></div><span className={`badge ${record.status === 'Active' ? 'badge-success' : record.status === 'Scheduled' ? 'badge-primary' : 'badge-outline'}`}>{record.status === 'Revoked' ? 'Ended' : record.status}</span></div>
          <p className="flex flex-wrap items-center gap-2 text-sm"><Calendar size={16} /> {formatDate(record.startDate)} – {formatDate(record.endDate)}</p>
          <p className="text-sm break-words whitespace-pre-wrap">{record.reason}</p>
          <p className="text-sm text-muted">Coverage: department stage backups</p>
          <p className="text-xs text-muted break-words">Recorded by {record.createdBy}</p>
          {record.revocationReason && <p className="text-sm break-words">Ended by {record.revokedBy}: {record.revocationReason}</p>}
          {['Active', 'Scheduled'].includes(record.status) && <button className="btn btn-outline w-full" onClick={() => { setEnding(record); setReason(''); setFormError(''); }}>End leave coverage for {record.employeeName}</button>}
        </article>)}</div> : <div className="empty-state p-6"><h2>No approver leave found</h2><p>Record an absence or change the filters.</p></div>}
    </section>

    {creating && <DialogOverlay label="Record approver leave" onClose={() => !submitting && setCreating(false)} closeOnEscape={!submitting} closeOnBackdrop={!submitting}>
      <div className="modal-content max-w-xl w-full p-6 space-y-4">
        <div className="modal-header"><h2>Record Approver Leave</h2><button className="modal-close" aria-label="Close approver leave form" disabled={submitting} onClick={() => setCreating(false)}><X size={20} /></button></div>
        {formError && <p role="alert" className="text-danger">{formError}</p>}
        <form onSubmit={save} className="space-y-4">
          <div><label className="form-label" htmlFor="absence-employee-search">Find employee</label><input id="absence-employee-search" className="form-input w-full" value={employeeSearch} onChange={event => setEmployeeSearch(event.target.value)} placeholder="Name, ID, or department" disabled={submitting} /></div>
          <div><label className="form-label" htmlFor="absence-employee">Approver on leave *</label><select id="absence-employee" className="form-select w-full" required value={employeeId} onChange={event => setEmployeeId(event.target.value)} disabled={submitting}>
            <option value="">Select employee on leave</option>
            {employees.filter(employee => String(employee.id) === employeeId || [employee.fullName, employee.employeeID, employee.department].some(value => value?.toLocaleLowerCase().includes(employeeSearch.trim().toLocaleLowerCase()))).map(employee => <option key={employee.id} value={employee.id}>{employee.fullName} · {employee.employeeID} ({employee.department || 'No department'})</option>)}
          </select></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="form-label" htmlFor="absence-start">Leave start date *</label><input id="absence-start" className="form-input w-full" type="date" required value={startDate} disabled={submitting} onChange={event => { setStartDate(event.target.value); if (endDate < event.target.value) setEndDate(event.target.value); }} /></div>
            <div><label className="form-label" htmlFor="absence-end">Leave end date *</label><input id="absence-end" className="form-input w-full" type="date" required min={startDate > today() ? startDate : today()} value={endDate} disabled={submitting} onChange={event => setEndDate(event.target.value)} /></div>
          </div>
          {employeeId && <section className="rounded-xl border border-border p-3 space-y-3" aria-label="Department coverage preview"><h3 className="font-semibold">Department backups</h3>
            {coverage.length ? coverage.map(item => <div key={item.key} className="text-sm"><p className="font-semibold break-words">{item.department} · {item.label}</p><p className={(!item.backup || item.unavailable) ? 'text-warning' : 'text-muted'}>{item.backup || 'No backup configured'}{item.unavailable ? ' — unavailable during these dates' : ''}</p></div>) : <p className="text-sm text-muted">No current department stage assignments found for this employee.</p>}
            <p className="text-sm text-muted">Missing or unavailable backups leave affected requests pending. Configure backups in Departments. A dated manual delegation overrides these defaults.</p>
          </section>}
          <div><label className="form-label" htmlFor="absence-reason">Reason *</label><textarea id="absence-reason" className="form-textarea w-full" required maxLength={500} rows={3} value={reason} disabled={submitting} onChange={event => setReason(event.target.value)} placeholder="Example: Annual leave" /></div>
          <div className="flex justify-end gap-3"><button type="button" className="btn btn-outline" disabled={submitting} onClick={() => setCreating(false)}>Cancel</button><button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Saving…' : 'Record Leave'}</button></div>
        </form>
      </div>
    </DialogOverlay>}

    {ending && <DialogOverlay label="End approver leave coverage" onClose={() => !submitting && setEnding(null)} closeOnEscape={!submitting} closeOnBackdrop={!submitting}>
      <div className="modal-content max-w-lg w-full p-6 space-y-4"><div className="modal-header"><h2>End leave coverage</h2><button className="modal-close" aria-label="Close end coverage form" disabled={submitting} onClick={() => setEnding(null)}><X size={20} /></button></div>
        <p>Pending requests return to {ending.employeeName}. Completed decisions remain recorded.</p>
        {formError && <p role="alert" className="text-danger">{formError}</p>}
        <form onSubmit={endAbsence} className="space-y-4"><label className="form-label" htmlFor="absence-end-reason">Reason for ending coverage *</label><textarea id="absence-end-reason" className="form-textarea w-full" rows={3} required maxLength={500} value={reason} disabled={submitting} onChange={event => setReason(event.target.value)} /><div className="flex justify-end gap-3"><button type="button" className="btn btn-outline" disabled={submitting} onClick={() => setEnding(null)}>Cancel</button><button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Saving…' : 'End Coverage'}</button></div></form>
      </div>
    </DialogOverlay>}
  </div>;
}
