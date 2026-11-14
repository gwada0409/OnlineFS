import api, { getApiErrorMessage } from '../lib/api';

export interface PushDevice { id: number; deviceLabel: string; createdAt: string; updatedAt: string; lastSuccessfulDeliveryAt?: string; lastFailureAt?: string; isActive: boolean }

const decodeKey = (value: string) => {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const raw = atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map(character => character.charCodeAt(0)));
};

const deviceLabel = () => {
  const platform = navigator.userAgentData?.platform || navigator.platform || 'Device';
  const browser = /Edg\//.test(navigator.userAgent) ? 'Edge' : /Chrome\//.test(navigator.userAgent) ? 'Chrome' : /Safari\//.test(navigator.userAgent) ? 'Safari' : 'Browser';
  return `${browser} on ${platform}`;
};

export const PushService = {
  supported: () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window,
  permission: () => PushService.supported() ? Notification.permission : 'denied',
  devices: () => api.get<PushDevice[]>('/push/subscriptions').then(response => response.data),
  async enable(): Promise<void> {
    if (!PushService.supported()) throw new Error('Push notifications are not supported by this browser.');
    let data: { publicKey: string };
    try { ({ data } = await api.get<{ publicKey: string }>('/push/public-key')); }
    catch (error) { throw new Error(getApiErrorMessage(error, 'The server could not start notification registration.')); }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Notification permission was not granted. You can change it in your browser settings.');
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const subscription = existing ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(data.publicKey) });
    const json = subscription.toJSON();
    if (!json.keys?.p256dh || !json.keys?.auth) throw new Error('The browser did not provide valid push encryption keys. Remove the site notification permission and enable it again.');
    try { await api.post('/push/subscriptions', { endpoint: subscription.endpoint, publicKey: json.keys.p256dh, authenticationSecret: json.keys.auth, deviceLabel: deviceLabel() }); }
    catch (error) { throw new Error(getApiErrorMessage(error, 'The server could not register this device. Sign in again and retry.')); }
    await registration.showNotification('OnlineFS notifications enabled', {
      body: 'Windows notifications are ready on this device.',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: 'onlinefs-device-enabled',
      data: { url: '/notifications' }
    });
  },
  async testNotification(): Promise<void> {
    if (!PushService.supported()) throw new Error('Windows notifications are not supported on this device.');
    if (Notification.permission !== 'granted') throw new Error('Allow notifications for OnlineFS before sending a test.');
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification('OnlineFS test notification', {
      body: 'Windows 11 notifications are connected successfully.',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: `onlinefs-windows-test-${Date.now()}`,
      data: { url: '/notifications' }
    });
  },
  async disable(id: number): Promise<void> {
    await api.delete(`/push/subscriptions/${id}`);
    const subscription = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
    if (subscription) await subscription.unsubscribe();
  },
  async signOut(): Promise<void> {
    if (!PushService.supported()) return;
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    try { await api.post('/push/subscriptions/revoke-current', { endpoint: subscription.endpoint }); } finally { await subscription.unsubscribe(); }
  }
};
