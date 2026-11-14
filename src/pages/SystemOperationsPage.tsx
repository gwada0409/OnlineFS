import { useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Bell, ShieldCheck, RefreshCw, FileText, CheckCircle, Users, Clock } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { NotificationService } from '../services/notificationService';
import { BackupRestorePanel } from '../components/BackupRestorePanel';

interface Overview {
  unread: number;
  critical: number;
  integrationEvents24Hours: number;
  operationalEvents24Hours: number;
  leaveActivity: { pending: number; filed24Hours: number; decisions24Hours: number; employeesOnLeave: number };
  collectedAt: string;
  recent: { id: number; title: string; category: string; severity: string; createdAt: string; isRead: boolean }[];
}

export const SystemOperationsPage = () => {
  const { isSystemAdmin } = useAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    let version = 0;
    const refresh = async () => {
      const request = ++version;
      try {
        const response = await api.get<Overview>('/system-operations/overview');
        if (active && request === version) { setOverview(response.data); setError(false); }
      } catch { if (active && request === version) setError(true); }
    };
    void refresh();
    const unsubscribe = NotificationService.subscribe(() => { void refresh(); });
    const interval = window.setInterval(() => { void refresh(); }, 30000);
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => { active = false; unsubscribe(); window.clearInterval(interval); window.removeEventListener('focus', onFocus); };
  }, [revision]);
  const inbox = '/notifications?workspace=System';
  const leaveCards: Array<{ label: string; value?: number; Icon: ComponentType<{ size?: number; className?: string }> }> = [
    { label: 'Pending leave requests', value: overview?.leaveActivity?.pending, Icon: Clock },
    { label: 'Filed · last 24h', value: overview?.leaveActivity?.filed24Hours, Icon: FileText },
    { label: 'Decisions · last 24h', value: overview?.leaveActivity?.decisions24Hours, Icon: CheckCircle },
    { label: 'Employees on leave today', value: overview?.leaveActivity?.employeesOnLeave, Icon: Users }
  ];
  return <div className="space-y-6">
    <div className="page-header">
      <div className="flex items-center gap-3"><ShieldCheck size={28} className="text-primary" /><div>
        <h1>{isSystemAdmin ? 'System Administration' : 'System Operations'}</h1>
        <p className="text-muted">Application alerts and operational events. Employee leave content is kept in separate workspaces.</p>
      </div></div>
      <button className="btn btn-outline" onClick={() => setRevision(v => v + 1)}><RefreshCw size={16} /> Refresh</button>
    </div>
    {error && <p role="alert" className="text-danger">Could not refresh operational alerts. Retry to retrieve current data.</p>}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[
        ['Unread system alerts', overview?.unread],
        ['Unread critical alerts', overview?.critical],
        ['Integration events · last 24h', overview?.integrationEvents24Hours],
        ['All operational events · last 24h', overview?.operationalEvents24Hours]
      ].map(([label, value]) => <Link key={label} to={inbox} className="glass-card p-5 block hover:border-primary focus-visible:outline focus-visible:outline-primary">
        <span className="text-muted text-sm">{label}</span><div className="text-3xl font-bold mt-2">{value ?? '—'}</div>
      </Link>)}
    </div>
    <p className="text-xs text-muted">Counts reflect recorded alerts addressed to you, not a live infrastructure health check. No alerts does not guarantee that integrations are healthy.{overview && ` Last refreshed ${new Date(overview.collectedAt).toLocaleString()}.`}</p>
    <section className="space-y-3" aria-labelledby="leave-operations-heading">
      <div>
        <h2 id="leave-operations-heading" className="text-lg font-bold">HR leave activity</h2>
        <p className="text-xs text-muted mt-1">Live aggregate workflow counts. Open HR Operations to review employee-level details.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {leaveCards.map(({ label, value, Icon }) => <Link key={label} to="/hr" className="glass-card p-5 block hover:border-primary focus-visible:outline focus-visible:outline-primary">
          <div className="flex items-center justify-between gap-3"><span className="text-muted text-sm">{label}</span><Icon size={18} className="text-primary" /></div>
          <div className="text-3xl font-bold mt-2">{value == null ? '—' : value}</div>
        </Link>)}
      </div>
    </section>
    <div className="flex flex-wrap gap-3">
      <Link className="btn btn-primary" to={inbox}><Bell size={16} /> Open System Alerts</Link>
      {isSystemAdmin && <Link className="btn btn-outline" to="/system-admin"><ShieldCheck size={16} /> User & Role Management</Link>}
    </div>
    <Link to="/hr/leave-administration" className="btn btn-outline">Leave credits, clear &amp; recovery</Link>
    <BackupRestorePanel />
    <section className="glass-card">
      <div className="glass-card-header"><h2 className="flex items-center gap-2"><Activity size={18} /> Recent operational events</h2></div>
      <div className="divide-y divide-border">
        {overview?.recent.map(alert => <Link key={alert.id} to={`${inbox}&focus=${alert.id}`} className="block p-4 hover:bg-primary/5">
          <div className="flex justify-between gap-4"><span className="font-medium">{alert.title}</span><span className="text-xs text-muted">{alert.isRead ? 'Read' : 'Unread'}</span></div>
          <p className="text-xs text-muted mt-1">{alert.category} · {alert.severity} · {new Date(alert.createdAt).toLocaleString()}</p>
        </Link>)}
        {overview?.recent.length === 0 && <p className="p-6 text-muted">No recorded system alerts addressed to this account.</p>}
        {!overview && !error && <p className="p-6 text-muted" role="status">Loading operational events…</p>}
      </div>
    </section>
  </div>;
};
