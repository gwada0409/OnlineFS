import { HubConnectionBuilder, HubConnectionState, LogLevel, type HubConnection } from '@microsoft/signalr';
import api from '../lib/api';
import type { NotificationItem, NotificationPreference } from '../types/notification';

type NotificationSubscriber = (notification?: NotificationItem) => void;
const subscribers = new Set<NotificationSubscriber>();
const organizationSubscribers = new Set<() => void>();
let connection: HubConnection | null = null;
let starting: Promise<void> | null = null;
const delivered = new Set<number>();
let fallbackTimer: number | null = null;
let fallbackAttempts = 0;
let refreshTimer: number | null = null;

const notifySubscribers = (notification?: NotificationItem) => subscribers.forEach(callback => callback(notification));
const scheduleRefresh = () => {
  if (refreshTimer !== null) return;
  refreshTimer = window.setTimeout(() => { refreshTimer = null; notifySubscribers(); }, 100);
};
const stopFallback = () => { if (fallbackTimer !== null) window.clearInterval(fallbackTimer); fallbackTimer = null; fallbackAttempts = 0; };
const startFallback = () => {
  if (fallbackTimer !== null || fallbackAttempts >= 20) return;
  fallbackTimer = window.setInterval(() => {
    fallbackAttempts++;
    notifySubscribers();
    if (fallbackAttempts >= 20) stopFallback();
  }, 15000);
};

const startConnection = async () => {
  if (!sessionStorage.getItem('token')) return;
  if (!connection) {
    connection = new HubConnectionBuilder()
      .withUrl('/hubs/notifications', { accessTokenFactory: () => sessionStorage.getItem('token') || '' })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(LogLevel.Warning)
      .build();
    // Legacy events trigger an authorized API refresh only. Web Push owns OS toasts.
    connection.on('NotificationCreated', scheduleRefresh);
    connection.on('ReceiveNotification', scheduleRefresh);
    connection.on('LeaveRequestUpdated', scheduleRefresh);
    connection.on('NotificationAvailable', async (event: { id: number }) => {
      if (delivered.has(event.id)) return;
      delivered.add(event.id);
      if (delivered.size > 500) delivered.delete(delivered.values().next().value!);
      const token = sessionStorage.getItem('token');
      try {
        const result = await api.get<NotificationItem>(`/notifications/${event.id}`);
        if (token === sessionStorage.getItem('token')) notifySubscribers(result.data);
      } catch { if (token === sessionStorage.getItem('token')) notifySubscribers(); }
    });
    connection.on('OrganizationChanged', () => {
      organizationSubscribers.forEach(callback => callback());
      window.dispatchEvent(new Event('onlinefs:organization-changed'));
    });
    connection.onreconnecting(() => { startFallback(); window.dispatchEvent(new CustomEvent('onlinefs:realtime-status', { detail: 'reconnecting' })); });
    connection.onreconnected(() => { stopFallback(); window.dispatchEvent(new CustomEvent('onlinefs:realtime-status', { detail: 'connected' })); notifySubscribers(); });
    connection.onclose(() => { startFallback(); window.dispatchEvent(new CustomEvent('onlinefs:realtime-status', { detail: 'disconnected' })); });
  }
  if (connection.state === HubConnectionState.Disconnected) { await connection.start(); window.dispatchEvent(new CustomEvent('onlinefs:realtime-status', { detail: 'connected' })); }
};

export const NotificationService = {
  initialize: async (): Promise<void> => {
    if (!starting) starting = startConnection().catch(error => { startFallback(); console.error('Notification connection failed', error); }).finally(() => { starting = null; });
    await starting;
  },
  disconnect: async (): Promise<void> => {
    delivered.clear();
    if (refreshTimer !== null) window.clearTimeout(refreshTimer);
    refreshTimer = null;
    stopFallback();
    if (connection && connection.state !== HubConnectionState.Disconnected) await connection.stop();
    connection = null;
  },
  subscribe: (callback: NotificationSubscriber): (() => void) => {
    subscribers.add(callback);
    void NotificationService.initialize();
    return () => { subscribers.delete(callback); };
  },
  subscribeOrganizationChanges: (callback: () => void): (() => void) => {
    organizationSubscribers.add(callback);
    void NotificationService.initialize();
    return () => { organizationSubscribers.delete(callback); };
  },
  getNotificationsForUser: async (_recipientId?: number, workspace?: string, category?: string, page = 1, pageSize = 30): Promise<{ items: NotificationItem[]; total: number; page: number; pageSize: number }> =>
    api.get<{ items: NotificationItem[]; total: number; page: number; pageSize: number }>('/notifications', { params: { page, pageSize, workspace, category } }).then(r => r.data),
  getUnreadCount: async (_recipientId?: number, workspace?: string, category?: string): Promise<number> =>
    api.get<{ count: number }>('/notifications/unread-count', { params: { workspace, category } }).then(r => r.data.count),
  markAsRead: async (notificationId: number): Promise<void> => {
    await api.put(`/notifications/${notificationId}/read`);
    notifySubscribers();
  },
  markAllAsRead: async (_recipientId?: number, workspace?: string, category?: string): Promise<void> => {
    await api.put('/notifications/read-all', null, { params: { workspace, category } });
    notifySubscribers();
  },
  getPreferences: async (_employeeId?: number): Promise<NotificationPreference> =>
    api.get<NotificationPreference>('/notifications/preferences').then(r => r.data),
  updatePreferences: async (_employeeId: number | undefined, update: Partial<NotificationPreference>): Promise<NotificationPreference> =>
    api.put<NotificationPreference>('/notifications/preferences', update).then(r => r.data)
};
