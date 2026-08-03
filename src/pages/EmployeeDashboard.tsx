import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LeaveAPI, type LeaveBalance, type LeaveRequest, type DashboardStats } from '../lib/api';
import { CalendarDays, FileText, CheckCircle, Clock, Plus, TrendingUp } from 'lucide-react';

const getStatusBadge = (status: string) => {
  const s = status.toLowerCase();
  if (s === 'approved') return 'badge-approved';
  if (s === 'disapproved') return 'badge-disapproved';
  if (s === 'cancelled') return 'badge-cancelled';
  return 'badge-pending';
};

export const EmployeeDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentRequests, setRecentRequests] = useState<LeaveRequest[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsData, requests, bal] = await Promise.all([
        LeaveAPI.getDashboardStats(),
        LeaveAPI.getMyRequests(),
        LeaveAPI.getBalance()
      ]);
      setStats(statsData);
      setRecentRequests(requests.slice(0, 5));
      setBalances(bal);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1>Dashboard</h1>
            <p>Welcome back! Here's your leave overview.</p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/file-leave')}>
            <Plus size={16} /> File Leave
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* Stat Cards */}
        <div className="stat-grid">
          <div className="stat-card" style={{ '--accent-color': 'var(--warning)' } as React.CSSProperties}>
            <div className="stat-card-icon" style={{ background: 'var(--warning-light)', color: 'var(--warning)' }}>
              <Clock size={22} />
            </div>
            <div className="stat-card-value">{stats?.pendingRequests ?? 0}</div>
            <div className="stat-card-label">Pending Requests</div>
          </div>
          <div className="stat-card" style={{ '--accent-color': 'var(--success)' } as React.CSSProperties}>
            <div className="stat-card-icon" style={{ background: 'var(--success-light)', color: 'var(--success)' }}>
              <CheckCircle size={22} />
            </div>
            <div className="stat-card-value">{stats?.approvedThisYear ?? 0}</div>
            <div className="stat-card-label">Approved This Year</div>
          </div>
          <div className="stat-card" style={{ '--accent-color': 'var(--primary)' } as React.CSSProperties}>
            <div className="stat-card-icon" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
              <TrendingUp size={22} />
            </div>
            <div className="stat-card-value">
              {stats?.balances?.reduce((sum, b) => sum + b.available, 0)?.toFixed(0) ?? 0}
            </div>
            <div className="stat-card-label">Total Available Days</div>
          </div>
        </div>

        {/* Leave Balances */}
        <div className="glass-card mb-6">
          <div className="glass-card-header">
            <h2><CalendarDays size={18} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />Leave Balances</h2>
          </div>
          <div className="glass-card-body">
            <div className="balance-grid">
              {balances.filter(b => b.totalCredits > 0 || b.used > 0 || b.carryOver > 0).map(b => {
                const total = b.totalCredits + b.carryOver;
                const pct = total > 0 ? Math.min(100, ((total - b.available) / total) * 100) : 0;
                return (
                  <div className="balance-card" key={b.id}>
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
                  </div>
                );
              })}
              {balances.filter(b => b.totalCredits > 0 || b.used > 0 || b.carryOver > 0).length === 0 && (
                <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                  <CalendarDays size={48} />
                  <h3>No Leave Balances</h3>
                  <p>Your leave balances will appear here once HR sets them up.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Requests */}
        <div className="glass-card">
          <div className="glass-card-header">
            <h2><FileText size={18} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />Recent Requests</h2>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/my-requests')}>View All</button>
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
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date Filed</th>
                      <th>Type</th>
                      <th>Date From</th>
                      <th>Date To</th>
                      <th>Days/Hrs</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentRequests.map(r => (
                      <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/leave/${r.id}`)}>
                        <td>{new Date(r.dateFiled).toLocaleDateString()}</td>
                        <td><span className="font-bold">{r.leaveTypeCode}</span></td>
                        <td>{new Date(r.dateFrom).toLocaleDateString()}</td>
                        <td>{new Date(r.dateTo).toLocaleDateString()}</td>
                        <td>{r.totalHours > 0 ? `${r.totalHours}h` : `${r.totalDays}d`}</td>
                        <td><span className={`badge ${getStatusBadge(r.status)}`}><span className="badge-dot"></span>{r.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
