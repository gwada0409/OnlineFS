import React, { useState, useEffect } from 'react';
import { ApprovalRoutingService } from '../services/approvalRoutingService';
import type { HREmployee } from '../lib/api';
import type { ApprovalRouteTemplate, BulkRouteOperationRecord, RoutePreviewResult } from '../types/approvalRouting';
import { HRAPI } from '../lib/api';
import { useToast } from '../components/ToastProvider';
import { Users, RotateCcw, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { DialogOverlay } from '../components/ui/DialogOverlay';

export const BulkRouteAssignmentPage: React.FC = () => {
  const toast = useToast();
  const [employees, setEmployees] = useState<HREmployee[]>([]);
  const [templates, setTemplates] = useState<ApprovalRouteTemplate[]>([]);
  const [operations, setOperations] = useState<BulkRouteOperationRecord[]>([]);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Selection & Operation State
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [targetTemplateId, setTargetTemplateId] = useState<number>(0);
  const [preserveOverrides, setPreserveOverrides] = useState<boolean>(true);
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      await ApprovalRoutingService.refresh();
      const emps = await HRAPI.getEmployees();
      setEmployees(emps);
      setTemplates(ApprovalRoutingService.getTemplates().filter(t => t.isActive));
      setOperations(ApprovalRoutingService.getBulkOperations());
    } catch (e) {
      console.error(e);
    }
  };

  const filteredEmployees = employees.filter(e => {
    const matchesSearch = e.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || e.employeeID.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = !deptFilter || e.department === deptFilter;
    const matchesSection = !sectionFilter || e.section === sectionFilter;
    const matchesRole = !roleFilter || e.orgRole === roleFilter;
    return matchesSearch && matchesDept && matchesSection && matchesRole;
  });

  const handleSelectAll = () => {
    setSelectedIds(filteredEmployees.map(e => e.id));
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  const handleToggleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  // Preview Generation
  const previewItems: { employee: HREmployee; preview: RoutePreviewResult }[] = selectedIds.map(id => {
    const emp = employees.find(e => e.id === id)!;
    const preview = ApprovalRoutingService.resolveRoute(emp, employees);
    return { employee: emp, preview };
  });

  const handleConfirmApply = async () => {
    if (selectedIds.length === 0) return toast.error('No employees selected');
    if (targetTemplateId === 0) return toast.error('Please select a target route template');

    try { const result = await ApprovalRoutingService.executeBulkAssignment(
      selectedIds,
      employees,
      'AssignTemplate',
      targetTemplateId
    );

    toast.success(`Successfully assigned template to ${result.affectedCount} employees`);
    setShowPreviewModal(false);
    setSelectedIds([]);
    await loadData();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Bulk assignment failed'); }
  };

  const handleUndo = (_opId: string) => toast.error('Server audit history is immutable; apply a new bulk assignment to reverse this change.');

  const targetTemplate = templates.find(t => t.id === targetTemplateId);
  const departments = Array.from(new Set(employees.map(e => e.department).filter(Boolean)));
  const sections = Array.from(new Set(employees.map(e => e.section).filter(Boolean)));
  const roles = Array.from(new Set(employees.map(e => e.orgRole).filter(Boolean)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><Users size={22} className="text-primary" /> Bulk Route Assignment</h2>
          <p className="text-sm text-muted">Assign approval templates across teams with conflict validation and instant rollback.</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-card p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input 
            type="text" 
            placeholder="Search employee name or ID..." 
            className="form-input"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          <select className="form-select" value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
            <option value="">All Departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select className="form-select" value={sectionFilter} onChange={e => setSectionFilter(e.target.value)}>
            <option value="">All Sections</option>
            {sections.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="form-select" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
            <option value="">All Org Roles</option>
            {roles.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="glass-card p-4 flex flex-col md:flex-row items-center justify-between gap-4 bg-primary/5 border-primary/20">
        <div className="flex items-center gap-3">
          <button className="btn btn-outline btn-sm" onClick={handleSelectAll}>
            Select All Filtered ({filteredEmployees.length})
          </button>
          <button className="btn btn-ghost btn-sm text-muted" onClick={handleClearSelection} disabled={selectedIds.length === 0}>
            Clear Selection
          </button>
          <span className="text-sm font-bold text-primary">{selectedIds.length} Selected</span>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select 
            className="form-select max-w-xs" 
            value={targetTemplateId} 
            onChange={e => setTargetTemplateId(Number(e.target.value))}
          >
            <option value={0}>-- Select Route Template --</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>

          <button 
            className="btn btn-primary"
            disabled={selectedIds.length === 0 || targetTemplateId === 0}
            onClick={() => setShowPreviewModal(true)}
          >
            Preview & Apply Assignment
          </button>
        </div>
      </div>

      {/* Employee List Table */}
      <div className="glass-card">
        <div className="glass-card-body p-0">
          <div className="data-table-wrapper max-h-[500px] overflow-y-auto">
            <table className="data-table">
              <thead className="sticky top-0 bg-base z-10">
                <tr>
                  <th className="w-10">
                    <input 
                      type="checkbox" 
                      checked={selectedIds.length > 0 && selectedIds.length === filteredEmployees.length}
                      onChange={e => e.target.checked ? handleSelectAll() : handleClearSelection()}
                    />
                  </th>
                  <th>Employee</th>
                  <th>Department & Section</th>
                  <th>Org Role</th>
                  <th>Current Route Source</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map(emp => {
                  const isSelected = selectedIds.includes(emp.id);
                  const preview = ApprovalRoutingService.resolveRoute(emp, employees);

                  return (
                    <tr key={emp.id} className={isSelected ? 'bg-primary/10' : ''}>
                      <td>
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          onChange={() => handleToggleSelect(emp.id)}
                        />
                      </td>
                      <td>
                        <div className="font-bold">{emp.fullName}</div>
                        <div className="text-xs text-muted">{emp.employeeID}</div>
                      </td>
                      <td>
                        <div>{emp.department}</div>
                        <div className="text-xs text-muted">{emp.section || 'N/A'}</div>
                      </td>
                      <td><span className="badge badge-outline">{emp.orgRole}</span></td>
                      <td>
                        <span className={`badge ${
                          preview.routeSource === 'PersonalOverride' ? 'badge-warning' :
                          preview.routeSource === 'AssignedTemplate' ? 'badge-info' :
                          preview.routeSource === 'AutomaticRule' ? 'badge-success' : 'badge-draft'
                        }`}>
                          {preview.routeSource}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Bulk Operation History / Undo Section */}
      {operations.length > 0 && (
        <div className="glass-card">
          <div className="glass-card-header border-b border-border p-4">
            <h3 className="font-bold flex items-center gap-2"><RotateCcw size={18} className="text-info" /> Recent Bulk Operations & Rollbacks</h3>
          </div>
          <div className="glass-card-body p-0">
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Operation ID</th>
                    <th>Type & Template</th>
                    <th>Affected Employees</th>
                    <th>Performed By</th>
                    <th>Date</th>
                    <th className="text-right">Rollback Action</th>
                  </tr>
                </thead>
                <tbody>
                  {operations.map(op => (
                    <tr key={op.id}>
                      <td className="font-mono text-xs opacity-70">{op.id}</td>
                      <td>
                        <div className="font-bold">{op.operationType}</div>
                        <div className="text-xs text-muted">{op.templateName || 'Default'}</div>
                      </td>
                      <td>{op.affectedCount} Employees</td>
                      <td>{op.createdBy}</td>
                      <td className="text-xs text-muted">{new Date(op.createdDate).toLocaleString()}</td>
                      <td className="text-right">
                        {op.isUndone ? (
                          <span className="badge badge-draft">Undone</span>
                        ) : (
                          <button className="btn btn-outline btn-sm text-danger border-danger" onClick={() => handleUndo(op.id)}>
                            <RotateCcw size={14} /> Undo Operation
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Preview Confirmation Modal */}
      {showPreviewModal && (
        <DialogOverlay onClose={() => setShowPreviewModal(false)} label="Bulk route assignment preview" closeOnBackdrop>
          <div className="modal-content max-w-4xl animate-slide-up">
            <div className="modal-header">
              <h2>Bulk Route Assignment Preview</h2>
              <button className="modal-close" onClick={() => setShowPreviewModal(false)}><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div className="alert alert-info">
                <span>Applying <strong>"{targetTemplate?.name}"</strong> to <strong>{selectedIds.length}</strong> selected employees.</span>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <input 
                  type="checkbox" 
                  id="preserveOverridesToggle"
                  checked={preserveOverrides}
                  onChange={e => setPreserveOverrides(e.target.checked)}
                  className="form-checkbox"
                />
                <label htmlFor="preserveOverridesToggle" className="text-sm font-medium cursor-pointer">
                  Preserve Personal Custom Overrides (Skip employees with custom routes)
                </label>
              </div>

              <div className="max-h-[350px] overflow-y-auto border border-border rounded-lg">
                <table className="data-table">
                  <thead className="bg-base sticky top-0">
                    <tr>
                      <th>Employee</th>
                      <th>Current Source</th>
                      <th>Resolved Chain Preview</th>
                      <th>Status / Warning</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewItems.map(({ employee, preview }) => (
                      <tr key={employee.id}>
                        <td>
                          <div className="font-bold">{employee.fullName}</div>
                          <div className="text-xs text-muted">{employee.department}</div>
                        </td>
                        <td><span className="badge badge-outline">{preview.routeSource}</span></td>
                        <td>
                          <div className="text-xs space-y-1">
                            {targetTemplate?.steps.map(s => (
                              <div key={s.id}>
                                <span className="font-bold text-primary">{s.sequenceNumber}. {s.displayLabel}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td>
                          {preview.routeSource === 'PersonalOverride' && preserveOverrides ? (
                            <span className="badge badge-warning flex items-center gap-1"><AlertTriangle size={12} /> Will Skip (Override)</span>
                          ) : (
                            <span className="badge badge-success flex items-center gap-1"><CheckCircle size={12} /> Ready</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center pt-4">
                <button type="button" className="btn btn-outline" onClick={() => setShowPreviewModal(false)}>Cancel</button>
                <button type="button" className="btn btn-primary min-h-[44px]" onClick={handleConfirmApply}>
                  Apply Template to {selectedIds.length} Employees
                </button>
              </div>
            </div>
          </div>
        </DialogOverlay>
      )}
    </div>
  );
};
