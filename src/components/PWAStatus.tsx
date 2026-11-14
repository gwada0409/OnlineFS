import React, { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { Download, RefreshCw, WifiOff, X } from 'lucide-react';

interface InstallPromptEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

export const PWAStatus: React.FC = () => {
  const [online, setOnline] = useState(navigator.onLine);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [realtime, setRealtime] = useState('connected');
  const [dismissed, setDismissed] = useState(() => Number(localStorage.getItem('onlinefs_install_dismissed_until') || 0) > Date.now());
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const [updateSW] = useState(() => registerSW({ immediate: true, onNeedRefresh: () => setUpdateAvailable(true) }));

  useEffect(() => {
    const onOnline = () => setOnline(true), onOffline = () => setOnline(false);
    const onInstall = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPromptEvent); };
    const onRealtime = (event: Event) => setRealtime((event as CustomEvent<string>).detail);
    window.addEventListener('online', onOnline); window.addEventListener('offline', onOffline); window.addEventListener('beforeinstallprompt', onInstall); window.addEventListener('onlinefs:realtime-status', onRealtime);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); window.removeEventListener('beforeinstallprompt', onInstall); window.removeEventListener('onlinefs:realtime-status', onRealtime); };
  }, []);

  const hasPotentialUnsavedWork = () => Boolean(document.querySelector('form input:not([type="hidden"]), form textarea, form select'));
  const refresh = async () => {
    if (hasPotentialUnsavedWork() && !window.confirm('A form is open and may contain unsaved work. Refresh and lose those changes?')) return;
    await updateSW(true);
  };
  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt(); const choice = await installPrompt.userChoice;
    setInstallPrompt(null); if (choice.outcome === 'dismissed') dismiss();
  };
  const dismiss = () => { localStorage.setItem('onlinefs_install_dismissed_until', String(Date.now() + 14 * 86400000)); setDismissed(true); };

  return <>
    {!online && <div role="status" className="fixed top-0 left-0 right-0 z-[100] bg-warning text-black px-4 py-2 text-center text-xs font-bold"><WifiOff size={14} className="inline mr-2" />You’re offline. Viewing cached screens is available, but filing and approval actions require a connection.</div>}
    {online && realtime === 'reconnecting' && <div role="status" className="fixed top-0 left-0 right-0 z-[100] bg-info text-white px-4 py-2 text-center text-xs font-bold">Reconnecting live notifications… Missed updates will be recovered automatically.</div>}
    {updateAvailable && <div role="status" className="fixed bottom-4 left-4 right-4 md:left-auto md:w-96 z-[100] glass-card p-4 border border-primary shadow-xl"><div className="font-bold text-sm">A new OnlineFS version is ready</div><p className="text-xs text-muted mt-1">Refresh when you have saved any open form.</p><button className="btn btn-primary btn-sm mt-3" onClick={refresh}><RefreshCw size={14} /> Refresh to update</button></div>}
    {!standalone && !dismissed && installPrompt && <div className="fixed bottom-4 left-4 right-4 md:left-auto md:w-[28rem] z-[90] glass-card p-4 border border-primary/40 shadow-xl"><button aria-label="Dismiss install suggestion" className="float-right text-muted" onClick={dismiss}><X size={16} /></button><div className="font-bold text-sm flex gap-2"><Download size={17} className="text-primary" />Install OnlineFS</div><p className="text-xs text-muted mt-1">Receive approval updates, access requests faster, and launch it directly from your Home Screen. Availability depends on your browser and device.</p><button className="btn btn-primary btn-sm mt-3" onClick={install}>Install</button></div>}
  </>;
};
