import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Calendar, Clock3, History, Plus, Search, ShieldCheck, UserCheck, Users, X } from 'lucide-react';
import { DelegationAPI, HRAPI, getApiErrorMessage, type DelegationRecord, type HREmployee } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ToastProvider';
import { DialogOverlay } from '../components/ui/DialogOverlay';
import { ApproverAbsenceManagement } from './ApproverAbsenceManagement';

type DelegationStatus = 'Active' | 'Scheduled' | 'Expired' | 'Revoked';
type ViewFilter = 'Current' | 'Scheduled' | 'History' | 'All';

const localDate = (value: string) => new Date(`${value.slice(0, 10)}T00:00:00`);
const formatDate = (value: string) => localDate(value).toLocaleDateString();
const todayInput = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
const resolveStatus = (item: DelegationRecord): DelegationStatus => {
  if (item.status) return item.status;
  if (!item.isActive) return item.revokedAt ? 'Revoked' : 'Expired';
  const today = localDate(todayInput());
  if (localDate(item.endDate) < today) return 'Expired';
  return localDate(item.startDate) > today ? 'Scheduled' : 'Active';
};

export const ApproverDelegationPage: React.FC = () => {
  const { user } = useAuth();
  const canManageAbsences = ['SystemAdmin', 'Admin', 'HRStaff', 'HRManager'].includes(user?.role || '');
  const [mode, setMode] = useState<'absences' | 'manual'>('absences');
  if (!canManageAbsences) return <ManualDelegationManagement />;
  return <div className="space-y-5">
    <div className="flex flex-wrap gap-3" aria-label="Delegation management views">
      <button className={`btn ${mode === 'absences' ? 'btn-primary' : 'btn-outline'}`} aria-pressed={mode === 'absences'} onClick={() => setMode('absences')}>Approver Leave</button>
      <button className={`btn ${mode === 'manual' ? 'btn-primary' : 'btn-outline'}`} aria-pressed={mode === 'manual'} onClick={() => setMode('manual')}>Manual Delegations</button>
    </div>
    {mode === 'absences' ? <ApproverAbsenceManagement /> : <ManualDelegationManagement />}
  </div>;
};

