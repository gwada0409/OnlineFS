import React, { useState } from 'react';
import type { ApprovalCategoryNode, HREmployee } from '../../lib/api';
import { ShieldCheck, X, Check } from 'lucide-react';
import { DialogOverlay } from '../../components/ui/DialogOverlay';

interface SetCategoryApproverModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: ApprovalCategoryNode | null;
  employees: HREmployee[];
  onSave: (categoryId: number, secondApproverId: number | null) => Promise<void>;
}

export const SetCategoryApproverModal: React.FC<SetCategoryApproverModalProps> = ({
  isOpen,
  onClose,
  category,
  employees,
  onSave
}) => {
  const [secondApproverId, setSecondApproverId] = useState<string>(
    category?.secondApproverId ? String(category.secondApproverId) : ''
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !category) return null;

  const handleSave = async () => {
    if (!category.id) return;
    try {
      setSaving(true);
      setError('');
      await onSave(category.id, secondApproverId ? Number(secondApproverId) : null);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to update Approver.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogOverlay onClose={onClose} label="Set category approver" closeOnBackdrop>
      <div className="modal-content glass-card w-full max-w-md p-6 rounded-2xl shadow-xl space-y-4 border border-border bg-surface">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-text-primary">Category Approver</h3>
              <p className="text-xs text-muted">{category.name} Group</p>
            </div>
          </div>
          <button className="p-1 text-muted hover:text-text-primary rounded-lg" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="alert alert-danger p-3 text-xs rounded-xl">{error}</div>
        )}

        <div className="space-y-3">
          <label className="text-xs font-semibold text-text-primary">
            Select Category-Level Approver
          </label>
          <select
            className="form-select w-full text-xs px-3.5 py-2 rounded-lg"
            value={secondApproverId}
            onChange={e => setSecondApproverId(e.target.value)}
          >
            <option value="">-- None (Warning: Leave filings will have no Approver) --</option>
            {employees.map(e => (
              <option key={e.id} value={e.id}>
                {e.fullName} • {e.position || 'Staff'} ({e.department || 'No Dept'})
              </option>
            ))}
          </select>

          <div className="p-3 rounded-xl bg-base/60 border border-border text-xs text-text-secondary">
            Changing this approver will automatically update the 2nd approval step for all <strong>{category.departments.length} departments</strong> under {category.name} for future leave requests.
          </div>
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
            type="button"
            className="btn btn-primary btn-sm text-xs px-5 flex items-center gap-1.5"
            onClick={handleSave}
            disabled={saving}
          >
            <Check size={14} /> {saving ? 'Saving...' : 'Save Approver'}
          </button>
        </div>
      </div>
    </DialogOverlay>
  );
};
