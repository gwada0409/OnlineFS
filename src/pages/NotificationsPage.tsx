import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { NotificationService } from '../services/notificationService';
import { notificationCopy } from '../lib/approvalLabels';
import type { NotificationItem, NotificationPreference } from '../types/notification';
import { CheckCheck, FileText, CheckCircle, CircleAlert, XCircle, UserCheck, Sliders, CheckSquare, ArrowRight, MessageCircle } from 'lucide-react';
import { PushDeviceSettings } from '../components/PushDeviceSettings';
import { useToast } from '../components/ToastProvider';
import './NotificationsPage.css';

type InboxTab = 'all' | 'unread' | 'action' | 'leave' | 'approvals' | 'delegations' | 'preferences';
type Priority = 'action' | 'status' | 'activity';

const isComment = (item: NotificationItem) => /comment|repl(y|ied)/i.test(item.title);
const isActionRequired = (item: NotificationItem) =>
  ['ApprovalRequired', 'ApprovalDelegated', 'AttachmentRequired', 'LeaveReturned'].includes(item.type)
  || /more details requested|provide details|action required|needs your (review|approval|response)|missing attachment/i.test(item.title);
const isLeaveUpdate = (item: NotificationItem) => item.type.includes('Leave') || item.type === 'AttachmentRequired';
const priorityOf = (item: NotificationItem): Priority => isActionRequired(item) ? 'action'
  : /approved|rejected|cancelled|canceled|disapproved/i.test(item.type + ' ' + item.title) ? 'status' : 'activity';
const actionLabel = (item: NotificationItem) => isActionRequired(item)
  ? (item.type.includes('Approval') ? 'Review request' : 'Provide details')
  : isComment(item) ? 'View comment'
  : item.entityType === 'LeaveRequest' ? 'View request'
  : item.type === 'OperationFailed' ? 'View event' : 'View details';
