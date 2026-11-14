import React, { useState, useEffect } from 'react';
import { ApprovalRoutingService } from '../services/approvalRoutingService';
import type { ApprovalRouteTemplate, ApprovalStepType, ApprovalRouteTemplateStep } from '../types/approvalRouting';
import { HRAPI, type HREmployee } from '../lib/api';
import { useToast } from '../components/ToastProvider';
import { GitMerge, Plus, Edit2, Copy, Eye, Trash2, ArrowUp, ArrowDown, X, Search, RotateCcw, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { DialogOverlay } from '../components/ui/DialogOverlay';

const DYNAMIC_ROLE_LABELS: Record<string, string> = {
  ImmediateSupervisor: 'Immediate Supervisor (Dynamic)',
  DepartmentManager: 'Department Manager (Dynamic)',
  SectionManager: 'Section Manager (Dynamic)',
  HRStaff: 'HR Staff (HR Department)',
  HRManager: 'HR Manager (HR Department)',
  GeneralManager: 'General Manager (Executive)'
};

export const ApprovalRouteTemplatesPage: React.FC = () => {
  const toast = useToast();
  const [templates, setTemplates] = useState<ApprovalRouteTemplate[]>([]);
  const [employees, setEmployees] = useState<HREmployee[]>([]);
  
  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [deptFilter, setDeptFilter] = useState('All');
  const [roleFilter, setRoleFilter] = useState('All');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Modal / Editing state
  const [editingTemplate, setEditingTemplate] = useState<ApprovalRouteTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<ApprovalRouteTemplate | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [formDeptCondition, setFormDeptCondition] = useState('');
  const [formRoleCondition, setFormRoleCondition] = useState('');
  const [formSteps, setFormSteps] = useState<ApprovalRouteTemplateStep[]>([]);
  const [duplicateWarning, setDuplicateWarning] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      await ApprovalRoutingService.refresh();
      setTemplates(ApprovalRoutingService.getTemplates());
      const empData = await HRAPI.getEmployees();
      setEmployees(empData || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load routing data');
    }
  };

  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setIsCreating(true);
    setFormName('');
    setFormDesc('');
    setFormActive(true);
    setFormDeptCondition('');
    setFormRoleCondition('');
    setDuplicateWarning('');
    setFormSteps([]);
  };

  const handleOpenEdit = (t: ApprovalRouteTemplate) => {
    setEditingTemplate(t);
    setIsCreating(false);
    setFormName(t.name);
    setFormDesc(t.description);
    setFormActive(t.isActive);
    setFormDeptCondition(t.steps?.[0]?.departmentConstraint || '');
    setFormRoleCondition('');
    setDuplicateWarning('');
    setFormSteps(t.steps ? t.steps.map(s => ({ ...s })) : []);
  };

  const handleClone = async (t: ApprovalRouteTemplate) => {
    try {
      await ApprovalRoutingService.cloneTemplate(t.id);
      toast.success(`Cloned "${t.name}" successfully`);
      await loadData();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to clone template'); }
  };

  const handleToggleActive = async (t: ApprovalRouteTemplate) => {
    try { await ApprovalRoutingService.toggleTemplateStatus(t.id); toast.success(`Template ${t.isActive ? 'deactivated' : 'activated'}`); await loadData(); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to update template'); }
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('All');
    setDeptFilter('All');
    setRoleFilter('All');
    setCurrentPage(1);
  };

  const handleAddStep = () => {
    const nextSeq = formSteps.length + 1;
    const availableEmp = employees.find(e => !formSteps.some(s => s.specificEmployeeId === e.id)) || employees[0];
    const newStep: ApprovalRouteTemplateStep = {
      id: Date.now(),
      sequenceNumber: nextSeq,
      stepType: 'SpecificEmployee',
      specificEmployeeId: availableEmp?.id,
      specificEmployeeName: availableEmp?.fullName,
      displayLabel: availableEmp?.fullName || `Step ${nextSeq}`,
      orgRole: `${availableEmp?.position} (${availableEmp?.department})`,
      isRequired: true,
      allowApprove: true,
      allowReject: true
    };
    const updated = [...formSteps, newStep];
    setFormSteps(updated);
    checkDuplicateApprovers(updated);
  };

  const handleRemoveStep = (index: number) => {
    if (formSteps.length <= 1) return;
    const updated = formSteps.filter((_, i) => i !== index).map((s, i) => ({ ...s, sequenceNumber: i + 1 }));
    setFormSteps(updated);
    checkDuplicateApprovers(updated);
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === formSteps.length - 1) return;
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const updated = [...formSteps];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    const resequenced = updated.map((s, i) => ({ ...s, sequenceNumber: i + 1 }));
    setFormSteps(resequenced);
    checkDuplicateApprovers(resequenced);
  };

  const handleApproverSelectChange = (index: number, value: string) => {
    const updated = [...formSteps];
    if (value.startsWith('emp_')) {
      const empId = Number(value.replace('emp_', ''));
      const emp = employees.find(e => e.id === empId);
      if (emp) {
        updated[index] = {
          ...updated[index],
          stepType: 'SpecificEmployee',
          specificEmployeeId: emp.id,
          specificEmployeeName: emp.fullName,
          displayLabel: emp.fullName,
          orgRole: `${emp.position} (${emp.department})`
        };
      }
    } else {
      updated[index] = {
        ...updated[index],
        stepType: value as ApprovalStepType,
        specificEmployeeId: undefined,
        specificEmployeeName: undefined,
        displayLabel: DYNAMIC_ROLE_LABELS[value] || value,
        orgRole: DYNAMIC_ROLE_LABELS[value] || value
      };
    }
    setFormSteps(updated);
    checkDuplicateApprovers(updated);
  };

  const checkDuplicateApprovers = (steps: ApprovalRouteTemplateStep[]) => {
    const empIds = steps.filter(s => s.specificEmployeeId).map(s => s.specificEmployeeId);
    const hasDuplicates = empIds.some((id, idx) => empIds.indexOf(id) !== idx);
    if (hasDuplicates) {
      setDuplicateWarning('Warning: Duplicate approvers detected in this approval route. Each employee should appear only once.');
    } else {
      setDuplicateWarning('');
    }
  };

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return toast.error('Template name is required');
    if (formSteps.length === 0) return toast.error('At least one approval step is required');
    if (duplicateWarning) return toast.error('Please resolve duplicate approvers before saving');

    try { await ApprovalRoutingService.saveTemplate({
      id: editingTemplate?.id,
      name: formName,
      description: formDesc,
      isActive: formActive,
      steps: formSteps.map(s => ({ ...s, departmentConstraint: formDeptCondition || undefined }))
    });

    toast.success(editingTemplate ? 'Template updated successfully' : 'Template created successfully');
    setIsCreating(false);
    setEditingTemplate(null);
    await loadData();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to save template'); }
  };

  // Filter logic
  const filteredTemplates = templates.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || (statusFilter === 'Active' && t.isActive) || (statusFilter === 'Inactive' && !t.isActive);
    const matchesDept = deptFilter === 'All' || t.steps.some(s => s.orgRole?.includes(deptFilter) || s.departmentConstraint === deptFilter);
    const matchesRole = roleFilter === 'All' || t.steps.some(s => s.orgRole?.toLowerCase().includes(roleFilter.toLowerCase()));
    return matchesSearch && matchesStatus && matchesDept && matchesRole;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredTemplates.length / itemsPerPage) || 1;
  const paginatedTemplates = filteredTemplates.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-6">
      {/* Route Templates Card */}
      <div className="glass-card w-full">
        {/* Section Header */}
        <div className="flex flex-col gap-4 px-5 py-5 border-b border-border lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 mt-0.5">
              <GitMerge size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-text-primary leading-tight">Route Templates</h2>
              <p className="text-xs text-text-secondary mt-1">Create and manage reusable approval routes by assigning actual employees as approvers.</p>
            </div>
          </div>
          <button className="btn btn-primary h-10 px-5 flex items-center justify-center gap-2 shrink-0 w-full lg:w-auto text-sm font-semibold" onClick={handleOpenCreate}>
            <Plus size={16} /> Create Template
          </button>
        </div>

        {/* Filters & Search Row */}
        <div className="px-5 py-4 border-b border-border">
          <div className="grid w-full gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-[minmax(220px,1.1fr)_minmax(170px,1fr)_minmax(190px,1fr)_minmax(170px,0.9fr)_auto]">
            {/* Search */}
            <div className="relative min-w-0">
              <input 
                type="text" 
                placeholder="Search templates..." 
                className="form-input text-xs pr-10 pl-4 h-10 w-full min-w-0"
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              />
              <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            </div>

            {/* Status Filter */}
            <div className="min-w-0">
              <select 
                className="form-select text-xs h-10 w-full min-w-0"
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value as any); setCurrentPage(1); }}
              >
                <option value="All">All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            {/* Department Filter */}
            <div className="min-w-0">
              <select 
                className="form-select text-xs h-10 w-full min-w-0"
                value={deptFilter}
                onChange={e => { setDeptFilter(e.target.value); setCurrentPage(1); }}
              >
                <option value="All">All Departments</option>
                <option value="Production Dept.">Production Dept.</option>
                <option value="Information Technology">Information Technology</option>
                <option value="Executive Office">Executive Office</option>
                <option value="Human Resources">Human Resources</option>
              </select>
            </div>

            {/* Role Filter */}
            <div className="min-w-0">
              <select 
                className="form-select text-xs h-10 w-full min-w-0"
                value={roleFilter}
                onChange={e => { setRoleFilter(e.target.value); setCurrentPage(1); }}
              >
                <option value="All">All Roles</option>
                <option value="Supervisor">Supervisor</option>
                <option value="Manager">Department Manager</option>
                <option value="HR Staff">HR Staff</option>
                <option value="HR Manager">HR Manager</option>
                <option value="General Manager">General Manager</option>
              </select>
            </div>

            {/* Reset Button */}
            <button 
              type="button" 
              className="btn btn-outline h-10 px-4 flex items-center justify-center gap-1.5 text-xs whitespace-nowrap w-full xl:w-auto" 
              onClick={handleResetFilters}
              title="Reset Filters"
            >
              <RotateCcw size={14} /> Reset
            </button>
          </div>
        </div>

        {/* Table View */}
        <div className="data-table-wrapper overflow-x-auto">
          <table className="data-table w-full text-left">
            <thead>
              <tr className="bg-base/40 border-b border-border">
                <th className="py-3 px-5 text-[11px] font-bold text-text-muted uppercase tracking-wider">Template Name</th>
                <th className="py-3 px-5 text-[11px] font-bold text-text-muted uppercase tracking-wider">Description</th>
                <th className="py-3 px-5 text-[11px] font-bold text-text-muted uppercase tracking-wider">Status</th>
                <th className="py-3 px-5 text-[11px] font-bold text-text-muted uppercase tracking-wider">Steps (Approvers)</th>
                <th className="py-3 px-5 text-[11px] font-bold text-text-muted uppercase tracking-wider">Last Updated</th>
                <th className="py-3 px-5 text-[11px] font-bold text-text-muted uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {paginatedTemplates.map(t => (
                <tr key={t.id} className="hover:bg-base/50 transition-colors">
                  <td className="py-4 px-5 align-top">
                    <div className="font-bold text-sm text-text-primary flex items-center gap-2">
                      {t.name}
                      {t.id === 1 && (
                        <span className="bg-base/80 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-border text-text-secondary">
                          Default
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-5 align-top text-xs text-text-secondary max-w-xs leading-relaxed">
                    {t.description}
                  </td>
                  <td className="py-4 px-5 align-top">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${t.isActive ? 'text-success' : 'text-danger'}`}>
                      <span className={`w-2 h-2 rounded-full ${t.isActive ? 'bg-success' : 'bg-danger'}`} />
                      {t.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-4 px-5 align-top">
                    <div className="flex items-center gap-2 flex-nowrap overflow-x-auto py-1 max-w-xl">
                      {t.steps.map((s, idx) => (
                        <React.Fragment key={s.id || idx}>
                          <div className="inline-flex items-center gap-2 shrink-0">
                            <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-sm">
                              {s.sequenceNumber}
                            </span>
                            <div className="text-left">
                              <div className="text-xs font-bold text-text-primary leading-tight">{s.specificEmployeeName || s.displayLabel}</div>
                              <div className="text-[11px] text-text-muted leading-tight mt-0.5">{s.orgRole || 'Approver'}</div>
                            </div>
                          </div>
                          {idx < t.steps.length - 1 && <ArrowRight size={14} className="text-muted shrink-0 mx-1" />}
                        </React.Fragment>
                      ))}
                    </div>
                  </td>
                  <td className="py-4 px-5 align-top text-xs text-text-muted whitespace-nowrap leading-tight">
                    <div className="text-text-primary font-medium">{new Date(t.updatedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                    <div className="text-[11px] text-text-muted mt-0.5">by {t.updatedBy}</div>
                  </td>
                  <td className="py-4 px-5 align-top text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <button className="p-2 rounded-lg text-primary hover:bg-primary/10 transition-colors" onClick={() => setPreviewTemplate(t)} title="Preview Sequence">
                        <Eye size={16} />
                      </button>
                      <button className="p-2 rounded-lg text-cyan-400 hover:bg-cyan-500/10 transition-colors" onClick={() => handleOpenEdit(t)} title="Edit Template">
                        <Edit2 size={16} />
                      </button>
                      <button className="p-2 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-colors" onClick={() => handleClone(t)} title="Clone Template">
                        <Copy size={16} />
                      </button>
                      <button className={`p-2 rounded-lg transition-colors ${t.isActive ? 'text-rose-400 hover:bg-rose-500/10' : 'text-emerald-400 hover:bg-emerald-500/10'}`} onClick={() => handleToggleActive(t)} title={t.isActive ? 'Deactivate' : 'Activate'}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredTemplates.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted">
                    <GitMerge size={36} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-medium">No approval route templates found.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Row */}
        <div className="px-5 py-3 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 bg-base/20">
          <div className="text-xs text-text-muted">
            Showing <strong className="text-text-primary">{filteredTemplates.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}</strong> to <strong className="text-text-primary">{Math.min(currentPage * itemsPerPage, filteredTemplates.length)}</strong> of <strong className="text-text-primary">{filteredTemplates.length}</strong> templates
          </div>

          <div className="flex items-center gap-3">
            <select 
              className="form-select text-xs h-9 px-3 py-0"
              value={itemsPerPage}
              onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
            >
              <option value={5}>5 per page</option>
              <option value={10}>10 per page</option>
              <option value={20}>20 per page</option>
            </select>

            <div className="flex items-center gap-1.5">
              <button 
                type="button" 
                className="btn btn-outline btn-sm p-1.5 h-9 w-9 flex items-center justify-center disabled:opacity-40 rounded-lg"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                type="button" 
                className="btn btn-primary btn-sm h-9 w-9 flex items-center justify-center font-bold text-xs rounded-lg"
              >
                {currentPage}
              </button>
              <button 
                type="button" 
                className="btn btn-outline btn-sm p-1.5 h-9 w-9 flex items-center justify-center disabled:opacity-40 rounded-lg"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal / Slide-Over: Create or Edit Template */}
      {(isCreating || editingTemplate) && (
        <DialogOverlay onClose={() => { setIsCreating(false); setEditingTemplate(null); }} label={editingTemplate ? 'Edit approval route template' : 'Create approval route template'} closeOnBackdrop>
          <div className="modal-content max-w-4xl animate-slide-up">
            <div className="modal-header flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-lg font-bold text-text-primary">
                {editingTemplate ? `Edit Template: ${editingTemplate.name}` : 'Create Route Template'}
              </h2>
              <button className="modal-close p-1 text-muted hover:text-text-primary" onClick={() => { setIsCreating(false); setEditingTemplate(null); }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveSubmit} className="space-y-6 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Panel: Template Details */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Template Details</h3>
                  
                  <div>
                    <label className="form-label text-xs font-bold text-text-secondary block mb-1">Template Name <span className="text-danger">*</span></label>
                    <input 
                      type="text" 
                      className="form-input text-xs w-full"
                      value={formName} 
                      onChange={e => setFormName(e.target.value)} 
                      required 
                      placeholder="e.g. Standard Employee Route" 
                    />
                  </div>

                  <div>
                    <label className="form-label text-xs font-bold text-text-secondary block mb-1">Description</label>
                    <textarea 
                      className="form-textarea text-xs w-full" 
                      rows={2} 
                      value={formDesc} 
                      onChange={e => setFormDesc(e.target.value)} 
                      placeholder="Standard multi-level approval route for regular employees." 
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="templateActive" 
                      checked={formActive} 
                      onChange={e => setFormActive(e.target.checked)} 
                      className="form-checkbox" 
                    />
                    <label htmlFor="templateActive" className="text-xs font-medium cursor-pointer text-text-primary">
                      Active (Available for assignment)
                    </label>
                  </div>

                  <div className="border-t border-border pt-3">
                    <h4 className="text-xs font-bold text-text-secondary uppercase mb-2">Optional Route Conditions</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] text-muted block mb-1">Department</label>
                        <select className="form-select text-xs w-full" value={formDeptCondition} onChange={e => setFormDeptCondition(e.target.value)}>
                          <option value="">All Departments</option>
                          <option value="Production Dept.">Production Dept.</option>
                          <option value="Information Technology">Information Technology</option>
                          <option value="Executive Office">Executive Office</option>
                          <option value="Human Resources">Human Resources</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] text-muted block mb-1">Employment Status</label>
                        <select className="form-select text-xs w-full" value={formRoleCondition} onChange={e => setFormRoleCondition(e.target.value)}>
                          <option value="">All Statuses</option>
                          <option value="Regular">Regular</option>
                          <option value="Probationary">Probationary</option>
                          <option value="Contractual">Contractual</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Panel: Approvers & Steps Chain */}
                <div className="space-y-4 border-l border-border pl-0 md:pl-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Approvers / Steps Chain</h3>
                    <button type="button" className="btn btn-outline btn-sm text-xs flex items-center gap-1" onClick={handleAddStep}>
                      <Plus size={14} /> Add Step
                    </button>
                  </div>

                  {duplicateWarning && (
                    <div className="alert alert-warning text-xs p-2.5 flex items-center gap-2">
                      <AlertCircle size={16} className="shrink-0 text-warning" />
                      <span>{duplicateWarning}</span>
                    </div>
                  )}

                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {formSteps.map((step, index) => (
                      <div key={step.id || index} className="bg-base/60 p-3 rounded-lg border border-border flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-1">
                          {index + 1}
                        </div>

                        <div className="flex-1 min-w-0">
                          <label className="text-[11px] font-bold text-muted block mb-1">Select Approver (by Name or Dynamic Role)</label>
                          <select 
                            className="form-select text-xs w-full mb-1.5"
                            value={step.specificEmployeeId ? `emp_${step.specificEmployeeId}` : step.stepType}
                            onChange={e => handleApproverSelectChange(index, e.target.value)}
                          >
                            <optgroup label="Named Employees">
                              {employees.map(emp => (
                                <option key={emp.id} value={`emp_${emp.id}`}>
                                  {emp.fullName} ({emp.position} - {emp.department})
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label="Dynamic Approver Roles">
                              {Object.entries(DYNAMIC_ROLE_LABELS).map(([val, label]) => (
                                <option key={val} value={val}>{label}</option>
                              ))}
                            </optgroup>
                          </select>
                          <div className="text-[10px] text-muted truncate">{step.orgRole || step.displayLabel}</div>
                        </div>

                        <div className="flex items-center gap-0.5 shrink-0 mt-1">
                          <button type="button" className="btn btn-ghost p-1 text-muted hover:text-text-primary" onClick={() => handleMoveStep(index, 'up')} disabled={index === 0}>
                            <ArrowUp size={14} />
                          </button>
                          <button type="button" className="btn btn-ghost p-1 text-muted hover:text-text-primary" onClick={() => handleMoveStep(index, 'down')} disabled={index === formSteps.length - 1}>
                            <ArrowDown size={14} />
                          </button>
                          <button type="button" className="btn btn-ghost p-1 text-danger hover:bg-danger/10" onClick={() => handleRemoveStep(index)} disabled={formSteps.length <= 1}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Live Preview Panel */}
              <div className="border-t border-border pt-4">
                <h4 className="text-xs font-bold text-text-primary uppercase mb-2">Live Template Flow Preview</h4>
                <div className="bg-base/40 p-4 rounded-xl border border-border flex items-center gap-2 overflow-x-auto">
                  {formSteps.map((step, idx) => (
                    <React.Fragment key={step.id || idx}>
                      <div className={`p-3 rounded-lg border flex flex-col items-start min-w-[180px] shrink-0 ${idx === 0 ? 'border-primary bg-primary/5' : idx === formSteps.length - 1 ? 'border-success bg-success/5' : 'border-border bg-base/80'}`}>
                        <div className="flex items-center justify-between w-full mb-1">
                          <span className="text-[10px] font-bold text-muted uppercase">Step {idx + 1}</span>
                          {idx === 0 && <span className="badge badge-primary text-[9px] py-0 px-1">Start</span>}
                          {idx === formSteps.length - 1 && formSteps.length > 1 && <span className="badge badge-success text-[9px] py-0 px-1">Final Approval</span>}
                        </div>
                        <div className="text-xs font-bold text-text-primary truncate w-full">{step.specificEmployeeName || step.displayLabel}</div>
                        <div className="text-[10px] text-text-muted truncate w-full">{step.orgRole || 'Approver'}</div>
                      </div>
                      {idx < formSteps.length - 1 && <ArrowRight size={16} className="text-primary shrink-0 mx-1" />}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => { setIsCreating(false); setEditingTemplate(null); }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm flex items-center gap-2">
                  <CheckCircle2 size={16} /> Save Template
                </button>
              </div>
            </form>
          </div>
        </DialogOverlay>
      )}

      {/* Flow Sequence Preview Modal */}
      {previewTemplate && (
        <DialogOverlay onClose={() => setPreviewTemplate(null)} label={`Approval flow for ${previewTemplate.name}`} closeOnBackdrop>
          <div className="modal-content animate-slide-up max-w-2xl">
            <div className="modal-header flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="text-base font-bold text-text-primary">Approval Flow: {previewTemplate.name}</h2>
                <p className="text-xs text-text-muted mt-0.5">{previewTemplate.description}</p>
              </div>
              <button className="modal-close p-1 text-muted hover:text-text-primary" onClick={() => setPreviewTemplate(null)}><X size={20} /></button>
            </div>
            
            <div className="py-6 space-y-4">
              <div className="flex flex-col gap-3">
                {previewTemplate.steps.map((step, idx) => (
                  <div key={step.id || idx} className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-sm">
                      {step.sequenceNumber}
                    </div>
                    <div className="flex-1 bg-base/60 p-3 rounded-lg border border-border flex items-center justify-between">
                      <div>
                        <div className="font-bold text-sm text-text-primary">{step.specificEmployeeName || step.displayLabel}</div>
                        <div className="text-xs text-text-muted">{step.orgRole || 'Approver Step'}</div>
                      </div>
                      {idx === 0 && <span className="badge badge-primary text-xs">First Step</span>}
                      {idx === previewTemplate.steps.length - 1 && <span className="badge badge-success text-xs">Final Approval</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end border-t border-border pt-3">
              <button className="btn btn-outline btn-sm" onClick={() => setPreviewTemplate(null)}>Close Preview</button>
            </div>
          </div>
        </DialogOverlay>
      )}
    </div>
  );
};
