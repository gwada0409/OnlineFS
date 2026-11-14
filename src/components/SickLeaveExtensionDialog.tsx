import { useRef, useState } from 'react';
import { ApprovalAPI, getApiErrorMessage, type PendingApproval } from '../lib/api';
import { DialogOverlay } from './ui/DialogOverlay';
import { useToast } from './ToastProvider';

export function SickLeaveExtensionDialog({ request, onClose, onExtended }: {
  request: PendingApproval;
  onClose: () => void;
  onExtended: () => Promise<void>;
}) {
  const [dateTo, setDateTo] = useState('');
  const [reason, setReason] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const dateRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  return <DialogOverlay label="Extend Sick Leave during HR review" onClose={onClose} closeOnEscape={!saving} closeOnBackdrop={!saving} initialFocusRef={dateRef}>
    <section data-dialog-content className="modal-content glass-card p-6 space-y-4">
      <h2 className="text-lg font-bold">Extend Sick Leave — HR assessment</h2>
      <p>{request.employeeName} · {request.department}</p>
      <p className="text-sm text-muted">Current dates: {new Date(request.dateFrom).toLocaleDateString()} – {new Date(request.dateTo).toLocaleDateString()} ({request.totalDays} working days). Saving extends this request; it does not complete HR review.</p>
      {error && <div role="alert" className="alert alert-danger">{error}</div>}
      <form className="space-y-4" onSubmit={async event => {
        event.preventDefault();
        if (saving) return;
        setSaving(true); setError('');
        try {
          const result = await ApprovalAPI.extendSickLeave(request.leaveRequestId, { expectedDateTo: request.dateTo, dateTo, reason }, files);
          if (result.notificationsQueued === false) toast.warning('The extension was saved, but notifications could not be queued. Inform the employee and HR reviewers.');
          await onExtended();
          onClose();
        } catch (failure) { setError(getApiErrorMessage(failure, 'Could not extend Sick Leave.')); }
        finally { setSaving(false); }
      }}>
        <div className="form-group">
          <label htmlFor="sl-extension-date" className="form-label">New end date *</label>
          <input ref={dateRef} id="sl-extension-date" className="form-input" type="date" min={request.dateTo.slice(0, 10)} max={`${request.dateFrom.slice(0, 4)}-12-31`} required value={dateTo} onChange={event => setDateTo(event.target.value)} disabled={saving} />
        </div>
        <div className="form-group">
          <label htmlFor="sl-extension-reason" className="form-label">Assessment / reason for additional rest *</label>
          <textarea id="sl-extension-reason" className="form-textarea" required maxLength={500} rows={3} value={reason} onChange={event => setReason(event.target.value)} disabled={saving} />
        </div>
        <div className="form-group">
          <label htmlFor="sl-extension-files" className="form-label">Medical certificate / supporting documents</label>
          <input id="sl-extension-files" className="form-input" type="file" multiple accept=".svg,.png,.jpg,.jpeg,.pdf,.docx" onChange={event => setFiles(Array.from(event.target.files ?? []))} disabled={saving} />
          <p className="text-xs text-muted">Existing attachments are retained. Add a certificate if the extended dates require one. Maximum 5 files in total, 10 MB each.</p>
        </div>
        <p className="text-xs text-muted">The system checks working days, policy, overlapping leave, and available SL balance. The employee and HR reviewers will receive the updated dates.</p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Confirm extension'}</button>
        </div>
      </form>
    </section>
  </DialogOverlay>;
}
