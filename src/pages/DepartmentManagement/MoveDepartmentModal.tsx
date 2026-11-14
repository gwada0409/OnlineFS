import React, { useState } from 'react';
import type { DepartmentNode, ApprovalCategoryNode } from '../../lib/api';
import { ArrowRightLeft, X, Layers, ShieldCheck, Check } from 'lucide-react';
import { DialogOverlay } from '../../components/ui/DialogOverlay';

interface MoveDepartmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  department: DepartmentNode | null;
  categories: ApprovalCategoryNode[];
  onMove: (departmentId: number, targetCategoryId: number | null) => Promise<void>;
}

export const MoveDepartmentModal: React.FC<MoveDepartmentModalProps> = ({
  isOpen,
  onClose,
  department,
  categories,
  onMove
}) => {
  const [selectedCatId, setSelectedCatId] = useState<string>(
    department?.categoryId ? String(department.categoryId) : ''
  );
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !department) return null;

  const targetCategory = categories.find(c => String(c.id) === selectedCatId);

  const handleMove = async () => {
    try {
      setMoving(true);
      setError('');
      await onMove(department.id, selectedCatId ? Number(selectedCatId) : null);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to move department.');
    } finally {
      setMoving(false);
    }
  };

  return (
    <DialogOverlay onClose={onClose} label="Move department" closeOnBackdrop>
      <div className="modal-content glass-card w-full max-w-md p-6 rounded-2xl shadow-xl space-y-4 border border-border bg-surface">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <ArrowRightLeft size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-text-primary">Move Department</h3>
              <p className="text-xs text-muted">{department.name}</p>
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
          <label className="text-xs font-semibold text-text-primary flex items-center gap-1">
            <Layers size={14} className="text-primary" /> Target Approval Category
          </label>
          <select
            className="form-select w-full text-xs px-3.5 py-2 rounded-lg"
            value={selectedCatId}
            onChange={e => setSelectedCatId(e.target.value)}
          >
            <option value="">-- Select Category --</option>
            {categories.map(c => (
              <option key={c.id ?? 'uncat'} value={c.id ?? ''}>
                {c.name} {c.secondApproverName ? `(Approver: ${c.secondApproverName})` : ''}
              </option>
            ))}
          </select>

          {targetCategory && (
            <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 space-y-1.5 text-xs">
              <div className="flex items-center gap-1.5 text-primary font-bold">
                <ShieldCheck size={14} /> New Approval Inheritance
              </div>
              <p className="text-text-secondary">
                Moving to <strong>{targetCategory.name}</strong> will update the Approver for all future leave filings to:
              </p>
              <p className="font-bold text-text-primary">
                {targetCategory.secondApproverName || 'None configured (Warning: Category has no Approver)'}
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border mt-4">
          <button
            type="button"
            className="btn btn-outline btn-sm text-xs px-4"
            onClick={onClose}
            disabled={moving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm text-xs px-5 flex items-center gap-1.5"
            onClick={handleMove}
            disabled={moving || !selectedCatId}
          >
            <Check size={14} /> {moving ? 'Moving...' : 'Confirm Move'}
          </button>
        </div>
      </div>
    </DialogOverlay>
  );
};
