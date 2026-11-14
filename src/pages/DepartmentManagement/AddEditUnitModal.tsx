import React, { useState, useEffect, useRef } from 'react';
import { getApiErrorMessage, type DepartmentNode, type ApprovalCategoryNode, type HREmployee } from '../../lib/api';
import { Building2, X, ShieldCheck, Check, Layers } from 'lucide-react';
import { DialogOverlay } from '../../components/ui/DialogOverlay';
import { ApproverMembersSelect } from './ApproverMembersSelect';

interface AddEditUnitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    description?: string;
    categoryId?: number | null;
    firstApproverId?: number | null;
    firstApproverIds?: number[];
    notedByApproverIds?: number[];
    backupApprovers?: { notedBy: number | null; recommending: number | null; approver: number | null };
    requiresOperatorLineLeader?: boolean;
    sickLeaveLineLeaderId?: number | null;
    operatorLineLeaderAssignments?: Record<number, number | null>;

    secondApproverOverrideId?: number | null;
    isActive?: boolean;
  }) => Promise<void>;
  unitToEdit?: DepartmentNode | null;
  categories: ApprovalCategoryNode[];
  employees: HREmployee[];
  defaultCategoryId?: number | null;
  focusBackups?: boolean;
}

export const AddEditUnitModal: React.FC<AddEditUnitModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  unitToEdit,
  categories,
  employees,
  defaultCategoryId,
  focusBackups = false
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [firstApproverIds, setFirstApproverIds] = useState<number[]>([]);
  const [notedByApproverIds, setNotedByApproverIds] = useState<number[]>([]);
  const [useSecondApproverOverride, setUseSecondApproverOverride] = useState(false);
  const [secondApproverOverrideId, setSecondApproverOverrideId] = useState<string>('');
  const [requiresOperatorLineLeader, setRequiresOperatorLineLeader] = useState(false);
  const [sickLeaveLineLeaderId, setSickLeaveLineLeaderId] = useState('');
  const [backupApprovers, setBackupApprovers] = useState<{ notedBy: number | null; recommending: number | null; approver: number | null }>({ notedBy: null, recommending: null, approver: null });
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const backupSelectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (unitToEdit) {
      setName(unitToEdit.name);
      setDescription(unitToEdit.description || '');
      setCategoryId(unitToEdit.categoryId ? String(unitToEdit.categoryId) : '');
      setFirstApproverIds(unitToEdit.firstApproverIds ?? (unitToEdit.firstApproverId ? [unitToEdit.firstApproverId] : []));
      setNotedByApproverIds(unitToEdit.notedByApproverIds ?? []);
      setUseSecondApproverOverride(Boolean(unitToEdit.hasSecondApproverOverride || unitToEdit.secondApproverOverrideId));
      setSecondApproverOverrideId(unitToEdit.secondApproverOverrideId ? String(unitToEdit.secondApproverOverrideId) : '');
      setIsActive(unitToEdit.isActive);
    } else {
      setName('');
      setDescription('');
      setCategoryId(defaultCategoryId ? String(defaultCategoryId) : (categories[0]?.id ? String(categories[0].id) : ''));
      setFirstApproverIds([]);
      setNotedByApproverIds([]);
      setUseSecondApproverOverride(false);
      setSecondApproverOverrideId('');
      setIsActive(true);
    }
    setBackupApprovers(unitToEdit?.backupApprovers ?? { notedBy: null, recommending: null, approver: null });
    setRequiresOperatorLineLeader(unitToEdit?.requiresOperatorLineLeader ?? false);
    setSickLeaveLineLeaderId(unitToEdit?.sickLeaveLineLeaderId ? String(unitToEdit.sickLeaveLineLeaderId) : '');

    setError('');
  }, [unitToEdit, isOpen, defaultCategoryId, categories, employees]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Department name is required.');
      return;
    }
    if (!categoryId) {
      setError('Please select an Approval Category for this department.');
      return;
    }
    if (useSecondApproverOverride && !secondApproverOverrideId) {
      setError('Please select a department Approver or use the category default.');
      return;
    }
    const normalizedName = name.trim().toLocaleLowerCase();
    const duplicate = categories
      .flatMap(category => category.departments.map(department => ({ department, category })))
      .find(({ department }) => department.id !== unitToEdit?.id && department.name.trim().toLocaleLowerCase() === normalizedName);
    if (duplicate) {
      setError(`A department named '${name.trim()}' already exists under '${duplicate.category.name}'. Move or edit the existing department instead of creating a duplicate.`);
      return;
    }

    try {
      setSaving(true);
      setError('');
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        categoryId: categoryId ? Number(categoryId) : null,
        firstApproverId: firstApproverIds[0] ?? null,
        firstApproverIds,
        notedByApproverIds,
        backupApprovers,
        requiresOperatorLineLeader,
        sickLeaveLineLeaderId: sickLeaveLineLeaderId ? Number(sickLeaveLineLeaderId) : null,
        secondApproverOverrideId: useSecondApproverOverride && secondApproverOverrideId ? Number(secondApproverOverrideId) : null,
        isActive
      });
      onClose();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to save department.'));
    } finally {
      setSaving(false);
    }
  };

  const selectedCategory = categories.find(c => String(c.id) === categoryId);

  return (
    <DialogOverlay onClose={onClose} label={unitToEdit ? 'Edit department' : 'Create department'} initialFocusRef={focusBackups ? backupSelectRef : undefined} closeOnBackdrop>
      <div className="modal-content glass-card w-full max-w-lg p-6 rounded-2xl shadow-xl space-y-5 border border-border bg-surface">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Building2 size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-text-primary">
                {unitToEdit ? 'Edit Department / Team' : 'Create Department / Team'}
              </h3>
              <p className="text-xs text-muted">Configure department approval settings</p>
            </div>
          </div>
          <button className="p-1 text-muted hover:text-text-primary rounded-lg" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="alert alert-danger p-3 text-xs rounded-xl">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Department Name */}
          <div className="form-group space-y-1.5">
            <label className="form-label text-xs font-semibold text-text-primary">
              Department Name <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              className="form-input w-full text-xs px-3.5 py-2 rounded-lg"
              placeholder="e.g. Information Technology, Quality, Finance"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          {/* Approval Category Dropdown */}
          <div className="form-group space-y-1.5">
            <label className="form-label text-xs font-semibold text-text-primary flex items-center gap-1">
              <Layers size={14} className="text-primary" /> Approval Category <span className="text-danger">*</span>
            </label>
            <select
              className="form-select w-full text-xs px-3.5 py-2 rounded-lg"
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              required
            >
              <option value="">-- Select Category --</option>
              {categories.map(c => (
                <option key={c.id ?? 'uncat'} value={c.id ?? ''}>
                  {c.name} {c.secondApproverName ? `(Approver: ${c.secondApproverName})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Approver: category default or department-only override */}
          {selectedCategory && (
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs space-y-3">
              <div className="flex items-center gap-2 text-text-secondary">
                <ShieldCheck size={16} className="text-primary shrink-0" />
                <span className="font-semibold text-text-primary">Approver</span>
              </div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="radio" name="secondApproverSource" checked={!useSecondApproverOverride} onChange={() => setUseSecondApproverOverride(false)} />
                <span><strong>Use category default</strong><span className="block text-muted mt-0.5">{selectedCategory.secondApproverName || 'No category approver configured'}</span></span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="radio" name="secondApproverSource" checked={useSecondApproverOverride} onChange={() => setUseSecondApproverOverride(true)} />
                <span className="flex-1"><strong>Use department override</strong><span className="block text-muted mt-0.5">Changes only this department; the category remains unchanged.</span></span>
              </label>
              {useSecondApproverOverride && (
                <select className="form-select w-full text-xs px-3.5 py-2 rounded-lg" value={secondApproverOverrideId} onChange={e => setSecondApproverOverrideId(e.target.value)}>
                  <option value="">-- Select department Approver --</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.fullName} • {e.position || 'Staff'} ({e.department || 'No Dept'})</option>)}
                </select>
              )}
            </div>
          )}

          {/* Optional Recommending role */}
          <fieldset className="space-y-3 border border-border rounded-lg p-3">
            <legend className="font-bold text-sm">Line leader routing</legend>
            <label className="flex items-center gap-2"><input type="checkbox" checked={requiresOperatorLineLeader} disabled={saving} onChange={event => setRequiresOperatorLineLeader(event.target.checked)} /> Require Operator to choose a department line leader for normal leave</label>
            <label className="form-label" htmlFor="sl-line-leader">SL designated line leader (operators only)</label>
            <select id="sl-line-leader" className="form-select" value={sickLeaveLineLeaderId} disabled={saving} onChange={event => setSickLeaveLineLeaderId(event.target.value)}>
              <option value="">Not configured — Operator SL submissions will be blocked</option>
              {employees.map(employee => <option key={employee.id} value={employee.id}>{employee.fullName} ({employee.employeeID})</option>)}
            </select>
            <p className="text-xs text-muted">Operator SL follows HR assessment, this designated leader, Recommending, and Approver. Other employees skip the line leader stage. Operators select their normal-leave leader from the department list below.</p>
          </fieldset>
          <ApproverMembersSelect label="Department line leaders / Noted by" optional={!requiresOperatorLineLeader} helpText={requiresOperatorLineLeader ? "Operators choose one of these leaders when filing normal leave. Only the chosen leader receives the Noted by stage. An empty list blocks normal Operator leave." : undefined} employees={employees} value={notedByApproverIds} onChange={setNotedByApproverIds} />
          <ApproverMembersSelect label="Recommending" employees={employees} value={firstApproverIds} onChange={setFirstApproverIds} />
          <p className="text-xs text-muted">SL: HR Review → SL line leader (operators only) → Recommending → Approver. Other leave types skip HR Review. Changes apply to new requests.</p>

          <fieldset className="space-y-3 border border-border rounded-xl p-3">
            <legend className="font-bold text-sm">Backup approvers during leave</legend>
            <p className="text-xs text-muted">Record an approver’s leave dates in Delegation Management to activate these backups. Each backup reviews the request manually; stages are never automatically approved.</p>
            {([
              ['notedBy', 'Noted by / Line leader backup'],
              ['recommending', 'Recommending backup'],
              ['approver', 'Approver / 2nd approver backup'],
            ] as const).map(([key, label]) => <div key={key} className="form-group">
              <label htmlFor={`backup-${key}`} className="form-label">{label}</label>
              <select ref={key === 'notedBy' ? backupSelectRef : undefined} id={`backup-${key}`} className="form-select w-full" disabled={saving} value={backupApprovers[key] ?? ''}
                onChange={event => setBackupApprovers(current => ({ ...current, [key]: event.target.value ? Number(event.target.value) : null }))}>
                <option value="">No backup configured</option>
                {employees.map(employee => <option key={employee.id} value={employee.id}>{employee.fullName} · {employee.position || 'Staff'} ({employee.employeeID})</option>)}
              </select>
            </div>)}
            <p className="text-xs text-muted">For Operators, the Noted by backup covers the chosen line leader. It also covers the designated Sick Leave line leader. An unavailable or self-approving backup leaves the request pending.</p>
          </fieldset>

          {/* Description */}
          <div className="form-group space-y-1.5">
            <label className="form-label text-xs font-semibold text-text-primary">
              Description (Optional)
            </label>
            <textarea
              className="form-textarea w-full text-xs px-3.5 py-2 rounded-lg"
              rows={2}
              placeholder="Department purpose and scope..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="deptActiveToggle"
              checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
              className="rounded text-primary focus:ring-primary h-4 w-4"
            />
            <label htmlFor="deptActiveToggle" className="text-xs text-text-primary font-medium cursor-pointer">
              Active Department
            </label>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border mt-4">
            <button
              type="button"
              className="btn btn-outline btn-sm text-xs px-4"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm text-xs px-5 flex items-center gap-1.5"
              disabled={saving}
            >
              <Check size={14} /> {saving ? 'Saving...' : unitToEdit ? 'Save Department' : 'Create Department'}
            </button>
          </div>
        </form>
      </div>
    </DialogOverlay>
  );
};
