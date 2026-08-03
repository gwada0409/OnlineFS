import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LeaveAPI, type LeaveRequest } from '../lib/api';
import { Clock, Filter, Eye, Trash2 } from 'lucide-react';
import { useToast } from '../components/ToastProvider';
import { useConfirm } from '../components/ConfirmDialog';

export const MyRequestsPage: React.FC = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const confirm = useConfirm();

  const handleDelete = async (id: number) => {
    if (await confirm({
      title: 'Delete Request',
      message: 'Are you sure you want to permanently delete this pending leave request? This action cannot be undone.',
      confirmText: 'Delete',
      variant: 'danger'
    })) {
      try {
        await LeaveAPI.deleteRequest(id);
        toast.success('Leave request deleted successfully');
        loadRequests();
      } catch (err: any) {
        toast.error(err.response?.data || 'Failed to delete request');
      }
    }
  };

  useEffect(() => {
    loadRequests();
  }, [filter]);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const data = await LeaveAPI.getMyRequests(filter);
      setRequests(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'approved') return 'badge-approved';
    if (s === 'disapproved') return 'badge-disapproved';
    if (s === 'cancelled') return 'badge-cancelled';
    return 'badge-pending';
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1>My Leave Requests</h1>
        <p>View and track the status of your leave applications</p>
      </div>

      <div className="page-body">
        <div className="glass-card">
          <div className="glass-card-header">
            <div className="flex items-center gap-4">
              <Clock size={18} />
              <h2>All Requests</h2>
            </div>
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-muted" />
              <select className="form-select btn-sm" value={filter} onChange={e => setFilter(e.target.value)} style={{ minWidth: 160 }}>
                <option value="">All Statuses</option>
                <option value="Approved">Approved</option>
                <option value="Disapproved">Disapproved</option>
                <option value="Cancelled">Cancelled</option>
                <option value="PendingSupervisor">Pending Supervisor</option>
                <option value="PendingDepartmentManager">Pending Dept Manager</option>
                <option value="PendingHRSection">Pending HR</option>
              </select>
            </div>
          </div>

          <div className="glass-card-body">
            {loading ? (
              <div className="loading-spinner"><div className="spinner"></div></div>
            ) : requests.length === 0 ? (
              <div className="empty-state flex flex-col items-center justify-center py-16 text-center">
                <Clock size={48} className="text-muted mb-4 opacity-50" />
                <h3 className="text-lg font-medium text-white mb-2">No Requests Found</h3>
                <p className="text-sm text-muted">You haven't filed any leave requests matching the selected filter.</p>
              </div>
            ) : (
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date Filed</th>
                      <th>Leave Type</th>
                      <th>Date Range</th>
                      <th>Duration</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map(r => (
                      <tr key={r.id}>
                        <td>{new Date(r.dateFiled).toLocaleDateString()}</td>
                        <td>
                          <div className="font-bold">{r.leaveTypeCode}</div>
                          <div className="text-xs text-muted">{r.leaveTypeDescription}</div>
                        </td>
                        <td>
                          {new Date(r.dateFrom).toLocaleDateString()}
                          {r.dateFrom !== r.dateTo && ` - ${new Date(r.dateTo).toLocaleDateString()}`}
                        </td>
                        <td>{r.totalHours > 0 ? `${r.totalHours}h` : `${r.totalDays}d`}</td>
                        <td><span className={`badge ${getStatusBadge(r.status)}`}><span className="badge-dot"></span>{r.status.replace('Pending', 'Pending ')}</span></td>
                        <td style={{ textAlign: 'right' }}>
                          {r.status.startsWith('Pending') && (
                            <button 
                              className="btn btn-ghost btn-sm text-danger mr-2" 
                              onClick={() => handleDelete(r.id)}
                              title="Delete Request"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                          <button className="btn btn-outline btn-sm" onClick={() => navigate(`/leave/${r.id}`)}>
                            <Eye size={14} /> View
                          </button>
                        </td>
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
