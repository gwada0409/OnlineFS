import React, { useEffect, useState } from 'react';
import type { DepartmentNode, HREmployee } from '../../lib/api';
import { UserCheck, X, Check } from 'lucide-react';
import { DialogOverlay } from '../../components/ui/DialogOverlay';
import { ApproverMembersSelect } from './ApproverMembersSelect';

interface SetFirstApproverModalProps {
  isOpen: boolean;
  onClose: () => void;
  department: DepartmentNode | null;
  employees: HREmployee[];
  onSave: (departmentId: number, firstApproverIds: number[]) => Promise<void>;
}

export const SetFirstApproverModal: React.FC<SetFirstApproverModalProps> = ({
  isOpen,
  onClose,
  department,
  employees,
  onSave
}) => {
  const [firstApproverIds, setFirstApproverIds] = useState<number[]>([]);
  useEffect(() => {
    setFirstApproverIds(department?.firstApproverIds ?? (department?.firstApproverId ? [department.firstApproverId] : []));
  }, [department, isOpen]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !department) return null;

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      await onSave(department.id, firstApproverIds);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to update Recommending role.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogOverlay onClose={onClose} label="Set Recommending role" closeOnBackdrop>
      <div className="modal-content glass-card w-full max-w-md p-6 rounded-2xl shadow-xl space-y-4 border border-border bg-surface">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-info/10 text-info flex items-center justify-center font-bold">
              <UserCheck size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-text-primary">Department Recommending</h3>
              <p className="text-xs text-muted">{department.name} (Optional)</p>
            </div>
          </div>
          <button className="p-1 text-muted hover:text-text-primary rounded-lg" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="alert alert-danger p-3 text-xs rounded-xl">{error}</div>
        )}

        <ApproverMembersSelect label="Recommending" employees={employees} value={firstApproverIds} onChange={setFirstApproverIds} />

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
            <Check size={14} /> {saving ? 'Saving...' : 'Save Recommending'}
          </button>
        </div>
      </div>
    </DialogOverlay>
  );
};
