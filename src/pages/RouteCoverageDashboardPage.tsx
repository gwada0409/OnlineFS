import React, { useState, useEffect } from 'react';
import { ApprovalRoutingService } from '../services/approvalRoutingService';
import type { HREmployee } from '../lib/api';
import type { CoverageDashboardStats, AuditLogEntry, RoutePreviewResult } from '../types/approvalRouting';
import { HRAPI } from '../lib/api';
import { LayoutDashboard, Users, AlertTriangle, ShieldCheck, FileText, CheckCircle, Eye, X } from 'lucide-react';
import { DialogOverlay } from '../components/ui/DialogOverlay';

export const RouteCoverageDashboardPage: React.FC = () => {
  const [stats, setStats] = useState<CoverageDashboardStats | null>(null);
  const [employees, setEmployees] = useState<HREmployee[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPreview, setSelectedPreview] = useState<RoutePreviewResult | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      await ApprovalRoutingService.refresh();
      const emps = await HRAPI.getEmployees();
      setEmployees(emps);
      setStats(ApprovalRoutingService.getCoverageStats(emps));
      setAuditLogs(ApprovalRoutingService.getAuditLogs());
    } catch (e) {
      console.error(e);
    }
  };

  const filteredEmployees = employees.filter(e =>
    e.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.employeeID.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><LayoutDashboard size={22} className="text-primary" /> Route Coverage & Audit Log</h2>
          <p className="text-sm text-muted">System-wide visibility on approval route distribution, configuration health, and audit trail.</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card" style={{ '--accent-color': 'var(--warning)' } as React.CSSProperties}>
          <div className="stat-card-icon" style={{ background: 'var(--warning-light)', color: 'var(--warning)' }}>
            <Users size={22} />
          </div>
          <div className="stat-card-value">{stats?.personalOverrideCount ?? 0}</div>
          <div className="stat-card-label">Personal Overrides</div>
        </div>

        <div className="stat-card" style={{ '--accent-color': 'var(--primary)' } as React.CSSProperties}>
          <div className="stat-card-icon" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
            <ShieldCheck size={22} />
          </div>
          <div className="stat-card-value">{stats?.assignedTemplateCount ?? 0}</div>
          <div className="stat-card-label">Assigned Templates</div>
        </div>

        <div className="stat-card" style={{ '--accent-color': 'var(--success)' } as React.CSSProperties}>
          <div className="stat-card-icon" style={{ background: 'var(--success-light)', color: 'var(--success)' }}>
            <CheckCircle size={22} />
          </div>
          <div className="stat-card-value">{stats?.automaticRuleCount ?? 0}</div>
          <div className="stat-card-label">Automatic Rule Matches</div>
        </div>

        <div className="stat-card" style={{ '--accent-color': 'var(--danger)' } as React.CSSProperties}>
          <div className="stat-card-icon" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>
            <AlertTriangle size={22} />
          </div>
          <div className="stat-card-value">{stats?.misconfiguredCount ?? 0}</div>
          <div className="stat-card-label">Misconfigured / Warnings</div>
        </div>
      </div>

      {/* Coverage Table */}
      <div className="glass-card">
        <div className="glass-card-header border-b border-border p-4 flex items-center justify-between">
          <h3 className="font-bold flex items-center gap-2"><Users size={18} className="text-primary" /> Employee Coverage Matrix</h3>
          <input 
            type="text" 
            placeholder="Search employee..." 
            className="form-input max-w-xs"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="glass-card-body p-0">
          <div className="data-table-wrapper max-h-[400px] overflow-y-auto">
            <table className="data-table">
              <thead className="sticky top-0 bg-base z-10">
                <tr>
                  <th>Employee</th>
                  <th>Department & Role</th>
                  <th>Resolved Route Source</th>
                  <th>Rule / Template Used</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map(emp => {
                  const res = ApprovalRoutingService.resolveRoute(emp, employees);
                  return (
                    <tr key={emp.id}>
                      <td>
                        <div className="font-bold">{emp.fullName}</div>
                        <div className="text-xs text-muted">{emp.employeeID}</div>
                      </td>
                      <td>
                        <div>{emp.department}</div>
                        <div className="text-xs text-muted">{emp.orgRole}</div>
                      </td>
                      <td>
                        <span className={`badge ${
                          res.routeSource === 'PersonalOverride' ? 'badge-warning' :
                          res.routeSource === 'AssignedTemplate' ? 'badge-info' :
                          res.routeSource === 'AutomaticRule' ? 'badge-success' : 'badge-draft'
                        }`}>
                          {res.routeSource}
                        </span>
                      </td>
                      <td className="text-sm">
                        {res.templateName || res.matchedRuleName || 'Default Hierarchy'}
                      </td>
                      <td className="text-right">
                        <button className="btn btn-ghost text-primary p-2" onClick={() => setSelectedPreview(res)} title="View Resolved Route">
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Audit History Log */}
      <div className="glass-card">
        <div className="glass-card-header border-b border-border p-4">
          <h3 className="font-bold flex items-center gap-2"><FileText size={18} className="text-info" /> Audit History Log</h3>
        </div>
        <div className="glass-card-body p-0">
          <div className="data-table-wrapper max-h-[300px] overflow-y-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map(log => (
                  <tr key={log.id}>
                    <td className="text-xs text-muted">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="font-bold">{log.actorName}</td>
                    <td><span className="badge badge-outline">{log.action}</span></td>
                    <td className="text-xs font-mono">{log.entityType} #{log.entityId}</td>
                    <td className="text-sm">{log.details}</td>
                  </tr>
                ))}
                {auditLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center p-6 text-muted">No audit events logged yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Route Preview Modal */}
      {selectedPreview && (
        <DialogOverlay onClose={() => setSelectedPreview(null)} label={`Resolved route for ${selectedPreview.employeeName}`} closeOnBackdrop>
          <div className="modal-content animate-slide-up">
            <div className="modal-header">
              <h2>Resolved Route for {selectedPreview.employeeName}</h2>
              <button className="modal-close" onClick={() => setSelectedPreview(null)}><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div className="text-sm">
                <span>Route Source: </span>
                <span className="font-bold text-primary">{selectedPreview.routeSource}</span>
                {selectedPreview.templateName && <span> ({selectedPreview.templateName})</span>}
              </div>

              <div className="route-pipeline py-2">
                {selectedPreview.steps.map(step => (
                  <div key={step.sequenceNumber} className="route-step">
                    <div className="route-number">{step.sequenceNumber}</div>
                    <div className="route-card">
                      <div>
                        <div className="route-card-title">{step.displayLabel}</div>
                        <div className="route-card-subtitle">{step.resolvedApproverName} ({step.resolvedApproverRole})</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end mt-6">
              <button className="btn btn-outline" onClick={() => setSelectedPreview(null)}>Close</button>
            </div>
          </div>
        </DialogOverlay>
      )}
    </div>
  );
};
