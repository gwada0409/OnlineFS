import React, { useMemo, useState } from 'react';
import { MessageCircle, Paperclip, Send, CalendarClock } from 'lucide-react';
import { LeaveAPI, type LeaveRequestDetail } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from './ToastProvider';
import { NotificationService } from '../services/notificationService';
import { useEffect } from 'react';

const waitingForEmployee = (status: string) => status.toLowerCase() === 'pending employee details';

export const LeaveRequestConversation: React.FC<{
  request: LeaveRequestDetail;
  onUpdated: () => void;
  onOpenAttachment?: (attachment: { id: number; fileName: string; fileSize: number }) => void;
}> = ({ request, onUpdated, onOpenAttachment }) => {
  const { user } = useAuth();
  const toast = useToast();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const owner = user?.username === request.employee.employeeID;
  const employeeOwner = request.conversationAccess?.isEmployeeOwner ?? owner;
  const canUploadAttachments = request.conversationAccess?.canUploadAttachments ?? (owner && request.status.toLowerCase().startsWith('pending'));
  const canDiscuss = request.conversationAccess?.canComment ?? owner;
  const canAskDetails = request.conversationAccess?.canRequestEmployeeDetails ?? false;
  const messages = useMemo(() => request.auditTrail.filter(item => ['Comment', 'DetailsRequested', 'EmployeeReply'].includes(item.action)), [request.auditTrail]);
  const needEmployeeReply = employeeOwner && waitingForEmployee(request.status);

  useEffect(() => NotificationService.subscribe(notification => {
    if (!notification || notification.leaveRequestId === request.id || (notification.entityType === 'LeaveRequest' && Number(notification.entityId) === request.id)) onUpdated();
  }), [request.id, onUpdated]);

  const send = async (requestDetails = false) => {
    if (!message.trim()) { toast.error('Write a message first.'); return; }
    setSending(true);
    try {
      await LeaveAPI.addConversationMessage(request.id, message.trim(), requestDetails);
      setMessage('');
      toast.success(requestDetails ? 'The employee has been asked for more details.' : needEmployeeReply ? 'Your reply was sent to the approver.' : 'Comment sent.');
      onUpdated();
    } catch (error: any) { toast.error(error.response?.data?.message || error.response?.data || 'Could not send this message.'); }
    finally { setSending(false); }
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) await LeaveAPI.uploadAttachment(request.id, file);
      toast.success('Attachment added to the leave request.');
      onUpdated();
    } catch (error: any) { toast.error(error.response?.data?.message || error.response?.data || 'Could not upload the attachment.'); }
    finally { setUploading(false); }
  };

  if (!canDiscuss || !['Leave', undefined].includes(request.requestKind)) return null;

  return <section className="mt-6 border-t border-border pt-5" aria-label="Leave request conversation">
    <div className="flex items-center gap-2 mb-3"><MessageCircle size={18} className="text-primary"/><h3>Request conversation</h3></div>
    {waitingForEmployee(request.status) && <div className="alert alert-warning mb-3" role="status">Waiting for the employee to reply. Approval actions are paused until then.</div>}
    {messages.length ? <div className="space-y-3 mb-4 max-h-80 overflow-y-auto pr-1" aria-live="polite">{[...messages].reverse().map((item, index) => <article key={`${item.timestamp}-${index}`} className="p-3 rounded-lg border border-border bg-base/40">
      <div className="flex flex-wrap justify-between gap-2 text-xs"><strong>{item.performedBy}{item.action === 'DetailsRequested' ? ' · requested details' : item.action === 'EmployeeReply' ? ' · employee reply' : ''}</strong><time className="text-muted">{new Date(item.timestamp).toLocaleString()}</time></div>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm">{item.details}</p>
    </article>)}</div> : <p className="text-sm text-muted mb-4">No messages yet. Use this conversation to clarify the request before a decision.</p>}
    {request.attachments.length > 0 && <div className="flex flex-wrap gap-2 mb-4">{request.attachments.map(file => <button type="button" key={file.id} className="btn btn-outline btn-sm" onClick={() => onOpenAttachment?.(file)}><Paperclip size={14}/>{file.fileName}</button>)}</div>}
    {canUploadAttachments && <label className="btn btn-outline btn-sm inline-flex cursor-pointer mb-3"><Paperclip size={14}/>{uploading ? 'Uploading…' : 'Add attachment'}<input className="sr-only" type="file" multiple accept=".svg,.png,.jpg,.jpeg,.pdf,.docx" disabled={uploading} onChange={event => { void upload(event.target.files); event.currentTarget.value = ''; }}/></label>}
    {canDiscuss && <div className="space-y-2">
      <label className="form-label" htmlFor={`leave-conversation-${request.id}`}>{needEmployeeReply ? 'Reply to the approver' : 'Message'}</label>
      <textarea id={`leave-conversation-${request.id}`} className="form-textarea w-full" rows={3} maxLength={2000} value={message} onChange={event => setMessage(event.target.value)} placeholder={needEmployeeReply ? 'Add the requested information…' : 'Ask a question or provide clarification…'} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted">{message.length}/2000 characters</span>
        <div className="flex flex-wrap gap-2">
          {canAskDetails && <button type="button" className="btn btn-outline btn-sm" disabled={sending || !message.trim()} onClick={() => void send(true)}><CalendarClock size={14}/>Request more details</button>}
          <button type="button" className="btn btn-primary btn-sm" disabled={sending || !message.trim()} onClick={() => void send(false)}><Send size={14}/>{sending ? 'Sending…' : needEmployeeReply ? 'Reply & return to approval' : 'Send comment'}</button>
        </div>
      </div>
    </div>}
  </section>;
};
