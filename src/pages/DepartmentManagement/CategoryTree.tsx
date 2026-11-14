import React, { useState, useMemo } from 'react';
import type { ApprovalCategoryNode, DepartmentNode } from '../../lib/api';
import { 
  FolderTree, 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  Search, 
  Layers, 
  Users, 
  ShieldCheck, 
  UserCheck, 
  Building2,
  AlertCircle,
  GripVertical
} from 'lucide-react';

interface CategoryTreeProps {
  categories: ApprovalCategoryNode[];
  selectedCategoryId: number | null;
  selectedDepartmentId: number | null;
  onSelectCategory: (category: ApprovalCategoryNode) => void;
  onSelectDepartment: (department: DepartmentNode, category: ApprovalCategoryNode) => void;
  onAddCategory: () => void;
  onAddDepartment: (defaultCategoryId?: number) => void;
  onReorderHierarchy: (categories: ApprovalCategoryNode[]) => void;
}

export const CategoryTree: React.FC<CategoryTreeProps> = ({
  categories,
  selectedCategoryId,
  selectedDepartmentId,
  onSelectCategory,
  onSelectDepartment,
  onAddCategory,
  onAddDepartment,
  onReorderHierarchy
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [dragged, setDragged] = useState<{ type: 'category' | 'department'; id: number; categoryId?: number | null } | null>(null);
  const canReorder = !searchQuery.trim();

  const reorderCategory = (targetId: number) => {
    if (!dragged || dragged.type !== 'category' || dragged.id === targetId) return;
    const sourceIndex = categories.findIndex(category => category.id === dragged.id);
    const targetIndex = categories.findIndex(category => category.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const next = [...categories];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    onReorderHierarchy(next);
  };

  const moveDepartment = (targetCategoryId: number | null, beforeDepartmentId?: number) => {
    if (!dragged || dragged.type !== 'department') return;
    let movedDepartment: DepartmentNode | undefined;
    const next = categories.map(category => ({
      ...category,
      departments: category.departments.filter(department => {
        if (department.id !== dragged.id) return true;
        movedDepartment = department;
        return false;
      })
    }));
    if (!movedDepartment) return;
    const targetCategory = next.find(category => category.id === targetCategoryId);
    if (!targetCategory) return;
    const insertAt = beforeDepartmentId === undefined
      ? targetCategory.departments.length
      : Math.max(0, targetCategory.departments.findIndex(department => department.id === beforeDepartmentId));
    targetCategory.departments.splice(insertAt, 0, {
      ...movedDepartment,
      categoryId: targetCategory.id,
      categoryName: targetCategory.name
    });
    onReorderHierarchy(next);
  };

  const toggleCategoryCollapse = (catKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedCategories(prev => ({
      ...prev,
      [catKey]: !prev[catKey]
    }));
  };

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const query = searchQuery.toLowerCase().trim();

    return categories.map(cat => {
      const catMatches = cat.name.toLowerCase().includes(query) || (cat.secondApproverName && cat.secondApproverName.toLowerCase().includes(query));
      const matchingDepts = cat.departments.filter(dept => 
        dept.name.toLowerCase().includes(query) ||
        (dept.firstApproverName && dept.firstApproverName.toLowerCase().includes(query)) ||
        (dept.employees && dept.employees.some(e => e.fullName.toLowerCase().includes(query)))
      );

      if (catMatches || matchingDepts.length > 0) {
        return {
          ...cat,
          departments: matchingDepts.length > 0 ? matchingDepts : cat.departments
        };
      }
      return null;
    }).filter(Boolean) as ApprovalCategoryNode[];
  }, [categories, searchQuery]);

  return (
    <div className="flex flex-col h-full bg-surface rounded-2xl border border-border overflow-hidden">
      {/* Top Search & Actions Header */}
      <div className="p-4 border-b border-border space-y-3 bg-base/30">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FolderTree size={18} className="text-primary" />
            <h3 className="font-bold text-sm text-text-primary tracking-tight">Approval Hierarchy</h3>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              className="btn btn-outline btn-xs px-2.5 py-1 text-xs flex items-center gap-1"
              onClick={onAddCategory}
              title="Create new Approval Category"
            >
              <Plus size={13} /> Category
            </button>
            <button
              className="btn btn-primary btn-xs px-2.5 py-1 text-xs flex items-center gap-1"
              onClick={() => onAddDepartment(selectedCategoryId ?? undefined)}
              title="Add Department"
            >
              <Plus size={13} /> Dept
            </button>
          </div>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            className="form-input w-full pl-8.5 pr-3 py-1.5 text-xs rounded-lg"
            placeholder="Search category, dept, or approver..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <p className="text-[10px] text-muted">Drag categories to reorder them. Drag departments to reorder or move them to another category.</p>
      </div>

      {/* Tree Content Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredCategories.length === 0 ? (
          <div className="p-8 text-center text-text-secondary space-y-2">
            <AlertCircle size={28} className="mx-auto text-muted/60" />
            <p className="text-xs font-medium">No matching categories found</p>
            {searchQuery && (
              <button 
                className="btn btn-ghost btn-xs text-primary underline"
                onClick={() => setSearchQuery('')}
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          filteredCategories.map(cat => {
            const catKey = String(cat.id ?? 'uncategorized');
            const isCollapsed = Boolean(collapsedCategories[catKey]);
            const isCatSelected = selectedCategoryId === cat.id && selectedDepartmentId === null;

            return (
              <div 
                key={catKey} 
                className="rounded-xl border border-border/80 bg-base/40 overflow-hidden transition-all duration-150"
              >
                {/* Category Header Row */}
                <div
                  className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${
                    isCatSelected
                      ? 'bg-primary/15 border-l-4 border-l-primary text-primary font-bold'
                      : 'hover:bg-base/80 text-text-primary'
                  }`}
                  onClick={() => onSelectCategory(cat)}
                  draggable={canReorder && cat.id !== null}
                  onDragStart={event => {
                    if (cat.id === null) return;
                    setDragged({ type: 'category', id: cat.id });
                    event.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragEnd={() => setDragged(null)}
                  onDragOver={event => { if (canReorder) event.preventDefault(); }}
                  onDrop={event => {
                    event.preventDefault();
                    if (cat.id !== null && dragged?.type === 'category') reorderCategory(cat.id);
                    else if (dragged?.type === 'department') moveDepartment(cat.id);
                    setDragged(null);
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {cat.id !== null && <GripVertical size={14} className="text-muted shrink-0 cursor-grab" aria-hidden="true" />}
                    <button
                      className="p-1 hover:bg-surface rounded text-muted hover:text-text-primary shrink-0 transition-colors"
                      onClick={(e) => toggleCategoryCollapse(catKey, e)}
                    >
                      {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    </button>
                    
                    <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <Layers size={13} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold truncate uppercase tracking-wide">
                          {cat.name}
                        </span>
                        <span className="badge badge-neutral text-[10px] px-1.5 py-0.2 shrink-0">
                          {cat.departments.length}
                        </span>
                      </div>
                      
                      {cat.secondApproverName ? (
                        <div className="flex items-center gap-1 text-[11px] text-muted truncate mt-0.5">
                          <ShieldCheck size={11} className="text-success shrink-0" />
                          <span className="truncate">Approver: {cat.secondApproverName}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[11px] text-warning truncate mt-0.5">
                          <AlertCircle size={11} className="shrink-0" />
                          <span>No Approver</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 text-muted ml-2">
                    <Users size={12} />
                    <span className="text-[11px] font-semibold">{cat.employeeCount}</span>
                  </div>
                </div>

                {/* Sub-departments List */}
                {!isCollapsed && cat.departments.length > 0 && (
                  <div className="p-1.5 space-y-1 bg-surface/60 border-t border-border/60">
                    {cat.departments.map(dept => {
                      const isDeptSelected = selectedDepartmentId === dept.id;

                      return (
                        <div
                          key={dept.id}
                          className={`flex items-center justify-between py-2 px-3 pl-7 rounded-lg cursor-pointer transition-all ${
                            isDeptSelected
                              ? 'bg-primary text-white shadow-sm font-semibold'
                              : 'hover:bg-base/70 text-text-secondary hover:text-text-primary'
                          }`}
                          onClick={() => onSelectDepartment(dept, cat)}
                          draggable={canReorder}
                          onDragStart={event => {
                            event.stopPropagation();
                            setDragged({ type: 'department', id: dept.id, categoryId: cat.id });
                            event.dataTransfer.effectAllowed = 'move';
                          }}
                          onDragEnd={() => setDragged(null)}
                          onDragOver={event => { if (canReorder) event.preventDefault(); }}
                          onDrop={event => {
                            event.preventDefault();
                            event.stopPropagation();
                            moveDepartment(cat.id, dept.id);
                            setDragged(null);
                          }}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <GripVertical size={13} className={isDeptSelected ? 'text-white/70 cursor-grab' : 'text-muted cursor-grab'} aria-hidden="true" />
                            <Building2 size={13} className={isDeptSelected ? 'text-white' : 'text-muted'} />
                            <div className="min-w-0 flex-1">
                              <p className={`text-xs truncate leading-tight ${isDeptSelected ? 'text-white font-medium' : 'text-text-primary font-medium'}`}>
                                {dept.name}
                              </p>
                              <div className="flex items-center gap-2 text-[10px] mt-0.5">
                                {dept.firstApproverName ? (
                                  <span className={`flex items-center gap-0.5 truncate ${isDeptSelected ? 'text-white/80' : 'text-info font-normal'}`}>
                                    <UserCheck size={10} /> Recommending: {dept.firstApproverName.split(' ')[0]}
                                  </span>
                                ) : (
                                  <span className={isDeptSelected ? 'text-white/60' : 'text-muted'}>
                                    1st: None
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                              isDeptSelected ? 'bg-white/20 text-white' : 'bg-base text-muted font-medium'
                            }`}>
                              {dept.employeeCount}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {!isCollapsed && cat.departments.length === 0 && (
                  <div className="py-3 px-4 text-center text-muted text-[11px] bg-surface/30 border-t border-border/40">
                    No departments in this category yet.{' '}
                    <button 
                      className="text-primary hover:underline font-medium"
                      onClick={() => onAddDepartment(cat.id ?? undefined)}
                    >
                      + Add One
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-border bg-base/50 text-[11px] text-muted flex items-center justify-between">
        <span>{categories.length} Categories</span>
        <span>{categories.reduce((acc, c) => acc + c.departmentCount, 0)} Departments</span>
      </div>
    </div>
  );
};
