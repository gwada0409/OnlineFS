import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertTriangle, Trash2, Info } from 'lucide-react';
import { DialogOverlay } from './ui/DialogOverlay';

// ── Types ───────────────────────────────────────────────────────
interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'danger';
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

// ── Hook ────────────────────────────────────────────────────────
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}

// ── Provider ────────────────────────────────────────────────────
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      setState({ options, resolve });
    });
  }, []);

  const handleConfirm = () => {
    state?.resolve(true);
    setState(null);
  };

  const handleCancel = () => {
    state?.resolve(false);
    setState(null);
  };

  const isDanger = state?.options.variant === 'danger';

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <DialogOverlay onClose={handleCancel} label={state.options.title || (isDanger ? 'Confirm destructive action' : 'Confirm action')} description={state.options.message} style={{ zIndex: 2000 }}>
          <div className="confirm-dialog animate-slide-up">
            <div className="confirm-dialog-icon-wrap">
              <div className={`confirm-dialog-icon ${isDanger ? 'confirm-danger' : 'confirm-info'}`}>
                {isDanger ? <AlertTriangle size={28} /> : <Info size={28} />}
              </div>
            </div>
            <h3 className="confirm-dialog-title">
              {state.options.title || (isDanger ? 'Are you sure?' : 'Confirm Action')}
            </h3>
            <p className="confirm-dialog-message">{state.options.message}</p>
            <div className="confirm-dialog-actions">
              <button className="btn btn-outline" onClick={handleCancel}>
                {state.options.cancelText || 'Cancel'}
              </button>
              <button
                className={`btn ${isDanger ? 'btn-danger' : 'btn-primary'}`}
                onClick={handleConfirm}
              >
                {isDanger
                  ? <><Trash2 size={14} /> {state.options.confirmText || 'Delete'}</>
                  : state.options.confirmText || 'Confirm'
                }
              </button>
            </div>
          </div>
        </DialogOverlay>
      )}
    </ConfirmContext.Provider>
  );
}
