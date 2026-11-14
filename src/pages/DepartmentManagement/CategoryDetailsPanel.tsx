import React from 'react';
import type { ApprovalCategoryNode, DepartmentNode } from '../../lib/api';
import { 
  Layers, 
  ShieldCheck, 
  Users, 
  Building2, 
  Edit3, 
  Trash2, 
  Plus, 
  ArrowRightLeft, 
  UserCheck, 
  AlertCircle,
  ExternalLink
} from 'lucide-react';

interface CategoryDetailsPanelProps {
  category: ApprovalCategoryNode;
  onEditCategory: (category: ApprovalCategoryNode) => void;
  onDeleteCategory: (category: ApprovalCategoryNode) => void;
  onChangeApprover: (category: ApprovalCategoryNode) => void;
  onAddDepartment: (categoryId: number) => void;
  onSelectDepartment: (department: DepartmentNode) => void;
  onEditDepartment: (department: DepartmentNode) => void;
  onMoveDepartment: (department: DepartmentNode) => void;
  onManageEmployees: (department: DepartmentNode) => void;
}

export const CategoryDetailsPanel: React.FC<CategoryDetailsPanelProps> = ({
  category,
  onEditCategory,
  onDeleteCategory,
  onChangeApprover,
  onAddDepartment,
  onSelectDepartment,
  onEditDepartment,
  onMoveDepartment,
  onManageEmployees
}) => {
  const getInitials = (name: string) => {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const departmentsWithFirstApprover = category.departments.filter(d => d.firstApproverId).length;

  return (
    <div className="flex flex-col h-full bg-surface rounded-2xl border border-border overflow-hidden">
      {/* Category Header */}
      <div className="p-6 border-b border-border bg-base/30 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 shadow-sm">
              <Layers size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-text-primary uppercase tracking-tight">
                  {category.name}
                </h2>
                <span className={`badge ${category.isActive ? 'badge-success' : 'badge-neutral'} text-[11px]`}>
                  {category.isActive ? 'Active Category' : 'Inactive'}
                </span>
              </div>
              <p className="text-xs text-text-secondary mt-1 max-w-xl leading-relaxed">
                {category.description || 'No description provided for this approval group.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              className="btn btn-outline btn-sm text-xs flex items-center gap-1.5"
              onClick={() => onEditCategory(category)}
            >
              <Edit3 size={14} /> Edit Category
            </button>
            <button
              className="btn btn-primary btn-sm text-xs flex items-center gap-1.5"
              onClick={() => category.id && onAddDepartment(category.id)}
            >
              <Plus size={14} /> Add Department
            </button>
            {category.id && (
              <button
                className="btn btn-ghost btn-sm text-xs text-danger hover:bg-danger/10 p-2"
                onClick={() => onDeleteCategory(category)}
                title="Delete Category"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Approver Hero Card */}
        <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-sm shadow-md shrink-0">
              {category.secondApproverName ? getInitials(category.secondApproverName) : 'A'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                  <ShieldCheck size={13} /> Common Approver (Category-Level)
                </span>
              </div>
              {category.secondApproverName ? (
                <div className="mt-0.5">
                  <p className="text-sm font-bold text-text-primary leading-tight">
                    {category.secondApproverName}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {category.secondApproverPosition || 'Designated Approver'}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-warning font-medium mt-0.5 flex items-center gap-1">
                  <AlertCircle size={13} /> No Approver configured for this category yet.
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <p className="hidden lg:block text-[11px] text-muted text-right max-w-[200px] leading-tight">
              Inherited by all {category.departments.length} departments under {category.name}
            </p>
            <button
              className="btn btn-outline btn-sm bg-surface text-xs font-semibold shadow-xs"
              onClick={() => onChangeApprover(category)}
            >
              {category.secondApproverId ? 'Change Approver' : 'Assign Approver'}
            </button>
          </div>
        </div>

        {/* Quick Statistics Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-surface border border-border/80 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-info/10 text-info flex items-center justify-center shrink-0">
              <Building2 size={18} />
            </div>
            <div>
              <p className="text-[11px] text-muted font-medium">Departments</p>
              <p className="text-base font-bold text-text-primary leading-tight">{category.departments.length}</p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-surface border border-border/80 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-success/10 text-success flex items-center justify-center shrink-0">
              <Users size={18} />
            </div>
            <div>
              <p className="text-[11px] text-muted font-medium">Total Employees</p>
              <p className="text-base font-bold text-text-primary leading-tight">{category.employeeCount}</p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-surface border border-border/80 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <UserCheck size={18} />
            </div>
            <div>
              <p className="text-[11px] text-muted font-medium">With Recommending</p>
              <p className="text-base font-bold text-text-primary leading-tight">
                {departmentsWithFirstApprover} / {category.departments.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Departments Table Header & Content */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-6 py-3 border-b border-border bg-base/10 flex items-center justify-between">
          <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
            Departments inside {category.name} ({category.departments.length})
          </h3>
          <span className="text-[11px] text-muted">
            Click a department to view details, members, and approval route preview
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {category.departments.length === 0 ? (
            <div className="p-10 text-center text-text-secondary space-y-3">
              <Building2 size={36} className="mx-auto text-muted/50" />
              <p className="text-sm font-semibold text-text-primary">No departments in this category</p>
              <p className="text-xs text-muted max-w-sm mx-auto">
                Create a department directly in this category or move existing departments from other groups.
              </p>
              <button
                className="btn btn-primary btn-sm text-xs mt-2"
                onClick={() => category.id && onAddDepartment(category.id)}
              >
                <Plus size={14} /> Add Department
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {category.departments.map(dept => (
                <div
                  key={dept.id}
                  className="p-4 rounded-xl border border-border bg-base/30 hover:border-primary/40 hover:bg-base/70 transition-all space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-primary shrink-0">
                          <Building2 size={16} />
                        </div>
                        <div>
                          <h4 
                            className="font-bold text-sm text-text-primary hover:text-primary cursor-pointer leading-tight"
                            onClick={() => onSelectDepartment(dept)}
                          >
                            {dept.name}
                          </h4>
                          <span className="text-[11px] text-muted">
                            {dept.employeeCount} Assigned Member{dept.employeeCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>

                      <span className={`badge ${dept.isActive ? 'badge-success' : 'badge-neutral'} text-[10px]`}>
                        {dept.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    {dept.description && (
                      <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
                        {dept.description}
                      </p>
                    )}

                    {/* Approver configuration summary */}
                    <div className="p-2.5 rounded-lg bg-surface/80 border border-border/60 text-xs space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted flex items-center gap-1">
                          <UserCheck size={12} className="text-info" /> Recommending:
                        </span>
                        {dept.firstApproverName ? (
                          <span className="font-semibold text-text-primary truncate max-w-[160px]">
                            {dept.firstApproverName}
                          </span>
                        ) : (
                          <span className="text-muted font-normal italic">None (Optional)</span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted flex items-center gap-1">
                          <ShieldCheck size={12} className="text-success" /> Approver:
                        </span>
                        <span className="font-semibold text-primary truncate max-w-[160px]" title="Inherited from Category">
                          {category.secondApproverName || 'None configured'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Toolbar */}
                  <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-2">
                    <button
                      className="btn btn-outline btn-xs px-2.5 py-1 text-xs flex items-center gap-1 text-primary"
                      onClick={() => onSelectDepartment(dept)}
                    >
                      <ExternalLink size={12} /> View Details
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        className="btn btn-ghost btn-xs px-2 py-1 text-xs"
                        onClick={() => onMoveDepartment(dept)}
                        title="Move to another category"
                      >
                        <ArrowRightLeft size={13} /> Move
                      </button>
                      <button
                        className="btn btn-ghost btn-xs px-2 py-1 text-xs"
                        onClick={() => onManageEmployees(dept)}
                        title="Manage employees"
                      >
                        <Users size={13} /> People
                      </button>
                      <button
                        className="btn btn-ghost btn-xs px-2 py-1 text-xs"
                        onClick={() => onEditDepartment(dept)}
                        title="Edit department"
                      >
                        <Edit3 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
