import React, { useEffect, useState } from 'react';
import { BellRing, Smartphone, Trash2, Send } from 'lucide-react';
import { PushService, type PushDevice } from '../services/pushService';
import { useToast } from './ToastProvider';

export const PushDeviceSettings: React.FC = () => {
  const toast = useToast();
  const [devices, setDevices] = useState<PushDevice[]>([]);
  const [busy, setBusy] = useState(false);
  const load = async () => { try { setDevices(await PushService.devices()); } catch { setDevices([]); } };
  useEffect(() => { void load(); }, []);
  const enable = async () => { setBusy(true); try { await PushService.enable(); await load(); toast.success('Notifications enabled on this device'); } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to enable notifications'); } finally { setBusy(false); } };
  const testNotification = async () => { setBusy(true); try { await PushService.testNotification(); toast.success('Windows test notification sent'); } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to send a Windows test notification'); } finally { setBusy(false); } };
  const remove = async (id: number) => { setBusy(true); try { await PushService.disable(id); await load(); toast.success('Device notifications disabled'); } catch { toast.error('Unable to remove this device'); } finally { setBusy(false); } };
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  return <div className="space-y-3">
    <div className="p-4 bg-primary/5 rounded-lg border border-primary/20"><div className="font-bold text-sm flex gap-2"><BellRing size={17} className="text-primary" />Notifications on this device</div><p className="text-xs text-muted mt-1">Enable after reviewing this explanation to receive important approval and final-decision alerts while OnlineFS is closed.</p>
      {PushService.supported() ? <div className="flex flex-wrap gap-2 mt-3"><button className="btn btn-primary btn-sm" disabled={busy || Notification.permission === 'denied'} onClick={enable}>{busy ? 'Working…' : devices.length ? 'Refresh device subscription' : 'Enable notifications'}</button>{Notification.permission === 'granted' && <button className="btn btn-outline btn-sm" disabled={busy} onClick={testNotification}><Send size={14} /> Send Windows test</button>}</div> : <p className="text-xs text-warning mt-2">This browser does not support Web Push. {ios ? 'On iPhone or iPad, add OnlineFS to the Home Screen first and enable notifications from the installed app.' : 'Use a current supported browser or continue using in-app notifications.'}</p>}
      {Notification.permission === 'denied' && <p className="text-xs text-warning mt-2">Notifications are blocked in browser settings. Allow them there before trying again.</p>}
    </div>
    {devices.map(device => <div key={device.id} className="flex items-center justify-between p-3 bg-base/40 rounded-lg border border-border"><div className="flex gap-3"><Smartphone size={18} className="text-primary mt-0.5" /><div><div className="font-bold text-sm">{device.deviceLabel}</div><div className="text-[11px] text-muted">Registered {new Date(device.createdAt).toLocaleString()}</div><div className="text-[11px] text-muted">{device.lastSuccessfulDeliveryAt ? `Last delivered ${new Date(device.lastSuccessfulDeliveryAt).toLocaleString()}` : device.lastFailureAt ? `Last attempt failed ${new Date(device.lastFailureAt).toLocaleString()}` : 'Waiting for the first background delivery'}</div></div></div><button aria-label={`Disable ${device.deviceLabel}`} className="btn btn-ghost btn-sm text-danger" disabled={busy} onClick={() => remove(device.id)}><Trash2 size={15} /></button></div>)}
  </div>;
};