const ManualDelegationManagement: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();
  const isHRorAdmin = ['SystemAdmin', 'Admin', 'HRStaff', 'HRManager'].includes(user?.role || '');
  const [delegations, setDelegations] = useState<DelegationRecord[]>([]);
  const [employees, setEmployees] = useState<HREmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [view, setView] = useState<ViewFilter>('Current');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [delegatorId, setDelegatorId] = useState(0);
  const [delegateId, setDelegateId] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState('');
  const [revokingDelegation, setRevokingDelegation] = useState<DelegationRecord | null>(null);
  const [revocationReason, setRevocationReason] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [delegationList, employeeList] = await Promise.all([DelegationAPI.getAll(), HRAPI.getEmployees()]);
      setDelegations(delegationList);
      setEmployees(employeeList);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to load delegation management data.'));
    } finally { setLoading(false); }
  };
  useEffect(() => { void loadData(); }, []);

  const rows = useMemo(() => delegations.map(item => ({ item, status: resolveStatus(item) })), [delegations]);
  const counts = useMemo(() => ({
    Active: rows.filter(row => row.status === 'Active').length,
    Scheduled: rows.filter(row => row.status === 'Scheduled').length,
    History: rows.filter(row => row.status === 'Expired' || row.status === 'Revoked').length
  }), [rows]);
  const visibleRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return rows.filter(row => {
      const inView = view === 'All' || (view === 'Current' && row.status === 'Active') ||
        (view === 'Scheduled' && row.status === 'Scheduled') ||
        (view === 'History' && (row.status === 'Expired' || row.status === 'Revoked'));
      if (!inView) return false;
      if (!query) return true;
      const item = row.item;
      return [item.delegatorName, item.delegateName, item.delegatorDepartment, item.delegateDepartment, item.reason]
        .some(value => value?.toLocaleLowerCase().includes(query));
    });
  }, [rows, search, view]);

  const openCreate = () => {
    const today = todayInput();
    setDelegatorId(isHRorAdmin ? 0 : (user?.id || 0));
    setDelegateId(0); setStartDate(today); setEndDate(today); setReason(''); setFormError(''); setIsModalOpen(true);
  };

  const createDelegation = async (event: React.FormEvent) => {
    event.preventDefault(); setFormError('');
    if (!delegatorId || !delegateId) return setFormError('Select both the original and acting approver.');
    if (delegatorId === delegateId) return setFormError('The original and acting approver must be different employees.');
    if (!startDate || !endDate) return setFormError('Select a complete date range.');
    if (startDate < todayInput()) return setFormError('The start date cannot be in the past.');
    if (endDate < startDate) return setFormError('The end date cannot be earlier than the start date.');
    if (!reason.trim()) return setFormError('Enter a reason for this delegation.');
    setSubmitting(true);
    try {
      await DelegationAPI.create({ delegatorId, delegateId, startDate, endDate, reason: reason.trim() });
      toast.success(startDate === todayInput() ? 'Delegation activated successfully.' : 'Delegation scheduled successfully.');
      setIsModalOpen(false); await loadData();
    } catch (error) { setFormError(getApiErrorMessage(error, 'Failed to create delegation.')); }
    finally { setSubmitting(false); }
  };

  const revokeDelegation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!revokingDelegation) return;
    if (!revocationReason.trim()) return toast.error('Enter a revocation reason for the audit record.');
    setSubmitting(true);
    try {
      await DelegationAPI.revoke(revokingDelegation.id, revocationReason.trim());
      toast.success('Delegation revoked successfully.');
      setRevokingDelegation(null); setRevocationReason(''); await loadData();
    } catch (error) { toast.error(getApiErrorMessage(error, 'Failed to revoke delegation.')); }
    finally { setSubmitting(false); }
  };

  const statusClass = (status: DelegationStatus) => status === 'Active' ? 'badge-success' : status === 'Scheduled' ? 'badge-primary' : status === 'Revoked' ? 'badge-danger' : 'badge-outline';

  return <div className="animate-fade-in page-container max-w-7xl mx-auto p-4 sm:p-6 space-y-5">
    <div className="page-header flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div><h1 className="flex items-center gap-2"><UserCheck className="text-primary" size={25} /> Delegation Management</h1><p>Assign temporary acting approvers with validated schedules, live routing, notifications, and an auditable history.</p></div>
      <button className="btn btn-primary shrink-0" onClick={openCreate}><Plus size={16} /> New Delegation</button>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="glass-card p-4 flex items-center gap-3"><ShieldCheck className="text-success" /><div><div className="text-2xl font-bold">{counts.Active}</div><div className="text-xs text-muted">Currently Active</div></div></div>
      <div className="glass-card p-4 flex items-center gap-3"><Clock3 className="text-primary" /><div><div className="text-2xl font-bold">{counts.Scheduled}</div><div className="text-xs text-muted">Scheduled</div></div></div>
      <div className="glass-card p-4 flex items-center gap-3"><History className="text-muted" /><div><div className="text-2xl font-bold">{counts.History}</div><div className="text-xs text-muted">Expired or Revoked</div></div></div>
    </div>

    <div className="glass-card overflow-hidden">
      <div className="p-4 border-b border-border flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">{(['Current', 'Scheduled', 'History', 'All'] as ViewFilter[]).map(filter => <button key={filter} className={`btn btn-sm ${view === filter ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView(filter)}>{filter} ({filter === 'Current' ? counts.Active : filter === 'Scheduled' ? counts.Scheduled : filter === 'History' ? counts.History : rows.length})</button>)}</div>
        <div className="relative w-full lg:w-72"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input className="form-input w-full pl-9" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search people, department, reason..." /></div>
      </div>
      {loading ? <div className="loading-spinner min-h-64"><div className="spinner" /></div> : visibleRows.length ? <div className="data-table-wrapper"><table className="data-table"><thead><tr><th>Original Approver</th><th>Acting Approver</th><th>Effective Dates</th><th>Reason</th><th>Status</th><th className="text-right">Action</th></tr></thead><tbody>{visibleRows.map(({ item, status }) => <tr key={item.id}><td><div className="font-bold">{item.delegatorName}</div><div className="text-xs text-muted">{item.delegatorPosition} · {item.delegatorDepartment}</div></td><td><div className="font-bold">{item.delegateName}</div><div className="text-xs text-muted">{item.delegatePosition} · {item.delegateDepartment}</div></td><td><div className="flex items-center gap-1.5"><Calendar size={14} className="text-primary" />{formatDate(item.startDate)} – {formatDate(item.endDate)}</div></td><td className="max-w-xs"><div className="truncate" title={item.reason}>{item.reason}</div>{item.revocationReason && <div className="text-xs text-danger mt-1" title={item.revocationReason}>Revoked: {item.revocationReason}</div>}</td><td><span className={`badge ${statusClass(status)}`}>{status}</span></td><td className="text-right">{(status === 'Active' || status === 'Scheduled') && <button className="btn btn-outline btn-sm text-danger" onClick={() => { setRevokingDelegation(item); setRevocationReason(''); }}>Revoke</button>}</td></tr>)}</tbody></table></div> : <div className="empty-state min-h-64"><Users size={38} /><h3>No delegations found</h3><p>Create a temporary acting-approver assignment or change the filters.</p></div>}
    </div>

    {isModalOpen && <DialogOverlay onClose={() => !submitting && setIsModalOpen(false)} label="Create delegation" closeOnEscape={!submitting} closeOnBackdrop={!submitting}><div className="modal-content glass-card max-w-lg w-full p-6 space-y-4"><div className="modal-header"><div><h2>Create Delegation</h2><p className="text-xs text-muted mt-1">Authority applies only during the selected dates.</p></div><button className="modal-close" aria-label="Close" disabled={submitting} onClick={() => setIsModalOpen(false)}><X size={18} /></button></div>{formError && <div className="alert alert-danger text-xs"><AlertCircle size={16} /> {formError}</div>}<form onSubmit={createDelegation} className="space-y-4 text-xs"><div><label className="form-label">Original Approver *</label><select className="form-select w-full" value={delegatorId || ''} disabled={!isHRorAdmin || submitting} onChange={event => { setDelegatorId(Number(event.target.value)); setDelegateId(0); }} required><option value="">Select original approver</option>{employees.map(employee => <option key={employee.id} value={employee.id}>{employee.fullName} · {employee.position || 'Staff'} ({employee.department || 'No department'})</option>)}</select></div><div><label className="form-label">Acting Approver *</label><select className="form-select w-full" value={delegateId || ''} disabled={!delegatorId || submitting} onChange={event => setDelegateId(Number(event.target.value))} required><option value="">Select acting approver</option>{employees.filter(employee => employee.id !== delegatorId).map(employee => <option key={employee.id} value={employee.id}>{employee.fullName} · {employee.position || 'Staff'} ({employee.department || 'No department'})</option>)}</select></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div><label className="form-label">Start Date *</label><input className="form-input w-full" type="date" min={todayInput()} value={startDate} disabled={submitting} onChange={event => { setStartDate(event.target.value); if (endDate < event.target.value) setEndDate(event.target.value); }} required /></div><div><label className="form-label">End Date *</label><input className="form-input w-full" type="date" min={startDate || todayInput()} value={endDate} disabled={submitting} onChange={event => setEndDate(event.target.value)} required /></div></div><div><label className="form-label">Reason *</label><textarea className="form-textarea w-full" rows={3} maxLength={500} value={reason} disabled={submitting} onChange={event => setReason(event.target.value)} placeholder="Example: Annual leave coverage" required /><div className="text-right text-[10px] text-muted">{reason.length}/500</div></div><div className="flex justify-end gap-2 pt-3 border-t border-border"><button type="button" className="btn btn-outline" disabled={submitting} onClick={() => setIsModalOpen(false)}>Cancel</button><button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Saving…' : startDate === todayInput() ? 'Activate Delegation' : 'Schedule Delegation'}</button></div></form></div></DialogOverlay>}

    {revokingDelegation && <DialogOverlay onClose={() => !submitting && setRevokingDelegation(null)} label="Revoke delegation" closeOnEscape={!submitting}><div className="modal-content glass-card max-w-md w-full p-6 space-y-4"><div className="modal-header"><h2 className="flex items-center gap-2 text-danger"><AlertCircle size={18} /> Revoke Delegation</h2><button className="modal-close" aria-label="Close" disabled={submitting} onClick={() => setRevokingDelegation(null)}><X size={18} /></button></div><p className="text-xs text-muted">Revoke authority from <strong>{revokingDelegation.delegateName}</strong> acting for <strong>{revokingDelegation.delegatorName}</strong>. Future actions immediately return to the original approver.</p><form onSubmit={revokeDelegation} className="space-y-4"><div><label className="form-label">Revocation Reason *</label><textarea className="form-textarea w-full" rows={3} maxLength={500} value={revocationReason} disabled={submitting} onChange={event => setRevocationReason(event.target.value)} required /></div><div className="flex justify-end gap-2 pt-3 border-t border-border"><button type="button" className="btn btn-outline" disabled={submitting} onClick={() => setRevokingDelegation(null)}>Cancel</button><button type="submit" className="btn btn-danger" disabled={submitting}>{submitting ? 'Revoking…' : 'Confirm Revocation'}</button></div></form></div></DialogOverlay>}
  </div>;
};
