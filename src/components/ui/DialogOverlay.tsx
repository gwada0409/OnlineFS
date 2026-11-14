import React, { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

const focusableSelector = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])', 'select:not([disabled])',
  'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])'
].join(',');

interface DialogOverlayProps {
  children: ReactNode;
  onClose: () => void;
  label: string;
  description?: string;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  className?: string;
  style?: React.CSSProperties;
  navigationFocusSelector?: string;
}

export const DialogOverlay: React.FC<DialogOverlayProps> = ({
  children, onClose, label, description, closeOnBackdrop = false, closeOnEscape = true,
  showCloseButton = false, initialFocusRef, className = '', style, navigationFocusSelector
}) => {
  const dialogRef = useRef<HTMLElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const closeOnEscapeRef = useRef(closeOnEscape);
  const initialFocusRefRef = useRef(initialFocusRef);
  const descriptionId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
    closeOnEscapeRef.current = closeOnEscape;
    initialFocusRefRef.current = initialFocusRef;
  }, [closeOnEscape, initialFocusRef, onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.setAttribute('aria-label', label);
    if (description) dialog?.setAttribute('aria-describedby', descriptionId);
    else dialog?.removeAttribute('aria-describedby');
  }, [description, descriptionId, label]);

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const dialog = overlayRef.current?.querySelector<HTMLElement>('.modal-content, .confirm-dialog, [data-dialog-content]') ?? null;
    dialogRef.current = dialog;
    dialog?.setAttribute('role', 'dialog');
    dialog?.setAttribute('aria-modal', navigationFocusSelector ? 'false' : 'true');
    dialog?.setAttribute('aria-label', label);
    if (description) dialog?.setAttribute('aria-describedby', descriptionId);
    dialog?.setAttribute('tabindex', '-1');
    const focusTarget = initialFocusRefRef.current?.current ?? dialog?.querySelector<HTMLElement>(focusableSelector) ?? dialog;
    requestAnimationFrame(() => focusTarget?.focus());

    const onKeyDown = (event: KeyboardEvent) => {
      // Only the topmost dialog handles Escape and keyboard focus when stacked.
      const overlays = document.querySelectorAll('.modal-overlay');
      if (overlays[overlays.length - 1] !== overlayRef.current) return;
      if (event.key === 'Escape' && closeOnEscapeRef.current) { event.preventDefault(); onCloseRef.current(); return; }
      if (event.key !== 'Tab' || !dialog) return;
      const items = [
        ...(navigationFocusSelector ? Array.from(document.querySelectorAll<HTMLElement>(navigationFocusSelector)) : []),
        ...Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector))
      ].filter(el => {
        const sidebar = el.closest('.sidebar');
        return el.offsetParent !== null && !el.closest('[inert]') &&
          !(sidebar && window.innerWidth <= 1024 && !sidebar.classList.contains('open'));
      });
      if (items.length === 0) { event.preventDefault(); dialog.focus(); return; }
      if (navigationFocusSelector) {
        event.preventDefault();
        const current = items.indexOf(document.activeElement as HTMLElement);
        const next = current < 0 ? (event.shiftKey ? items.length - 1 : 0)
          : (current + (event.shiftKey ? -1 : 1) + items.length) % items.length;
        items[next].focus();
        return;
      }
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [descriptionId, navigationFocusSelector]);

  return createPortal(
    <div ref={overlayRef} className={`modal-overlay ${className}`} style={style} onMouseDown={event => {
      if (closeOnBackdrop && event.target === event.currentTarget) onClose();
    }}>
      {description ? <span id={descriptionId} className="sr-only">{description}</span> : null}
      {children}
      {showCloseButton ? <button type="button" className="modal-close" aria-label="Close dialog" onClick={onClose}><X size={18} /></button> : null}
    </div>, document.body
  );
};