const relativeTime = (value: string) => {
  const difference = Math.max(0, Date.now() - new Date(value).getTime());
  if (!Number.isFinite(difference)) return value;
  const minutes = Math.floor(difference / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'Yesterday' : `${days} days ago`;
};
const dateGroup = (value: string) => {
  const day = new Date(value); const now = new Date();
  if (Number.isNaN(day.getTime())) return 'Earlier';
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const itemDay = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const difference = Math.round((today.getTime() - itemDay.getTime()) / 86_400_000);
  return difference <= 0 ? 'Today' : difference === 1 ? 'Yesterday' : 'Earlier';
};

export const NotificationsPage: React.FC = () => {
  const { user, isAdmin, isEmployee, isHR, isApprover, isSystemAdmin } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultWorkspace = isAdmin ? 'System' : isHR ? 'HR' : isApprover ? 'Approvals' : 'Personal';
  const requestedWorkspace = searchParams.get('workspace');
  const focusedNotificationId = Number(searchParams.get('focus')) || null;
  const allowedWorkspaces = [...(isEmployee ? ['Personal'] : []), ...(isApprover ? ['Approvals'] : []), ...(isHR ? ['HR'] : []), ...(isAdmin ? ['System'] : [])];
  const workspace = requestedWorkspace && allowedWorkspaces.includes(requestedWorkspace) ? requestedWorkspace : defaultWorkspace;
  const setWorkspace = (value: string) => setSearchParams({ workspace: value });
  const [category, setCategory] = useState('');
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<InboxTab>('all');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState<NotificationPreference | null>(null);
  const [loadError, setLoadError] = useState('');
  const loadVersion = useRef(0);

  useEffect(() => {
    if (user?.id) {
      void loadData();
      const unsubscribe = NotificationService.subscribe(() => { void loadData(); });
      return () => { loadVersion.current++; unsubscribe(); };
    }
  }, [user?.id, activeTab, workspace, category]);

  const loadData = async () => {
    if (!user?.id) return;
    const version = ++loadVersion.current;
    setLoading(true);
    try {
      const [first, unread] = await Promise.all([
        NotificationService.getNotificationsForUser(user.id, workspace, category || undefined, 1, 30),
        NotificationService.getUnreadCount(user.id, workspace, category || undefined)
      ]);
      if (version !== loadVersion.current) return;
      setNotifications(first.items);
      setTotal(first.total);
      setUnreadTotal(unread);
      setPage(1);
      if (activeTab === 'preferences') setPreferences(await NotificationService.getPreferences(user.id));
      setLoadError('');
    } catch {
      if (version !== loadVersion.current) return;
      setLoadError('Could not load this notification workspace.');
    } finally { if (version === loadVersion.current) setLoading(false); }
  };

  const loadMore = async () => {
    if (!user?.id || loadingMore || notifications.length >= total) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const result = await NotificationService.getNotificationsForUser(user.id, workspace, category || undefined, nextPage, 30);
      setNotifications(current => [...current, ...result.items.filter(item => !current.some(existing => existing.id === item.id))]);
      setTotal(result.total);
      setPage(nextPage);
    } catch { toast.error('Could not load more notifications.'); }
    finally { setLoadingMore(false); }
  };

  const handleMarkRead = async (id: number) => {
    try { await NotificationService.markAsRead(id); await loadData(); }
    catch { toast.error('Could not mark the notification as read.'); }
  };

  const handleMarkAllRead = async () => {
    if (!user?.id) return;
    try { await NotificationService.markAllAsRead(user.id, workspace, category || undefined); await loadData(); }
    catch { toast.error('Could not mark notifications as read.'); }
  };

  const handleActionClick = async (n: NotificationItem) => {
    try { await NotificationService.markAsRead(n.id); }
    catch { /* Opening the permitted destination remains useful when read-state sync fails. */ }
    navigate(n.actionUrl);
  };

  const handlePreferenceToggle = async (field: keyof NotificationPreference) => {
    if (!user?.id || !preferences) return;
    const updated = await NotificationService.updatePreferences(user.id, {
      [field]: !preferences[field]
    });
    setPreferences(updated);
  };

  const filteredNotifications = notifications.filter(n => {
    if (activeTab === 'unread') return !n.isRead;
    if (activeTab === 'action') return isActionRequired(n);
    if (activeTab === 'approvals') return n.type.includes('Approval');
    if (activeTab === 'leave') return isLeaveUpdate(n);
    if (activeTab === 'delegations') return n.type.includes('Delegation');
    return true;
  });
  const groups = ['Today', 'Yesterday', 'Earlier'].map(label => ({ label, items: filteredNotifications.filter(item => dateGroup(item.createdAt) === label) })).filter(group => group.items.length > 0);
  const unreadCount = unreadTotal;
  const actionCount = notifications.filter(isActionRequired).length;
  const leaveCount = notifications.filter(isLeaveUpdate).length;
  const moreAvailable = notifications.length < total;

  return (
    <div className="animate-fade-in notification-inbox">
      <div className="page-header notification-page-header">
        <div className="notification-header-main">
          <div>
            <h1>Notifications</h1>
            <p className="text-sm text-muted">{workspace === 'System' ? 'System alerts' : workspace === 'HR' ? 'HR operations' : workspace === 'Approvals' ? 'Approval alerts' : 'Your leave updates and activity'}</p>
          </div>
          <button data-tutorial="notifications-read" className="btn btn-outline btn-sm" onClick={handleMarkAllRead} disabled={loading || unreadCount === 0}>
            <CheckCheck size={15} aria-hidden="true" /> Mark all as read
          </button>
        </div>
      </div>

      {/* Tabs Navigation Row */}
      <div className="notification-workspaces" aria-label="Notification workspace">
        {allowedWorkspaces.length > 1 && [...(isEmployee ? [{ value: 'Personal', label: 'Personal' }] : []), ...(isApprover ? [{ value: 'Approvals', label: 'Approvals' }] : []), ...(isHR ? [{ value: 'HR', label: 'HR Operations' }] : []), ...(isAdmin ? [{ value: 'System', label: 'System' }] : [])].map(item => <button key={item.value} className={`btn btn-sm ${workspace === item.value ? 'btn-primary' : 'btn-outline'}`} onClick={() => { setWorkspace(item.value); setCategory(''); setNotifications([]); setActiveTab('all'); }}>{item.label}</button>)}
        {workspace === 'System' && <select className="form-select" aria-label="System alert category" value={category} onChange={event => { setCategory(event.target.value); setNotifications([]); }}><option value="">All system alerts</option><option value="Integration">Integrations</option>{isSystemAdmin && <option value="Security">Security</option>}<option value="Configuration">Configuration</option><option value="Announcement">Announcements</option></select>}
      </div>
      <div className="notification-toolbar">
        <div className="notification-filters" aria-label="Filter notifications">
          <button className={`notification-filter ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>All <span>{total}</span></button>
          <button className={`notification-filter ${activeTab === 'unread' ? 'active' : ''}`} onClick={() => setActiveTab('unread')}>Unread <span>{unreadCount}</span></button>
          <button className={`notification-filter ${activeTab === 'action' ? 'active' : ''}`} onClick={() => setActiveTab('action')}>Action required <span aria-label={moreAvailable ? `At least ${actionCount}` : undefined}>{actionCount}{moreAvailable ? '+' : ''}</span></button>
          {workspace === 'Personal' && <button className={`notification-filter ${activeTab === 'leave' ? 'active' : ''}`} onClick={() => setActiveTab('leave')}>Leave updates <span aria-label={moreAvailable ? `At least ${leaveCount}` : undefined}>{leaveCount}{moreAvailable ? '+' : ''}</span></button>}
          {workspace === 'Approvals' && <button className={`notification-filter ${activeTab === 'approvals' ? 'active' : ''}`} onClick={() => setActiveTab('approvals')}>Approvals <span>{notifications.filter(item => item.type.includes('Approval')).length}{moreAvailable ? '+' : ''}</span></button>}
          {workspace === 'Approvals' && <button className={`notification-filter ${activeTab === 'delegations' ? 'active' : ''}`} onClick={() => setActiveTab('delegations')}>Delegations <span>{notifications.filter(item => item.type.includes('Delegation')).length}{moreAvailable ? '+' : ''}</span></button>}
        </div>
        <button className={`notification-preferences ${activeTab === 'preferences' ? 'active' : ''}`} onClick={() => setActiveTab('preferences')}><Sliders size={16} aria-hidden="true"/> Preferences</button>
      </div>

      {/* Main Body */}
      {loadError && <div className="alert alert-danger" role="alert">{loadError} <button className="btn btn-sm btn-outline ml-3" onClick={() => void loadData()}>Retry</button></div>}
      {activeTab !== 'preferences' ? (
        <div className="notification-groups" aria-live="polite">
          {loading && !loadError && <div className="notification-empty">Loading notifications…</div>}
          {!loading && groups.map(group => <section key={group.label} className="notification-group" aria-label={group.label}>
            <h2 className="notification-group-heading">{group.label}</h2>
            <div className="notification-list">{group.items.map(n => {
              const priority = priorityOf(n);
              const comment = isComment(n);
              const actionable = n.type !== 'OperationFailed' && Boolean(n.actionUrl);
              const title = comment ? 'New comment' : notificationCopy(n.title);
              const message = notificationCopy(n.message);
              const rejected = n.severity === 'Critical' || /reject|disapprov/i.test(n.type + ' ' + n.title);
              const fullDate = new Date(n.createdAt).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' });
              const Icon = comment ? MessageCircle : priority === 'action' ? CircleAlert : rejected ? XCircle : priority === 'status' || n.severity === 'Success' ? CheckCircle : n.type.includes('Approval') ? CheckSquare : n.type.includes('Delegation') ? UserCheck : FileText;
              return <article
                key={n.id}
                className={`notification-row priority-${priority} ${rejected ? 'is-negative' : ''} ${actionable ? 'is-actionable' : ''} ${n.isRead ? 'is-read' : 'is-unread'} ${focusedNotificationId === n.id ? 'is-focused' : ''}`}
                role={actionable ? 'link' : undefined}
                tabIndex={actionable ? 0 : undefined}
                aria-label={`${n.isRead ? 'Read' : 'Unread'} notification: ${title}`}
                onClick={event => { if (actionable && !(event.target as HTMLElement).closest('button')) void handleActionClick(n); }}
                onKeyDown={event => { if (actionable && event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); void handleActionClick(n); } }}
              >
                <span className="notification-unread-indicator" aria-hidden="true" />
                <span className="notification-type-icon" aria-hidden="true"><Icon size={18}/></span>
                <div className="notification-row-main">
                  <h3 className="notification-row-title">{title}</h3>
                  {priority === 'action' && <span className="notification-priority-label">Action required</span>}
                  <p className={`notification-row-message ${comment ? 'is-comment' : ''}`} title={message}>{comment ? `“${message}”` : message}</p>
                  {n.type === 'OperationFailed' && <p className="notification-row-context">Event reference: <code>{n.entityId}</code></p>}
                  {n.entityType === 'LeaveRequest' && <span className="notification-row-context">{comment ? 'Leave request conversation' : 'Leave request update'}</span>}
                </div>
                <time className="notification-time" dateTime={n.createdAt} title={fullDate}>{relativeTime(n.createdAt)}</time>
                <div className="notification-row-actions">
                  {!n.isRead && <button type="button" className="notification-mark-read" onClick={() => void handleMarkRead(n.id)} aria-label={`Mark ${title} as read`}>Mark read</button>}
                  {actionable && <button type="button" className="notification-action" onClick={() => void handleActionClick(n)}>{actionLabel(n)} <ArrowRight size={14} aria-hidden="true"/></button>}
                </div>
              </article>;
            })}</div>
          </section>)}
          {!loading && filteredNotifications.length === 0 && !moreAvailable && <div className="notification-empty">
            <CheckCheck size={27} aria-hidden="true" />
            <h2>{activeTab === 'unread' ? "You're all caught up" : activeTab === 'all' ? 'No notifications yet' : 'Nothing in this view'}</h2>
            <p>{activeTab === 'unread' ? 'You have no unread notifications.' : activeTab === 'all' ? 'Updates about your requests and approvals will appear here.' : 'There are no notifications matching this filter.'}</p>
          </div>}
          {!loading && moreAvailable && <div className="notification-load-more">
            <span className="text-xs text-muted">Showing {notifications.length} of {total} notifications. Filter counts with + include more items to load.</span>
            <button type="button" className="btn btn-outline btn-sm" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? 'Loading…' : 'Load more'}</button>
          </div>}
        </div>
      ) : (
        /* Preferences Section */
        <div className="glass-card max-w-2xl">
          <div className="glass-card-header border-b border-border p-4">
            <h3 className="font-bold text-lg flex items-center gap-2"><Sliders size={18} className="text-primary" /> Delivery & Channel Preferences</h3>
          </div>
          <div className="glass-card-body p-6 space-y-6">
            <div>
              <h4 className="font-bold text-sm mb-3 text-text uppercase tracking-wider">Delivery Channels</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-base/40 rounded-lg border border-border">
                  <div>
                    <div className="font-bold text-sm">In-App Notifications</div>
                    <div className="text-xs text-muted">Receive real-time alerts inside the application.</div>
                  </div>
                  <span className="badge badge-success">Mandatory</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-base/40 rounded-lg border border-border">
                  <div>
                    <div className="font-bold text-sm">Email Delivery</div>
                    <div className="text-xs text-muted">Email preference for notifications you are authorized to receive. Delivery depends on the configured email service.</div>
                  </div>
                  <input
                    type="checkbox"
                    className="form-checkbox h-5 w-5"
                    checked={preferences?.emailEnabled || false}
                    onChange={() => handlePreferenceToggle('emailEnabled')}
                  />
                </div>

                <PushDeviceSettings />
              </div>
            </div>

            {isEmployee && <div>
              <h4 className="font-bold text-sm mb-3 text-text uppercase tracking-wider">Event Categories</h4>
              <div className="space-y-3">
                {isApprover && <div className="flex items-center justify-between p-3 bg-base/40 rounded-lg border border-border">
                  <div>
                    <div className="font-bold text-sm">Approval Required Alerts</div>
                    <div className="text-xs text-muted">Notify me when a leave request requires my review.</div>
                  </div>
                  <input
                    type="checkbox"
                    className="form-checkbox h-5 w-5"
                    checked={preferences?.approvalRequiredEnabled || false}
                    onChange={() => handlePreferenceToggle('approvalRequiredEnabled')}
                  />
                </div>}

                <div className="flex items-center justify-between p-3 bg-base/40 rounded-lg border border-border">
                  <div>
                    <div className="font-bold text-sm">Final Decision Notifications</div>
                    <div className="text-xs text-muted">Notify me when my leave requests are approved or rejected.</div>
                  </div>
                  <span className="badge badge-success">Mandatory</span>
                </div>
              </div>
            </div>}
          </div>
        </div>
      )}
    </div>
  );
};

