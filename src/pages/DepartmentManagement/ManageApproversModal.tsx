import React, { useState, useEffect } from 'react';
import { X, Search, ShieldCheck, Plus, AlertCircle } from 'lucide-react';
import type { DepartmentNode, HREmployee } from '../../lib/api';
import { DialogOverlay } from '../../components/ui/DialogOverlay';

interface ManageApproversModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedUnit: DepartmentNode | null;
  allEmployees: HREmployee[];
  onAddApprover: (unitId: number, data: { approverId: number; stepOrder: number; stepLabel: string }) => Promise<void>;
}

const COMMON_STEP_LABELS = [
  'Immediate Supervisor',
  'Section Head',
  'Department Manager',
  'Division Head',
  'HR Reviewer'
];

export const ManageApproversModal: React.FC<ManageApproversModalProps> = ({
  isOpen,
  onClose,
  selectedUnit,
  allEmployees = [],
  onAddApprover
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedApproverId, setSelectedApproverId] = useState<number>(0);
  const [stepLabel, setStepLabel] = useState('');
  const [stepOrder, setStepOrder] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedUnit?.approvers && Array.isArray(selectedUnit.approvers)) {
      setStepOrder(selectedUnit.approvers.length);
    } else {
      setStepOrder(0);
    }
    setSelectedApproverId(0);
    setStepLabel('Immediate Supervisor');
    setSearchTerm('');
    setError(null);
  }, [selectedUnit, isOpen]);

  if (!isOpen || !selectedUnit) return null;

  const existingApproverIds = new Set(
    (selectedUnit.approvers || [])
      .filter(a => a && typeof a.approverId === 'number')
      .map(a => a.approverId)
  );

  const safeEmployees = Array.isArray(allEmployees) ? allEmployees.filter(Boolean) : [];

  const filteredEmployees = safeEmployees.filter(emp => {
    if (!emp || typeof emp.id !== 'number') return false;
    if (existingApproverIds.has(emp.id)) return false; // Already in chain
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    const name = (emp.fullName || '').toLowerCase();
    const empId = (emp.employeeID || '').toLowerCase();
    const pos = (emp.position || '').toLowerCase();
    const dept = (emp.department || '').toLowerCase();
    return name.includes(q) || empId.includes(q) || pos.includes(q) || dept.includes(q);
  });

  const selectedEmployee = safeEmployees.find(e => e.id === selectedApproverId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApproverId) {
      setError('Please select an employee to act as approver.');
      return;
    }
    if (!stepLabel.trim()) {
      setError('Please provide a step role label.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onAddApprover(selectedUnit.id, {
        approverId: selectedApproverId,
        stepOrder,
        stepLabel: stepLabel.trim()
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to add unit approver');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogOverlay onClose={onClose} label="Manage department approvers" closeOnBackdrop style={{ zIndex: 1000 }}>
      <div className="modal-content animate-slide-up max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                Add Approver &bull; {selectedUnit.name}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configure a review step in this unit's approval chain.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1.5 rounded-md transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2.5">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          {/* Employee Selection */}
          <div className="space-y-2">
            <label className="block font-semibold text-foreground">
              Select Approver <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by name, ID, or position..."
                className="input w-full pl-8.5 py-2 text-xs"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="max-h-40 overflow-y-auto border border-border rounded-lg divide-y divide-border">
              {filteredEmployees.slice(0, 30).map(emp => (
                <div
                  key={emp.id}
                  onClick={() => setSelectedApproverId(emp.id)}
                  className={`p-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                    selectedApproverId === emp.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/40'
                  }`}
                >
                  <div>
                    <div className="font-semibold text-xs">{emp.fullName}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {emp.position || 'Staff'} &bull; {emp.department || 'Unassigned'}
                    </div>
                  </div>
                  {selectedApproverId === emp.id && (
                    <span className="badge badge-primary text-[10px]">Selected</span>
                  )}
                </div>
              ))}
              {filteredEmployees.length === 0 && (
                <div className="p-4 text-center text-muted-foreground text-xs">
                  No matching employees found.
                </div>
              )}
            </div>
            {selectedEmployee && (
              <p className="text-[11px] text-primary font-medium mt-1">
                Selected: {selectedEmployee.fullName} ({selectedEmployee.position || 'Staff'})
              </p>
            )}
          </div>

          {/* Step Role Label */}
          <div className="space-y-2">
            <label className="block font-semibold text-foreground">
              Approval Step Role / Title <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Immediate Supervisor, Department Manager"
              className="input w-full py-2 px-3 text-xs"
              value={stepLabel}
              onChange={e => setStepLabel(e.target.value)}
            />
            {/* Quick Suggestions */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {COMMON_STEP_LABELS.map(lbl => (
                <button
                  key={lbl}
                  type="button"
                  onClick={() => setStepLabel(lbl)}
                  className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors ${
                    stepLabel === lbl
                      ? 'bg-primary/15 border-primary text-primary font-medium'
                      : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {/* Step Sequence Order */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-foreground">
              Approval Sequence Level
            </label>
            <input
              type="number"
              min={0}
              className="input w-full py-2 px-3 text-xs"
              value={stepOrder}
              onChange={e => setStepOrder(parseInt(e.target.value, 10) || 0)}
            />
            <p className="text-[11px] text-muted-foreground">
              Order within unit (0 = Recommending). Higher levels are consulted sequentially.
            </p>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border mt-6">
            <button
              type="button"
              className="btn btn-outline text-xs py-2 px-3.5"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary text-xs py-2 px-4 flex items-center gap-1.5"
              disabled={saving}
            >
              <Plus size={14} />
              {saving ? 'Adding Approver...' : 'Add Approver'}
            </button>
          </div>
        </form>
      </div>
    </DialogOverlay>
  );
};
