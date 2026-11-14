import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { NotificationService } from '../services/notificationService';
import { useToast } from './ToastProvider';
import type { NotificationItem } from '../types/notification';
import { Bell, CheckCheck, FileText, CheckCircle, XCircle, UserCheck, ShieldAlert, ArrowRight, X } from 'lucide-react';
import { DialogOverlay } from './ui/DialogOverlay';
import { useMobileViewport } from '../hooks/useMobileViewport';

export const NotificationBell: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const mobile = useMobileViewport();

  useEffect(() => {
    if (user?.id) {
      loadNotifications();
      const unsubscribe = NotificationService.subscribe(notification => {
        void loadNotifications();
        if (notification) toast.info(notification.title);
      });
      return unsubscribe;
    }
  }, [user?.id]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) && !panelRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadNotifications = async () => {
    if (!user?.id) return;
    try {
      const [items, count] = await Promise.all([
        NotificationService.getNotificationsForUser(user.id, undefined, undefined, 1, 10),
        NotificationService.getUnreadCount(user.id)
      ]);
      setNotifications(items.items);
      setUnreadCount(count);
    } catch (error) {
      console.error('Failed to load notifications', error);
    }
  };

  const handleNotificationClick = async (n: NotificationItem) => {
    await NotificationService.markAsRead(n.id);
    await loadNotifications();
    setIsOpen(false);
    navigate(n.actionUrl);
  };

  const handleMarkAllRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user?.id) return;
    await NotificationService.markAllAsRead(user.id);
    await loadNotifications();
  };

  const getNotificationIcon = (severity: NotificationItem['severity'], type: NotificationItem['type']) => {
    if (type.includes('Approval')) return <CheckSquareIcon className="text-warning" />;
    if (type.includes('Delegation')) return <UserCheck size={18} className="text-info" />;
    if (severity === 'Success') return <CheckCircle size={18} className="text-success" />;
    if (severity === 'Critical') return <XCircle size={18} className="text-danger" />;
    if (severity === 'Warning') return <ShieldAlert size={18} className="text-warning" />;
    return <FileText size={18} className="text-primary" />;
  };

  const panelContent = <>
          {/* Header */}
          <div className="notification-preview-header p-4 border-b border-border flex items-center justify-between bg-base/80">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">Notifications</span>
              {unreadCount > 0 && <span className="badge badge-primary text-xs">{unreadCount} Unread</span>}
            </div>
            {unreadCount > 0 && (
              <button 
                type="button"
                className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                onClick={handleMarkAllRead}
              >
                <CheckCheck size={14} /> Mark all as read
              </button>
            )}
          </div>

          {mobile && <div className="notification-preview-close px-4"><button type="button" className="btn btn-outline w-full" onClick={() => setIsOpen(false)}><X size={18} /> Close notifications</button></div>}

          {/* List */}
          <div className="notification-preview-list max-h-[360px] overflow-y-auto divide-y divide-border/50">
            {notifications.slice(0, 10).map(n => (
              <div
                key={n.id}
                role="button"
                tabIndex={0}
                onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); void handleNotificationClick(n); } }}
                onClick={() => handleNotificationClick(n)}
                className={`notification-preview-row p-3.5 flex items-start gap-3 cursor-pointer transition-colors hover:bg-primary/5 ${!n.isRead ? 'bg-primary/10 border-l-2 border-l-primary' : ''}`}
              >
                <div className="notification-preview-icon shrink-0 mt-0.5">
                  {getNotificationIcon(n.severity, n.type)}
                </div>
                <div className="notification-preview-main flex-1 min-w-0">
                  <div className="notification-preview-heading flex items-center justify-between gap-1 mb-0.5">
                    <span className={`notification-preview-title text-xs font-bold truncate ${!n.isRead ? 'text-text-primary' : 'text-muted'}`}>{n.title}</span>
                    <time className="notification-preview-time text-[10px] text-muted whitespace-nowrap" dateTime={n.createdAt} title={new Date(n.createdAt).toLocaleString()}>{mobile ? new Date(n.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : formatTimeAgo(n.createdAt)}</time>
                  </div>
                  <p className="notification-preview-message text-xs text-text-secondary line-clamp-2 leading-relaxed">{n.message}</p>
                </div>
              </div>
            ))}

            {notifications.length === 0 && (
              <div className="p-8 text-center text-muted">
                <Bell size={32} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">No notifications yet.</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="notification-preview-footer p-3 border-t border-border bg-base/50 text-center">
            <button
              type="button"
              className="text-xs font-bold text-primary hover:underline flex items-center justify-center gap-1 w-full"
              onClick={() => { setIsOpen(false); navigate('/notifications'); }}
            >
              View Notification Center <ArrowRight size={12} />
            </button>
          </div>
  </>;

  return (
    <div className="relative" ref={menuRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="btn-ghost relative p-2 rounded-full hover:bg-base/80 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
        title="Notifications"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={`Notifications: ${unreadCount} unread`}
        style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Bell size={20} className="text-text-secondary hover:text-text-primary" />
        {unreadCount > 0 && (
          <span 
            className="absolute -top-1 -right-1 bg-danger text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center animate-pulse shadow-md"
            style={{ position: 'absolute', top: -2, right: -2 }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (mobile ? <DialogOverlay label="Notifications" onClose={() => setIsOpen(false)} closeOnBackdrop>
        <div ref={panelRef} className="modal-content notification-sheet">{panelContent}</div>
      </DialogOverlay> : <div ref={panelRef} 
          className="absolute right-0 mt-2 w-80 sm:w-96 glass-card shadow-2xl z-50 border border-border overflow-hidden animate-slide-up"
          style={{ position: 'absolute', right: 0, top: '100%', width: '360px', zIndex: 9999, marginTop: '8px' }}
        >
          {panelContent}
        </div>
      )}
    </div>
  );
};

const CheckSquareIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={`w-4 h-4 ${className || ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="9 11 12 14 22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
