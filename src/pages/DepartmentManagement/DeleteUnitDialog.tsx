import React, { useState } from 'react';
import { X, AlertTriangle, Trash2, Users, Network } from 'lucide-react';
import type { DepartmentNode } from '../../lib/api';
import { DialogOverlay } from '../../components/ui/DialogOverlay';

interface DeleteUnitDialogProps {
  isOpen: boolean;
  onClose: () => void;
  unit: DepartmentNode | null;
  onConfirmDelete: (unitId: number) => Promise<void>;
  onOpenManageEmployees?: () => void;
}

export const DeleteUnitDialog: React.FC<DeleteUnitDialogProps> = ({
  isOpen,
  onClose,
  unit,
  onConfirmDelete,
  onOpenManageEmployees
}) => {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !unit) return null;

  const childCount = unit.children?.length || 0;
  const employeeCount = unit.employees?.length || 0;
  const isBlocked = childCount > 0 || employeeCount > 0;

  const handleDelete = async () => {
    if (isBlocked) return;
    setDeleting(true);
    setError(null);
    try {
      await onConfirmDelete(unit.id);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete organizational unit');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <DialogOverlay onClose={onClose} label="Delete department" description="This action permanently deletes the department." style={{ zIndex: 1000 }}>
      <div className="modal-content animate-slide-up max-w-md w-full p-6">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                Delete {unit.name}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Organizational Unit Removal Safety Check
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
          <div className="mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
            {error}
          </div>
        )}

        <div className="mt-4 space-y-3.5 text-xs">
          {isBlocked ? (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive space-y-2.5">
              <div className="font-semibold flex items-center gap-2 text-xs">
                <AlertTriangle size={15} /> This unit cannot be deleted right now
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                To protect system data integrity and existing leave routing, units with active members or child sub-units cannot be removed.
              </p>
              <div className="space-y-1.5 pt-1 text-[11px]">
                {childCount > 0 && (
                  <div className="flex items-center gap-2 text-foreground font-medium">
                    <Network size={14} className="text-primary" /> Contains {childCount} sub-department(s).
                  </div>
                )}
                {employeeCount > 0 && (
                  <div className="flex items-center gap-2 text-foreground font-medium">
                    <Users size={14} className="text-primary" /> Contains {employeeCount} assigned employee(s).
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground leading-relaxed">
              Are you sure you want to delete <strong>{unit.name}</strong>? This action cannot be undone. Any configured approver rules on this unit will be removed.
            </p>
          )}

          <div className="p-3.5 bg-muted/40 rounded-lg border border-border space-y-2">
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Assigned Employees:</span>
              <span className="font-semibold text-foreground">{employeeCount}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Recommending:</span>
              <span className="font-semibold text-foreground">{unit.firstApproverName || 'None'}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Child Sub-Units:</span>
              <span className="font-semibold text-foreground">{childCount}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-border mt-6">
          {employeeCount > 0 && onOpenManageEmployees ? (
            <button
              type="button"
              className="text-xs text-primary hover:underline flex items-center gap-1.5 font-medium"
              onClick={() => {
                onClose();
                onOpenManageEmployees();
              }}
            >
              <Users size={14} /> Reassign Employees
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              className="btn btn-outline text-xs py-2 px-3.5"
              onClick={onClose}
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger text-xs py-2 px-4 flex items-center gap-1.5"
              onClick={handleDelete}
              disabled={deleting || isBlocked}
            >
              <Trash2 size={14} />
              {deleting ? 'Deleting...' : 'Delete Unit'}
            </button>
          </div>
        </div>
      </div>
    </DialogOverlay>
  );
};
