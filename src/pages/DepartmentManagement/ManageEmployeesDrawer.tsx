import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Users, Check, AlertCircle } from 'lucide-react';
import type { DepartmentNode, HREmployee, DepartmentMember } from '../../lib/api';
import { DialogOverlay } from '../../components/ui/DialogOverlay';

interface ManageEmployeesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedUnit: DepartmentNode | null;
  allEmployees: HREmployee[];
  onSaveAssignments: (unitId: number, selectedEmployeeIds: number[]) => Promise<void>;
}

export const ManageEmployeesDrawer: React.FC<ManageEmployeesDrawerProps> = ({
  isOpen,
  onClose,
  selectedUnit,
  allEmployees = [],
  onSaveAssignments
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize selected set from selectedUnit's current members
  useEffect(() => {
    if (selectedUnit?.employees && Array.isArray(selectedUnit.employees)) {
      const initialIds = new Set<number>(
        selectedUnit.employees
          .filter((e: DepartmentMember) => e && typeof e.id === 'number')
          .map((e: DepartmentMember) => e.id)
      );
      setSelectedIds(initialIds);
    } else {
      setSelectedIds(new Set<number>());
    }
    setSearchTerm('');
    setError(null);
  }, [selectedUnit, isOpen]);

  const currentMemberIds = useMemo(() => {
    if (!selectedUnit?.employees || !Array.isArray(selectedUnit.employees)) {
      return new Set<number>();
    }
    return new Set<number>(
      selectedUnit.employees
        .filter((e: DepartmentMember) => e && typeof e.id === 'number')
        .map((e: DepartmentMember) => e.id)
    );
  }, [selectedUnit]);

  // Safe employee list
  const safeAllEmployees = useMemo(() => {
    return Array.isArray(allEmployees) ? allEmployees.filter(Boolean) : [];
  }, [allEmployees]);

  // Filter employees
  const filteredEmployees = useMemo(() => {
    return safeAllEmployees.filter(emp => {
      if (!emp || typeof emp.id !== 'number') return false;

      const isCurrentlyAssignedToThisUnit = currentMemberIds.has(emp.id);
      const empDept = emp.department || '';
      const isUnassigned = !emp.leaveDepartmentId;

      if (filterMode === 'assigned' && !selectedIds.has(emp.id)) return false;
      if (filterMode === 'unassigned' && (!isUnassigned || isCurrentlyAssignedToThisUnit)) return false;

      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      const matchName = (emp.fullName || '').toLowerCase().includes(q);
      const matchId = (emp.employeeID || '').toLowerCase().includes(q);
      const matchDept = empDept.toLowerCase().includes(q);
      const matchPos = (emp.position || '').toLowerCase().includes(q);
      return matchName || matchId || matchDept || matchPos;
    });
  }, [safeAllEmployees, currentMemberIds, selectedIds, filterMode, searchTerm, selectedUnit]);

  if (!isOpen || !selectedUnit) return null;

  const toggleEmployee = (empId: number) => {
    setSelectedIds(prev => {
      const next = new Set<number>(prev);
      if (next.has(empId)) {
        next.delete(empId);
      } else {
        next.add(empId);
      }
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    setSelectedIds(prev => {
      const next = new Set<number>(prev);
      filteredEmployees.forEach(e => next.add(e.id));
      return next;
    });
  };

  const handleDeselectAllFiltered = () => {
    setSelectedIds(prev => {
      const next = new Set<number>(prev);
      filteredEmployees.forEach(e => next.delete(e.id));
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSaveAssignments(selectedUnit.id, Array.from(selectedIds));
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to update employee assignments');
    } finally {
      setSaving(false);
    }
  };

  // Compute pending delta
  const addedCount = Array.from(selectedIds).filter((id: number) => !currentMemberIds.has(id)).length;
  const removedCount = Array.from(currentMemberIds).filter((id: number) => !selectedIds.has(id)).length;

  return (
    <DialogOverlay onClose={onClose} label="Manage department employees" closeOnBackdrop style={{ zIndex: 1000 }}>
      <div className="modal-content animate-slide-up max-w-2xl w-full p-6 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Users size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                Manage Leave Routing &bull; {selectedUnit.name}
              </h2>
              <p className="text-xs text-muted-foreground">
                Assign employees to this OnlineFS route. Their AutoID department will not change.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mt-3 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Search and Filters */}
        <div className="mt-4 space-y-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search employees by name, ID, position, or AutoID department..."
              className="input w-full pl-8 py-2 text-xs"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
            <div className="flex items-center gap-1.5 bg-muted p-0.5 rounded-lg border border-border">
              <button
                type="button"
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  filterMode === 'all' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setFilterMode('all')}
              >
                All ({safeAllEmployees.length})
              </button>
              <button
                type="button"
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  filterMode === 'assigned' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setFilterMode('assigned')}
              >
                Selected ({selectedIds.size})
              </button>
              <button
                type="button"
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  filterMode === 'unassigned' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setFilterMode('unassigned')}
              >
                Unassigned
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                className="text-primary hover:underline text-[11px]"
                onClick={handleSelectAllFiltered}
              >
                Select filtered
              </button>
              <span className="text-border">&bull;</span>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground text-[11px]"
                onClick={handleDeselectAllFiltered}
              >
                Deselect filtered
              </button>
            </div>
          </div>
        </div>

        {/* Employee List */}
        <div className="flex-1 overflow-y-auto mt-4 border border-border rounded-lg divide-y divide-border min-h-[220px]">
          {filteredEmployees.length > 0 ? (
            filteredEmployees.map(emp => {
              const isChecked = selectedIds.has(emp.id);
              const isOriginallyAssigned = currentMemberIds.has(emp.id);
              const isOtherDept = Boolean(emp.leaveDepartmentId && emp.leaveDepartmentId !== selectedUnit.id && !isOriginallyAssigned);
              
              // Safe initials calculation
              const fullName = emp.fullName || 'Employee';
              const nameParts = fullName.trim().split(/\s+/).filter(Boolean);
              const initials = nameParts.length > 0 
                ? nameParts.map(n => n.charAt(0)).slice(0, 2).join('').toUpperCase() 
                : 'EM';

              return (
                <div
                  key={emp.id}
                  onClick={() => toggleEmployee(emp.id)}
                  className={`p-3.5 flex items-center justify-between cursor-pointer transition-colors ${
                    isChecked ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <input
                      type="checkbox"
                      className="rounded border-border text-primary focus:ring-primary h-4 w-4 shrink-0 pointer-events-none"
                      checked={isChecked}
                      onChange={() => {}}
                    />
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold text-xs text-muted-foreground shrink-0 border border-border">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-foreground flex items-center gap-2">
                        <span className="truncate">{emp.fullName}</span>
                        {isOriginallyAssigned && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-normal shrink-0">
                            Current Member
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                        <span className="font-mono">{emp.employeeID}</span> &bull; {emp.position || 'Staff'} 
                        {isOtherDept && (
                          <span className="text-warning ml-1">
                            (Routing: {emp.leaveDepartmentName || 'Another department'}; AutoID: {emp.department || 'Unassigned'})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 ml-2">
                    {isChecked ? (
                      <span className="text-primary flex items-center gap-1 text-xs font-semibold">
                        <Check size={14} /> Assigned
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        Click to assign
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No employees found matching filter.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-border mt-4 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-muted-foreground">
            <strong>{selectedIds.size}</strong> employees selected
            {(addedCount > 0 || removedCount > 0) && (
              <span className="ml-2 font-medium">
                ({addedCount > 0 && <span className="text-success">+{addedCount} new</span>}
                {addedCount > 0 && removedCount > 0 && <span>, </span>}
                {removedCount > 0 && <span className="text-destructive">-{removedCount} removed</span>})
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              className="btn btn-outline text-xs py-2 px-3.5"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary text-xs py-2 px-4 flex items-center gap-1.5"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </DialogOverlay>
  );
};
