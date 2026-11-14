import React, { useState, useEffect } from 'react';
import type { ApprovalCategoryNode, HREmployee } from '../../lib/api';
import { Layers, X, ShieldCheck, Check } from 'lucide-react';
import { DialogOverlay } from '../../components/ui/DialogOverlay';

interface AddEditCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; description?: string; secondApproverId?: number | null; isActive?: boolean }) => Promise<void>;
  categoryToEdit?: ApprovalCategoryNode | null;
  employees: HREmployee[];
}

export const AddEditCategoryModal: React.FC<AddEditCategoryModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  categoryToEdit,
  employees
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [secondApproverId, setSecondApproverId] = useState<string>('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (categoryToEdit) {
      setName(categoryToEdit.name);
      setDescription(categoryToEdit.description || '');
      setSecondApproverId(categoryToEdit.secondApproverId ? String(categoryToEdit.secondApproverId) : '');
      setIsActive(categoryToEdit.isActive);
    } else {
      setName('');
      setDescription('');
      setSecondApproverId('');
      setIsActive(true);
    }
    setError('');
  }, [categoryToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Category name is required.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        secondApproverId: secondApproverId ? Number(secondApproverId) : null,
        isActive
      });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to save category.');
    } finally {
      setSaving(false);
    }
  };

  const selectedApprover = employees.find(e => String(e.id) === secondApproverId);

  return (
    <DialogOverlay onClose={onClose} label={categoryToEdit ? 'Edit approval category' : 'Create approval category'} closeOnBackdrop>
      <div className="modal-content glass-card w-full max-w-lg p-6 rounded-2xl shadow-xl space-y-5 border border-border bg-surface">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Layers size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-text-primary">
                {categoryToEdit ? 'Edit Approval Category' : 'Create Approval Category'}
              </h3>
              <p className="text-xs text-muted">Approval groups share a common Approver</p>
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
          <div className="form-group space-y-1.5">
            <label className="form-label text-xs font-semibold text-text-primary">
              Category Name <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              className="form-input w-full text-xs px-3.5 py-2 rounded-lg"
              placeholder="e.g. ADMIN, OPERATIONS, ENGINEERING"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group space-y-1.5">
            <label className="form-label text-xs font-semibold text-text-primary">
              Description (Optional)
            </label>
            <textarea
              className="form-textarea w-full text-xs px-3.5 py-2 rounded-lg"
              rows={2}
              placeholder="Describe which departments belong in this approval category..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          {/* Common Approver Field */}
          <div className="form-group space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="form-label text-xs font-semibold text-text-primary flex items-center gap-1">
                <ShieldCheck size={14} className="text-primary" /> Common Approver
              </label>
              <span className="text-[11px] text-muted">Shared by all child departments</span>
            </div>
            <select
              className="form-select w-full text-xs px-3.5 py-2 rounded-lg"
              value={secondApproverId}
              onChange={e => setSecondApproverId(e.target.value)}
            >
              <option value="">-- Select Approver (e.g. Operations Manager, Director) --</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>
                  {e.fullName} • {e.position || 'Staff'} ({e.department || 'No Dept'})
                </option>
              ))}
            </select>
            {selectedApprover && (
              <p className="text-[11px] text-primary/80 mt-1">
                ✓ All child departments will inherit <strong>{selectedApprover.fullName}</strong> as their final approver.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="catActiveToggle"
              checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
              className="rounded text-primary focus:ring-primary h-4 w-4"
            />
            <label htmlFor="catActiveToggle" className="text-xs text-text-primary font-medium cursor-pointer">
              Active Category
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
              <Check size={14} /> {saving ? 'Saving...' : categoryToEdit ? 'Save Changes' : 'Create Category'}
            </button>
          </div>
        </form>
      </div>
    </DialogOverlay>
  );
};
