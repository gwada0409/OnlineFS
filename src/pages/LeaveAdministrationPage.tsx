import { useEffect, useState } from 'react';
import api, { getApiErrorMessage } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

type Account = { id: number; leaveTypeId: number; code: string; year: number; totalCredits: number; carryOver: number; used: number; pending: number; available: number };
type Employee = { id: number; employeeID: string; fullName: string; dateHired: string; regularizationDate?: string; group: string; periodStart: string; periodEnd: string; balances: Account[] };
type Preview = { fingerprint: string; employees: number; counts: Record<string, number>; scope?: { year: number; group: string } };
type Recovery = { name: string; size: number; createdAt: string };
type ExceptionRow = { id: number; employee: string; dateFrom: string; dateTo: string; totalDays: number; status: string; hrConfirmedPaidException?: boolean; disciplinaryReviewRequired: boolean };
const date = (value: string) => value.slice(0, 10);

export function LeaveAdministrationPage() {
  const { isAdmin } = useAuth();
  const today = new Date();
  const [year, setYear] = useState(today.getMonth() >= 10 ? today.getFullYear() : today.getFullYear() - 1);
  const [group, setGroup] = useState('All');
  const [rows, setRows] = useState<Employee[]>([]);
  const [exceptions, setExceptions] = useState<ExceptionRow[]>([]);
  const [history, setHistory] = useState<Recovery[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [recovery, setRecovery] = useState<{ name: string; preview: Preview } | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [restoreConfirmation, setRestoreConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setBusy(true); setError(''); setPreview(null); setConfirmation('');
    Promise.all([
      api.get<Employee[]>('/leave-administration/overview', { params: { year, group } }),
      api.get<ExceptionRow[]>('/leave-administration/paid-exceptions', { params: { year, group } }),
      api.get<Recovery[]>('/leave-administration/history')
    ]).then(([employees, decisions, backups]) => {
      if (active) { setRows(employees.data); setExceptions(decisions.data); setHistory(backups.data); }
    }).catch(e => { if (active) { setRows([]); setError(getApiErrorMessage(e)); } }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [year, group, revision]);
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError(''); setMessage('');
    try { await action(); } catch (e) { setError(getApiErrorMessage(e)); } finally { setBusy(false); }
  };
  const scope = { year, group };
  return <div className="space-y-6">
    <div className="page-header"><div><h1>Leave credits &amp; recovery</h1><p className="text-muted">Annual employee allocations, HR paid-leave decisions and protected leave-only reset.</p></div><Link to="/hr/employment-status" className="btn btn-outline">Employees</Link></div>
    <section className="glass-card p-4 space-y-3">
      <h2>Policy effective November 1, 2026</h2>
      <p>Regularization is calculated as hire date + 6 months. Employees regularized January 1, 2026 onward are newcomers, eligible from their hire date. Their SL/VL share one NPL balance capped at 25 days, including carry-over.</p>
      <p className="text-sm text-muted">For newcomers, year 2026 means November 1, 2026–October 31, 2027. Legacy employees retain calendar-year SL/VL. Unused newcomer credits roll forward each November 1. An annual allocation continues until HR sets a later year's allocation.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="form-group">Year<input aria-label="Policy year" className="form-input" type="number" min={2000} max={2100} value={year} disabled={busy} onChange={e => { const n = Number(e.target.value); if (n >= 2000 && n <= 2100) setYear(n); }} /></label>
        <label className="form-group">Employee group<select aria-label="Employee group" className="form-select" value={group} disabled={busy} onChange={e => setGroup(e.target.value)}><option value="All">All employees</option><option value="Newcomer">Newcomers</option><option value="Legacy">Legacy employees</option></select></label>
      </div>
      <button className="btn btn-outline" disabled={busy} onClick={() => setRevision(v => v + 1)}>Refresh</button>
    </section>
    {error && <p role="alert" className="alert alert-danger">{error}</p>}
    {message && <p role="status" className="alert alert-success">{message}</p>}
    {busy && <p role="status">Working…</p>}
    <section className="space-y-3" aria-label="Annual employee credits"><h2>Annual employee credits</h2>
      {rows.map(employee => <article className="glass-card p-4 space-y-3" key={employee.id}>
        <div><strong>{employee.fullName}</strong><p className="text-sm text-muted">{employee.employeeID} · {employee.group} · Hired {employee.dateHired || 'missing'} · Regularization {employee.regularizationDate ? date(employee.regularizationDate) : 'needs review'}</p><p className="text-sm">{date(employee.periodStart)} – {date(employee.periodEnd)}</p></div>
        {employee.balances.map(b => <form key={`${b.id}:${b.totalCredits}:${revision}`} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 items-end border-t border-border pt-3" onSubmit={e => {
          e.preventDefault(); const data = new FormData(e.currentTarget);
          void run(async () => { await api.put('/leave-administration/annual-grants', { employeeId: employee.id, year, leaveTypeId: b.leaveTypeId, credits: Number(data.get('credits')), remarks: data.get('remarks') }); setMessage('Annual credits saved.'); setRevision(v => v + 1); });
        }}>
          <div><strong>{b.code === 'NPL' ? 'Combined paid leave' : b.code}</strong><p className="text-sm">Available {b.available} · Used {b.used} · Pending {b.pending} · Carry-over {b.carryOver}</p></div>
          <label>Annual allocation<input className="form-input" aria-label={`${employee.employeeID} ${b.code} annual credits`} name="credits" type="number" inputMode="decimal" min={0} max={b.code === 'NPL' ? 25 : 365} step="0.5" defaultValue={b.totalCredits} required disabled={busy} /></label>
          <label>HR remarks<input className="form-input" name="remarks" maxLength={500} disabled={busy} /></label>
          <button className="btn btn-primary min-h-11" disabled={busy}>Save allocation</button>
        </form>)}
        {!employee.balances.length && <p className="text-muted">No account for this period. Check the hire date and selected year.</p>}
      </article>)}
      {!busy && !rows.length && <p>No employees in this selection.</p>}
    </section>
    <section className="glass-card p-4 space-y-4"><h2>HR confirmation: disapproved / voided leave</h2><p className="text-sm text-muted">Confirm actual leave as paid to deduct combined credits and flag disciplinary review. This preserves its disapproved/voided status. A paid decision can be corrected to unpaid, refunding the deduction.</p>
      {exceptions.map(r => <form key={`${r.id}:${r.hrConfirmedPaidException}`} className="border border-border rounded-lg p-3 space-y-3" onSubmit={e => {
        e.preventDefault(); const form = new FormData(e.currentTarget);
        void run(async () => { await api.post(`/leave-administration/paid-exceptions/${r.id}`, { paidLeave: form.get('paid') === 'true', remarks: form.get('remarks') }); setMessage('HR confirmation recorded.'); setRevision(v => v + 1); });
      }}><strong>{r.employee} · #{r.id}</strong><p>{date(r.dateFrom)} – {date(r.dateTo)} · {r.totalDays} days · {r.status}</p><p>{r.hrConfirmedPaidException == null ? 'Awaiting HR confirmation' : r.hrConfirmedPaidException ? 'Paid; credits deducted; disciplinary review required' : 'Confirmed unpaid'}</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3"><label>Decision<select className="form-select" name="paid" defaultValue={String(r.hrConfirmedPaidException ?? true)} disabled={busy}><option value="true">Paid actual leave / disciplinary review</option><option value="false">Unpaid / not taken</option></select></label><label>Confirmation remarks<input className="form-input" name="remarks" required maxLength={500} disabled={busy} /></label><button className="btn btn-primary min-h-11" disabled={busy}>Confirm HR decision</button></div>
      </form>)}
      {!exceptions.length && <p className="text-muted">No applicable disapproved or voided leave in this selection.</p>}
    </section>
    {isAdmin && <section className="glass-card p-4 space-y-4"><h2>Clear selected leave data</h2><p>Preview the selected year/group. The system must create and verify a leave-only ZIP first. Clearing sets initial credits to 20: combined NPL for newcomers or 10 SL + 10 VL for legacy employees. Employee records, department settings and recovery keys are preserved.</p>
      <button className="btn btn-outline" disabled={busy} onClick={() => void run(async () => { setPreview((await api.post<Preview>('/leave-administration/preview', scope)).data); })}>Preview year/group</button>
      {preview && <div className="space-y-3 border border-border rounded-lg p-4"><p><strong>{preview.employees} employees · {year} · {group}</strong></p><dl className="grid grid-cols-2 gap-2 text-sm">{Object.entries(preview.counts).map(([name, count]) => <div key={name}><dt>{name}</dt><dd>{count}</dd></div>)}</dl><label className="block">Type CLEAR {year}<input className="form-input" aria-label="Clear confirmation" value={confirmation} onChange={e => setConfirmation(e.target.value)} disabled={busy} /></label><button className="btn btn-danger min-h-11 w-full md:w-auto" disabled={busy || confirmation !== `CLEAR ${year}`} onClick={() => void run(async () => {
        const result = await api.post<{ backupName: string }>('/leave-administration/maintenance/clear', { scope, confirmation, fingerprint: preview.fingerprint }); setMessage(`Selected leave data cleared. Verified recovery: ${result.data.backupName}`); setPreview(null); setConfirmation(''); setRevision(v => v + 1);
      })}>Back up, verify &amp; clear selection</button></div>}
    </section>}
    <section className="glass-card p-4 space-y-3"><h2>Leave-only recovery copies</h2><p className="text-sm text-muted">Private server copies include credits, grants, ledger, requests, approvals, leave audit records, notifications and attachments. Existing full-system ZIP backups remain available separately.</p>
      {history.map(item => <div key={item.name} className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3"><div className="min-w-0 flex-1 break-all"><strong>{item.name}</strong><p className="text-sm text-muted">{(item.size / 1024 / 1024).toFixed(1)} MB</p></div>{isAdmin && <button className="btn btn-outline min-h-11" disabled={busy} onClick={() => void run(async () => { const p = await api.post<Preview>('/leave-administration/restore-preview', { name: item.name, confirmation: '' }); setRecovery({ name: item.name, preview: p.data }); setRestoreConfirmation(''); })}>Preview restore</button>}</div>)}
      {!history.length && <p>No leave reset recovery copies yet.</p>}
      {isAdmin && recovery && <div className="space-y-3 border border-border rounded-lg p-4"><p className="break-all">Restore {recovery.name}: {recovery.preview.employees} employees, {recovery.preview.counts.LeaveRequests ?? 0} requests. This replaces only the saved leave scope, after creating another safety backup.</p><label>Type RESTORE LEAVE<input className="form-input" aria-label="Leave restore confirmation" value={restoreConfirmation} disabled={busy} onChange={e => setRestoreConfirmation(e.target.value)} /></label><button className="btn btn-danger min-h-11" disabled={busy || restoreConfirmation !== 'RESTORE LEAVE'} onClick={() => void run(async () => { await api.post('/leave-administration/maintenance/restore', { name: recovery.name, confirmation: restoreConfirmation }); setMessage('Leave scope restored. Employee records and department settings preserved.'); setRecovery(null); setRevision(v => v + 1); })}>Restore leave scope</button><button className="btn btn-outline ml-3" onClick={() => setRecovery(null)} disabled={busy}>Cancel</button></div>}
    </section>
  </div>;
}
