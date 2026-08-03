import React, { useEffect, useState } from 'react';
import { HRAPI } from '../lib/api';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '../components/ToastProvider';

interface EmployeeLeaveDetailProps {
  employee: any;
  onClose: () => void;
  year?: number;
}

export const EmployeeLeaveDetail: React.FC<EmployeeLeaveDetailProps> = ({ employee, onClose, year = new Date().getFullYear() }) => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'overview' | 'ledger' | 'requests'>('overview');
  const [showAllLeaveTypes, setShowAllLeaveTypes] = useState(false);
  const [ledger, setLedger] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedType, setExpandedType] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === 'ledger' && ledger.length === 0) {
      loadLedger();
    }
  }, [activeTab, employee.id]);

  const loadLedger = async () => {
    setLoading(true);
    try {
      const data = await HRAPI.getEmployeeLeaveLedger(employee.id, year);
      setLedger(data);
    } catch (e) {
      toast.error('Failed to load ledger');
    } finally {
      setLoading(false);
    }
  };


  const totalUsed = employee.balances?.reduce((acc: number, curr: any) => acc + curr.used, 0) || 0;
  const totalPending = employee.balances?.reduce((acc: number, curr: any) => acc + curr.pending, 0) || 0;
  const totalAvailable = employee.balances?.reduce((acc: number, curr: any) => acc + curr.available, 0) || 0;

  return (
    <div className="modal-overlay z-50">
      <style>{`
        .leave-modal-inner {
          padding: 16px;
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 0;
        }
        .leave-summary-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 24px;
        }
        .leave-summary-card {
          padding: 12px;
          text-align: center;
        }
        .leave-type-card {
          padding: 12px;
          margin-bottom: 12px;
        }
        .leave-type-header {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .leave-type-stats {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          font-size: 13px;
        }
        .leave-breakdown-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          padding: 16px;
          background: rgba(0,0,0,0.2);
          border-top: 1px solid var(--border);
          font-size: 13px;
        }
        @media (min-width: 768px) {
          .leave-modal-inner { padding: 32px; }
          .leave-summary-grid { grid-template-columns: repeat(4, 1fr); }
          .leave-summary-card { padding: 16px; }
          .leave-type-card { padding: 16px; }
          .leave-type-header { flex-direction: row; align-items: center; gap: 16px; }
          .leave-type-stats { gap: 16px; font-size: 14px; }
          .leave-breakdown-grid { font-size: 14px; }
        }
      `}</style>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content animate-slide-up" style={{ maxWidth: '900px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
        <div className="leave-modal-inner">
          {/* Header */}
          <div className="border-b border-border flex items-start justify-between pb-4 mb-4 shrink-0 gap-2">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg md:text-xl font-bold truncate pr-2">{employee.fullName}</h2>
              <p className="text-xs md:text-sm text-muted truncate">{employee.department} | ID: {employee.employeeID}</p>
            </div>
            <button className="btn btn-ghost btn-sm p-1 shrink-0" onClick={onClose}><X size={20} /></button>
          </div>

          <div className="flex flex-col shrink-0 pb-0">
            {/* Top Summary */}
            <div className="leave-summary-grid">
              <div className="glass-card leave-summary-card" style={{ borderLeft: '4px solid var(--success)' }}>
                <div className="text-[10px] md:text-xs text-muted font-bold uppercase">Available</div>
                <div className="text-xl md:text-2xl font-bold text-success">{totalAvailable}</div>
              </div>
              <div className="glass-card leave-summary-card" style={{ borderLeft: '4px solid var(--danger)' }}>
                <div className="text-[10px] md:text-xs text-muted font-bold uppercase">Used</div>
                <div className="text-xl md:text-2xl font-bold text-danger">{totalUsed}</div>
              </div>
              <div className="glass-card leave-summary-card" style={{ borderLeft: '4px solid var(--warning)' }}>
                <div className="text-[10px] md:text-xs text-muted font-bold uppercase">Pending</div>
                <div className="text-xl md:text-2xl font-bold text-warning">{totalPending}</div>
              </div>
              <div className="glass-card leave-summary-card" style={{ borderLeft: '4px solid var(--primary)' }}>
                <div className="text-[10px] md:text-xs text-muted font-bold uppercase">Projected</div>
                <div className="text-xl md:text-2xl font-bold text-primary">{totalAvailable - totalPending}</div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-border pb-2 scroll-x-auto">
              <button className={`btn ${activeTab === 'overview' ? 'btn-primary' : 'btn-ghost'} btn-sm shrink-0`} onClick={() => setActiveTab('overview')}>
                Leave Types
              </button>
              <button className={`btn ${activeTab === 'ledger' ? 'btn-primary' : 'btn-ghost'} btn-sm shrink-0`} onClick={() => setActiveTab('ledger')}>
                Leave Ledger
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, marginTop: '16px' }} className="pr-1 md:pr-2">
            <div>
              {activeTab === 'overview' && (
                <div className="flex flex-col gap-3">
                  <div className="flex justify-end mb-1">
                    <label className="flex items-center gap-2 text-xs md:text-sm cursor-pointer text-muted hover:text-primary transition-colors">
                      <input 
                        type="checkbox" 
                        checked={showAllLeaveTypes}
                        onChange={(e) => setShowAllLeaveTypes(e.target.checked)}
                        className="rounded border-border bg-base/50 text-primary focus:ring-primary"
                      />
                      Show all
                    </label>
                  </div>
                  
                  {employee.balances?.filter((bal: any) => showAllLeaveTypes || bal.totalCredits > 0 || bal.carryOver > 0 || bal.available > 0 || bal.used > 0 || bal.pending > 0).map((bal: any) => {
                    const isExpanded = expandedType === bal.leaveTypeCode;
                    return (
                      <div key={bal.leaveTypeCode} className="glass-card overflow-hidden leave-type-card">
                        <div 
                          className="flex items-start md:items-center justify-between cursor-pointer hover:bg-base/50 transition-colors"
                          onClick={() => setExpandedType(isExpanded ? null : bal.leaveTypeCode)}
                        >
                          <div className="flex-1 min-w-0 pr-2">
                            <div className="leave-type-header">
                              <span className="font-bold shrink-0">{bal.leaveTypeCode}</span>
                              <div className="leave-type-stats">
                                <span className="text-success font-bold">Available: {bal.available}</span>
                                <span className="text-danger">Used: {bal.used}</span>
                                <span className="text-warning">Pending: {bal.pending}</span>
                              </div>
                            </div>
                          </div>
                          <button className="btn btn-ghost btn-sm p-1 md:px-2 shrink-0 self-center">
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            <span className="ml-1 text-xs hidden md:inline">{isExpanded ? 'Hide' : 'Breakdown'}</span>
                          </button>
                        </div>
                        
                        {isExpanded && (
                          <div className="leave-breakdown-grid mt-3 rounded-b-md">
                            <div className="text-muted">Total Allocated:</div>
                            <div style={{ textAlign: 'right', fontWeight: 'bold' }}>{bal.totalCredits}</div>
                            
                            <div className="text-muted">Carry Over:</div>
                            <div style={{ textAlign: 'right', fontWeight: 'bold' }}>{bal.carryOver}</div>
                            
                            <div className="text-muted">Used Leaves:</div>
                            <div className="text-danger" style={{ textAlign: 'right', fontWeight: 'bold' }}>{bal.used}</div>
                            
                            <div className="text-muted">Pending Requests:</div>
                            <div className="text-warning" style={{ textAlign: 'right', fontWeight: 'bold' }}>{bal.pending}</div>
                            
                            <div style={{ gridColumn: 'span 2', borderTop: '1px solid var(--border)', margin: '4px 0' }}></div>
                            
                            <div className="text-muted font-bold">Projected:</div>
                            <div className="text-success" style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '15px' }}>{bal.available}</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {employee.balances?.filter((bal: any) => showAllLeaveTypes || bal.totalCredits > 0 || bal.carryOver > 0 || bal.available > 0 || bal.used > 0 || bal.pending > 0).length === 0 && (
                    <div className="text-center p-8 text-muted">No active leave balances found. Try toggling "Show all leave types".</div>
                  )}
                </div>
              )}

              {activeTab === 'ledger' && (
                <div className="data-table-wrapper">
                  {loading ? (
                    <div className="p-8 text-center"><div className="spinner"></div></div>
                  ) : (
                    <table className="data-table text-sm">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Type</th>
                          <th>Action</th>
                          <th>Days</th>
                          <th>Bal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledger.map((l: any) => (
                          <tr key={l.id}>
                            <td className="whitespace-nowrap">{new Date(l.transactionDate).toLocaleDateString()}</td>
                            <td className="font-bold">{l.leaveTypeCode}</td>
                            <td>
                              <div>{l.transactionType}</div>
                              <div className="text-xs text-muted truncate max-w-[120px]" title={l.remarks}>{l.remarks}</div>
                            </td>
                            <td className={l.days > 0 ? 'text-success' : l.days < 0 ? 'text-danger' : ''}>
                              {l.days > 0 ? `+${l.days}` : l.days}
                            </td>
                            <td className="font-bold">{l.balanceAfterTransaction}</td>
                          </tr>
                        ))}
                        {ledger.length === 0 && (
                          <tr>
                            <td colSpan={5} className="text-center p-4 text-muted">No transactions.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Footer */}
          <div className="border-t border-border flex justify-end pt-4 mt-6 shrink-0">
            <button className="btn btn-outline min-h-[44px] px-6" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
};
