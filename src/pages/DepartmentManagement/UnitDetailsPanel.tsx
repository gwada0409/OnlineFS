import React, { useState, useEffect } from 'react';
import type { DepartmentNode, ApprovalCategoryNode, RouteValidationPreview, HREmployee } from '../../lib/api';
import { DepartmentAPI } from '../../lib/api';
import {
  Building2,
  Users,
  UserCheck,
  ShieldCheck,
  Edit3,
  Trash2,
  ArrowRightLeft,
  UserPlus,
  Layers,
  AlertCircle,
  Info,
  UserX
} from 'lucide-react';

interface UnitDetailsPanelProps {
  unit: DepartmentNode;
  employees: HREmployee[];
  category: ApprovalCategoryNode | null;
  onEditUnit: (unit: DepartmentNode, focusBackups?: boolean) => void;
  onDeleteUnit: (unit: DepartmentNode) => void;
  onManageEmployees: (unit: DepartmentNode) => void;
  onMoveCategory: (unit: DepartmentNode) => void;
  onChangeFirstApprover: (unit: DepartmentNode) => void;
  onUnassignEmployee: (unitId: number, employeeId: number) => Promise<void>;
}

export const UnitDetailsPanel: React.FC<UnitDetailsPanelProps> = ({
  unit,
  employees,
  category,
  onEditUnit,
  onDeleteUnit,
  onManageEmployees,
  onMoveCategory,
  onChangeFirstApprover,
  onUnassignEmployee
}) => {
  const [activeTab, setActiveTab] = useState<'members' | 'route'>('members');
  const [routePreview, setRoutePreview] = useState<RouteValidationPreview | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [previewLineLeaderId, setPreviewLineLeaderId] = useState(0);
  const [previewLeaveCode, setPreviewLeaveCode] = useState('');
  const [selectedPreviewEmployeeId, setSelectedPreviewEmployeeId] = useState<number | null>(null);
  const [unassigningEmployeeId, setUnassigningEmployeeId] = useState<number | null>(null);

  const handleUnassign = async (employeeId: number) => {
    if (unassigningEmployeeId !== null) return;
    try {
      setUnassigningEmployeeId(employeeId);
      await onUnassignEmployee(unit.id, employeeId);
    } finally {
      setUnassigningEmployeeId(null);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  useEffect(() => {
    if (activeTab === 'route') {
      const empId = selectedPreviewEmployeeId || (unit.employees && unit.employees.length > 0 ? unit.employees[0].id : null);
      if (empId) {
        loadRoutePreview(empId);
      }
    }
  }, [activeTab, unit, selectedPreviewEmployeeId, previewLeaveCode, previewLineLeaderId]);

  const loadRoutePreview = async (empId: number) => {
    try {
      setLoadingRoute(true);
      const res = await DepartmentAPI.previewRoute(empId, previewLeaveCode || undefined, previewLineLeaderId || undefined);
      setRoutePreview(res);
    } catch (err) {
      console.error('Failed to preview route:', err);
      setRoutePreview(null);
    } finally {
      setLoadingRoute(false);
    }
  };

  return (
    <div className="department-details-panel flex flex-col h-full min-h-0 bg-surface rounded-2xl border border-border overflow-y-auto overflow-x-hidden">
      {/* Header Info */}
      <div className="shrink-0 p-6 border-b border-border bg-base/30 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 shadow-sm">
              <Building2 size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-text-primary leading-tight">
                  {unit.name}
                </h2>
                <span className={`badge ${unit.isActive ? 'badge-success' : 'badge-neutral'} text-[11px]`}>
                  {unit.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="badge badge-primary text-[10px] px-2 py-0.5 flex items-center gap-1">
                  <Layers size={10} /> Category: {unit.categoryName || category?.name || 'Uncategorized'}
                </span>
                <span className="text-xs text-muted">
                  {unit.employeeCount} Member{unit.employeeCount !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              className="btn btn-outline btn-sm text-xs flex items-center gap-1.5"
              onClick={() => onMoveCategory(unit)}
            >
              <ArrowRightLeft size={13} /> Move Category
            </button>
            <button
              className="btn btn-outline btn-sm text-xs flex items-center gap-1.5"
              onClick={() => onEditUnit(unit)}
            >
              <Edit3 size={13} /> Edit
            </button>
            <button
              className="btn btn-primary btn-sm text-xs flex items-center gap-1.5"
              onClick={() => onManageEmployees(unit)}
            >
              <UserPlus size={13} /> Manage People
            </button>
            <button
              className="btn btn-ghost btn-sm text-xs text-danger hover:bg-danger/10 p-2"
              onClick={() => onDeleteUnit(unit)}
              title="Delete Department"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        {unit.description && (
          <p className="text-xs text-text-secondary leading-relaxed max-w-2xl">
            {unit.description}
          </p>
        )}

        {/* Dual Approver Cards Grid */}
        <div className="p-3 rounded-xl border border-border text-xs space-y-1">
          <p><strong>Operator regular leave:</strong> {unit.requiresOperatorLineLeader ? 'Operator chooses from department line leaders when filing.' : 'Existing route preserved'}.</p>
          <p><strong>SL designated line leader (operators only):</strong> {unit.sickLeaveLineLeaderId ? 'Assigned — use Edit to view or change' : 'Not configured — Operator SL submissions blocked'}.</p>
          <p><strong>Legacy Noted by:</strong> {unit.notedByApproverIds?.length ? `${unit.notedByApproverIds.length} assigned member(s); any one can decide` : 'Optional stage not configured'}.</p>
          <p><strong>Recommending:</strong> {unit.firstApproverIds?.length ?? (unit.firstApproverId ? 1 : 0)} assigned member(s); any one can decide.</p>
          <p className="text-muted">Sick Leave starts with HR Review, followed by the department SL line leader for operators only, then Recommending and Approver. Other employees skip the line leader stage. Use Edit to configure stage members.</p>
        </div>
        <section className="p-4 rounded-xl border border-border space-y-3" aria-label="Department backup approvers">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-bold text-sm">Backups during approver leave</h3>
            <button className="btn btn-outline btn-sm" onClick={() => onEditUnit(unit, true)}>Configure backups</button>
          </div>
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            {([['notedBy', 'Noted by / Line leader'], ['recommending', 'Recommending'], ['approver', 'Approver / 2nd approver']] as const).map(([key, label]) => {
              const backup = employees.find(employee => employee.id === unit.backupApprovers?.[key]);
              return <div key={key} className="min-w-0"><dt className="text-xs text-muted">{label}</dt><dd className="font-semibold break-words">{backup?.fullName || 'Not configured'}</dd></div>;
            })}
          </dl>
          <p className="text-xs text-muted">Activated by dated absences in Delegation Management. The backup must review and approve; the original approver remains recorded.</p>
        </section>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Recommending (Optional) */}
          <div className="p-4 rounded-xl border border-border bg-surface flex flex-col justify-between space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-info/10 text-info flex items-center justify-center font-bold text-xs shrink-0">
                  <UserCheck size={16} />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-info">
                    Recommending (Optional)
                  </span>
                  <p className="text-xs text-muted mt-0.5">Department immediate supervisor</p>
                </div>
              </div>
              <button
                className="btn btn-ghost btn-xs text-primary font-medium"
                onClick={() => onChangeFirstApprover(unit)}
              >
                {unit.firstApproverId ? 'Change' : 'Configure'}
              </button>
            </div>

            {unit.firstApproverName ? (
              <div className="p-3 rounded-lg bg-base/60 border border-border/80 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-info text-white flex items-center justify-center font-bold text-xs shrink-0">
                  {getInitials(unit.firstApproverName)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-text-primary truncate">{unit.firstApproverName}</p>
                  <p className="text-[11px] text-text-secondary truncate">{unit.firstApproverPosition || 'Immediate Supervisor'}</p>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-base/30 border border-dashed border-border text-center">
                <p className="text-xs text-muted italic">None configured (Optional)</p>
                <p className="text-[11px] text-muted/80 mt-0.5">Leave requests route directly to the Category Approver</p>
              </div>
            )}
          </div>

          {/* Card 2: effective Approver */}
          <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex flex-col justify-between space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                  <ShieldCheck size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                      Approver
                    </span>
                    <span className="badge badge-primary text-[9px] px-1.5 py-0.2">
                      {unit.hasSecondApproverOverride ? 'Department Override' : 'Inherited'}
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    {unit.hasSecondApproverOverride ? 'Applies only to this department' : `From ${unit.categoryName || category?.name || 'Category'}`}
                  </p>
                </div>
              </div>
            </div>

            {(unit.secondApproverName || category?.secondApproverName) ? (
              <div className="p-3 rounded-lg bg-surface border border-primary/20 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                  {getInitials(unit.secondApproverName || category?.secondApproverName || '')}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-text-primary truncate">
                    {unit.secondApproverName || category?.secondApproverName}
                  </p>
                  <p className="text-[11px] text-text-secondary truncate">
                    {unit.secondApproverPosition || category?.secondApproverPosition || 'Category Approver'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 text-center">
                <p className="text-xs text-warning font-medium flex items-center justify-center gap-1">
                  <AlertCircle size={13} /> No Approver set at Category level
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <button
            className={`btn btn-sm px-4 text-xs font-semibold ${
              activeTab === 'members' ? 'btn-primary' : 'btn-ghost text-muted hover:text-text-primary'
            }`}
            onClick={() => setActiveTab('members')}
          >
            <Users size={14} className="mr-1.5 inline" /> Members ({unit.employeeCount})
          </button>
          <button
            className={`btn btn-sm px-4 text-xs font-semibold ${
              activeTab === 'route' ? 'btn-primary' : 'btn-ghost text-muted hover:text-text-primary'
            }`}
            onClick={() => setActiveTab('route')}
          >
            <ShieldCheck size={14} className="mr-1.5 inline" /> Route Preview
          </button>
        </div>
      </div>

      {/* Body Area */}
      <div className="shrink-0 p-4 sm:p-6">
        {/* MEMBERS TAB */}
        {activeTab === 'members' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted">
                Employees assigned to <strong className="text-text-primary">{unit.name}</strong>
              </p>
              <button
                className="btn btn-outline btn-xs text-xs flex items-center gap-1"
                onClick={() => onManageEmployees(unit)}
              >
                <UserPlus size={12} /> Assign / Reassign Members
              </button>
            </div>

            {(!unit.employees || unit.employees.length === 0) ? (
              <div className="p-10 rounded-xl border border-dashed border-border text-center space-y-3">
                <Users size={32} className="mx-auto text-muted/50" />
                <p className="text-sm font-semibold text-text-primary">No employees assigned yet</p>
                <p className="text-xs text-muted max-w-sm mx-auto">
                  Assign staff members to this department so their leave filings follow this approval chain.
                </p>
                <button
                  className="btn btn-primary btn-sm text-xs mt-2"
                  onClick={() => onManageEmployees(unit)}
                >
                  <UserPlus size={14} /> Assign Employees
                </button>
              </div>
            ) : (
              <div className="data-table-wrapper rounded-xl border border-border">
                <table className="data-table department-members-table mobile-record-table w-full text-left" role="table">
                  <thead>
                    <tr className="bg-base/60 text-muted text-[11px] uppercase tracking-wider">
                      <th scope="col">Employee</th>
                      <th scope="col">Employee ID</th>
                      <th scope="col">Position</th>
                      <th scope="col">Department</th>
                      <th scope="col">Role</th>
                      <th scope="col" className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 text-xs">
                    {unit.employees.map(emp => (
                      <tr key={emp.id} className="hover:bg-base/40 transition-colors">
                        <td data-label="Employee">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[11px] shrink-0">
                              {getInitials(emp.fullName)}
                            </div>
                            <span className="font-semibold text-text-primary min-w-0 break-words">{emp.fullName}</span>
                          </div>
                        </td>
                        <td data-label="Employee ID" className="text-muted font-mono">{emp.employeeID}</td>
                        <td data-label="Position" className="text-text-secondary">{emp.position || '-'}</td>
                        <td data-label="Department" className="text-text-secondary">{emp.department || 'Unassigned'}</td>
                        <td data-label="Role">
                          <span className="badge badge-neutral text-[10px] px-2 py-0.5">
                            {emp.orgRole || 'Member'}
                          </span>
                        </td>
                        <td data-label="Action" className="text-right">
                          <button
                            className="btn btn-ghost btn-xs text-danger hover:bg-danger/10 text-[11px] px-2 py-1"
                            onClick={() => void handleUnassign(emp.id)}
                            disabled={unassigningEmployeeId !== null}
                            title="Remove from department"
                            aria-label={`Unassign ${emp.fullName}`}
                          >
                            <UserX size={12} className="shrink-0" /> {unassigningEmployeeId === emp.id ? 'Removing...' : 'Unassign'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ROUTE PREVIEW TAB */}
        {activeTab === 'route' && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-info/5 border border-info/20 flex items-start gap-3">
              <Info size={18} className="text-info shrink-0 mt-0.5" />
              <div className="text-xs text-text-secondary leading-relaxed">
                <strong className="text-text-primary block font-semibold mb-0.5">
                  Dynamic Approval Chain Resolution
                </strong>
                When an employee in <strong className="text-text-primary">{unit.name}</strong> files a leave request, the system automatically resolves the chain from their Department up to the Approval Category.
              </div>
            </div>

            {/* Employee Selector for Route Simulation */}
            {unit.employees && unit.employees.length > 0 && (
              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold text-text-primary shrink-0">
                  Simulate Applicant:
                </label>
                <select
                  className="form-select text-xs py-1.5 px-3 rounded-lg flex-1 max-w-md"
                  value={selectedPreviewEmployeeId || (unit.employees[0]?.id ?? '')}
                  onChange={e => setSelectedPreviewEmployeeId(Number(e.target.value))}
                >
                  {unit.employees.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.fullName} ({e.position || 'Staff'}) {unit.firstApproverId === e.id ? '★ (Recommending)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <label className="form-label" htmlFor="route-leave-type">Preview leave routing</label>
            <select id="route-leave-type" className="form-select" value={previewLeaveCode} onChange={event => setPreviewLeaveCode(event.target.value)}>
              <option value="">Other leave types</option>
              <option value="SL">Sick Leave (SL) — HR first</option>
            </select>
            {previewLeaveCode !== 'SL' && unit.requiresOperatorLineLeader && <><label className="form-label" htmlFor="preview-line-leader">Selected department line leader</label><select id="preview-line-leader" className="form-select" value={previewLineLeaderId || ''} onChange={event => setPreviewLineLeaderId(Number(event.target.value))}><option value="">Choose a line leader to preview</option>{unit.notedByApproverIds?.map(id => <option key={id} value={id}>{employees.find(employee => employee.id === id)?.fullName || 'Unassigned employee'}</option>)}</select></>}
            {loadingRoute ? (
              <div className="p-12 text-center text-muted text-xs">Calculating approval chain…</div>
            ) : routePreview ? (
              <div className="space-y-4">
                {!routePreview.isValid && <div role="alert" className="alert alert-danger">{routePreview.errorMessage}</div>}
                <h4 className="text-xs font-bold">Resolved route: {new Set(routePreview.steps.map(step => step.stageOrder ?? step.stepOrder)).size} stages</h4>
                {Array.from(new Set(routePreview.steps.map(step => step.stageOrder ?? step.stepOrder))).map(stage => {
                  const members = routePreview.steps.filter(step => (step.stageOrder ?? step.stepOrder) === stage);
                  return <div key={stage} className="p-4 rounded-xl border border-border bg-base/30 space-y-2">
                    <strong>{stage + 1}. {members[0].stepLabel}</strong>
                    <p className="text-xs text-muted">Any one assigned member can decide. All assigned members receive the request when this stage becomes active.</p>
                    {members[0]?.stageKind === 'HR_REVIEW' ? <p className="text-xs">HR · Any eligible HR user can approve</p> : members.map(member => <p key={member.approverId} className="text-xs">{member.approverName} · {member.approverPosition}</p>)}
                  </div>;
                })}
              </div>
            ) : (
              <div className="p-10 text-center text-muted text-xs">
                Select an employee from this department to preview their exact approval chain.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
