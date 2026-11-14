import { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle, Database, RefreshCw, RotateCcw, ShieldCheck, Users, Wrench } from 'lucide-react';
import { SystemRepairAPI, getApiErrorMessage, type SystemRepairOverview } from '../lib/api';
import { useToast } from '../components/ToastProvider';
import { useConfirm } from '../components/ConfirmDialog';

export const SystemRepairPage = () => {
  const toast = useToast();
  const confirm = useConfirm();
  const [overview, setOverview] = useState<SystemRepairOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [repairing, setRepairing] = useState<string | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try { setOverview(await SystemRepairAPI.overview()); }
    catch (error) { if (!quiet) toast.error(getApiErrorMessage(error, 'Could not load system diagnostics.')); }
    finally { if (!quiet) setLoading(false); }
  }, [toast]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 60000);
    return () => window.clearInterval(timer);
  }, [load]);

  const runRepair = async (kind: 'balances' | 'notifications') => {
    const balances = kind === 'balances';
    const accepted = await confirm({
      title: balances ? 'Initialize missing balances?' : 'Retry failed notifications?',
      message: balances
        ? `Create the ${overview?.diagnostics.missingAnnualBalances ?? 0} missing ${overview?.diagnostics.balanceYear ?? ''} balance records using configured leave policies. Existing balances will not be overwritten.`
        : `Queue ${overview?.diagnostics.retryableFailedDeliveries ?? 0} eligible failed deliveries for another attempt.`,
      confirmText: balances ? 'Initialize balances' : 'Retry deliveries'
    });
    if (!accepted) return;
    setRepairing(kind);
    try {
      if (balances) {
        const result = await SystemRepairAPI.initializeMissingBalances();
        toast.success(`Created ${result.createdBalances} balances for ${result.affectedEmployees} employees.`);
      } else {
        const result = await SystemRepairAPI.retryFailedNotifications();
        toast.success(`Queued ${result.queuedDeliveries} notification deliveries.`);
      }
      await load(true);
    } catch (error) { toast.error(getApiErrorMessage(error, 'The repair could not be completed.')); }
    finally { setRepairing(null); }
  };

  const diagnostics = overview?.diagnostics;
  const cards = [
    { label: 'Database integrity', value: diagnostics?.databaseIntegrity ?? '—', good: diagnostics?.databaseIntegrity === 'ok', Icon: Database },
    { label: 'Foreign-key violations', value: diagnostics?.foreignKeyViolations ?? '—', good: diagnostics?.foreignKeyViolations === 0, Icon: ShieldCheck },
    { label: 'Missing annual balances', value: diagnostics?.missingAnnualBalances ?? '—', good: diagnostics?.missingAnnualBalances === 0, Icon: Activity },
    { label: 'Delayed deliveries', value: diagnostics?.staleDeliveries ?? '—', good: diagnostics?.staleDeliveries === 0, Icon: RotateCcw },
    { label: 'Unassigned employees', value: diagnostics?.unassignedEmployees ?? '—', good: diagnostics?.unassignedEmployees === 0, Icon: Users },
    { label: 'Pending over 7 days', value: diagnostics?.stalePendingRequests ?? '—', good: diagnostics?.stalePendingRequests === 0, Icon: AlertTriangle },
  ];

  return <div className="space-y-6 animate-fade-in">
    <div className="page-header">
      <div className="flex items-center gap-3"><Wrench size={28} className="text-primary"/><div><h1>System Health & Repair</h1><p className="text-muted">SystemAdmin-only diagnostics and narrowly scoped recovery tools.</p></div></div>
      <button className="btn btn-outline" onClick={() => void load()} disabled={loading || !!repairing}><RefreshCw size={16} className={loading ? 'animate-spin' : ''}/> Refresh</button>
    </div>

    <div className={`alert ${overview?.status === 'Healthy' ? 'alert-success' : 'alert-warning'}`} role="status">
      {overview?.status === 'Healthy' ? <CheckCircle size={18}/> : <AlertTriangle size={18}/>} <strong>{overview?.status ?? 'Checking…'}</strong>
      {overview && <span className="text-xs ml-2">Version {overview.applicationVersion} · {overview.environment} · checked {new Date(overview.collectedAt).toLocaleString()}</span>}
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {cards.map(({ label, value, good, Icon }) => <div className="glass-card p-5" key={label}><div className="flex items-center justify-between"><span className="text-sm text-muted">{label}</span><Icon size={18} className={good ? 'text-success' : 'text-warning'}/></div><div className="text-2xl font-bold mt-2">{value}</div></div>)}
    </div>

    <section className="glass-card">
      <div className="glass-card-header"><div><h2>Available repairs</h2><p className="text-xs text-muted mt-1">Repairs never overwrite existing balances and every run is recorded in the audit log.</p></div></div>
      <div className="glass-card-body grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border border-border rounded-xl p-4"><h3>Initialize missing annual balances</h3><p className="text-xs text-muted my-2">Creates only missing {diagnostics?.balanceYear} balance and beginning-ledger records.</p><button className="btn btn-primary" disabled={!diagnostics?.missingAnnualBalances || !!repairing} onClick={() => void runRepair('balances')}><Wrench size={15}/>{repairing === 'balances' ? 'Repairing…' : 'Preview & repair'}</button></div>
        <div className="border border-border rounded-xl p-4"><h3>Retry failed notification delivery</h3><p className="text-xs text-muted my-2">Requeues retryable deliveries below the five-attempt safety limit.</p><button className="btn btn-primary" disabled={!diagnostics?.retryableFailedDeliveries || !!repairing} onClick={() => void runRepair('notifications')}><RotateCcw size={15}/>{repairing === 'notifications' ? 'Repairing…' : 'Preview & retry'}</button></div>
      </div>
    </section>

    <section className="glass-card">
      <div className="glass-card-header"><h2>Recent repair history</h2></div>
      <div className="divide-y divide-border">{overview?.recentRepairs.map(item => <div className="p-4" key={item.id}><div className="flex justify-between gap-3"><strong>{item.action}</strong><span className="text-xs text-muted">{new Date(item.timestamp).toLocaleString()}</span></div><p className="text-xs text-muted mt-1">{item.details} · {item.username}</p></div>)}{overview && overview.recentRepairs.length === 0 && <p className="p-5 text-muted">No repairs have been run.</p>}</div>
    </section>
  </div>;
};
