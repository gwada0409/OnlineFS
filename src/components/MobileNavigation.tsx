import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, Compass, LogOut, Menu, X } from 'lucide-react';
import { getNavigationItems, type NavigationItem } from '../lib/navigation';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useMobileViewport } from '../hooks/useMobileViewport';
import { DialogOverlay } from './ui/DialogOverlay';


export function MobileNavigation({ onLogout, onStartTutorial }: { onLogout: () => void; onStartTutorial: () => void }) {
  const { user, isEmployee, isHR, isAdmin, isSystemAdmin, canViewPendingApprovals, capabilities } = useAuth();
  const { preference, setPreference } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const mobile = useMobileViewport();
  const [open, setOpen] = useState(false);
  useEffect(() => { if (!mobile) setOpen(false); }, [mobile]);
  const items = getNavigationItems({ isEmployee, isHR, isAdmin, isSystemAdmin, canViewPendingApprovals, capabilities });
  const primaryPaths = isAdmin
    ? ['/system', ...(isHR ? ['/hr', '/hr/employment-status'] : []), '/notifications?workspace=System']
    : isHR
      ? ['/hr', '/hr/employment-status', canViewPendingApprovals ? '/approvals' : '/departments', '/notifications?workspace=HR']
      : ['/personal', '/file-leave', '/my-requests', canViewPendingApprovals ? '/approvals' : '/notifications?workspace=Personal'];
  const primary = primaryPaths.map(path => items.find(item => item.path === path)).filter((item): item is NavigationItem => !!item).slice(0, 4);
  if (!primary.length) primary.push({ label: 'Notifications', path: '/notifications', icon: Bell, section: 'Account' });
  const active = (path: string) => {
    const [pathname, search] = path.split('?');
    if (pathname === '/personal' && location.pathname === '/' && isEmployee && !isHR && !isAdmin) return true;
    if (location.pathname !== pathname) return false;
    const selectedWorkspace = new URLSearchParams(location.search).get('workspace') || (isAdmin ? 'System' : isHR ? 'HR' : canViewPendingApprovals ? 'Approvals' : 'Personal');
    return !search || selectedWorkspace === new URLSearchParams(search).get('workspace');
  };
  const go = (path: string) => { setOpen(false); navigate(path); };
  // Unmount the mobile drawer at the desktop breakpoint, including during resize.
  if (!mobile) return null;
  return <>
    <nav className="mobile-bottom-nav" aria-label="Mobile primary navigation">
      {primary.map(({ label, path, icon: Icon }) => <button type="button" key={path} className={active(path) ? 'active' : ''} aria-current={active(path) ? 'page' : undefined} onClick={() => go(path)}>
        <Icon size={21} aria-hidden="true" /><span>{({ 'My Dashboard': 'Home', 'My Requests': 'Requests', 'Pending Approvals': 'Approvals', 'Employee Hub': 'People', 'HR Dashboard': 'HR', 'System Operations': 'System', 'Personal Notifications': 'Alerts', 'HR Notifications': 'Alerts', 'System Alerts': 'Alerts' } as Record<string, string>)[label] || label}</span>
      </button>)}
      <button type="button" className={open ? 'active' : ''} aria-label="More navigation" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}><Menu size={21} aria-hidden="true" /><span>More</span></button>
    </nav>
    {open && <DialogOverlay label="Navigation and settings" onClose={() => setOpen(false)} closeOnBackdrop>
      <div className="modal-content mobile-navigation-sheet">
        <div className="modal-header"><div><h2>Explore OnlineFS</h2><p className="text-sm text-muted">{user?.username} · {user?.role}</p></div><button type="button" className="modal-close" aria-label="Close navigation" onClick={() => setOpen(false)}><X size={20} /></button></div>
        <nav aria-label="All workspaces" className="mobile-workspaces">
          {[...new Set(items.map(item => item.section))].map(section => <section key={section}>
            <h3>{section}</h3>
            {items.filter(item => item.section === section).map(({ label, path, icon: Icon }) => <button type="button" className={`nav-item${active(path) ? ' active' : ''}`} aria-current={active(path) ? 'page' : undefined} key={path} onClick={() => go(path)}><Icon size={20} aria-hidden="true" /><span>{label}</span></button>)}
          </section>)}
        </nav>
        <div className="mobile-account-settings">
          <label htmlFor="mobile-theme-preference" className="form-label">Color theme</label>
          <select id="mobile-theme-preference" className="form-select" value={preference} onChange={event => setPreference(event.target.value as 'light' | 'dark' | 'system')}><option value="system">System theme</option><option value="light">Light mode</option><option value="dark">Dark mode</option></select>
          <button type="button" className="btn btn-outline" onClick={() => { setOpen(false); onStartTutorial(); }}><Compass size={18} /> Start a tutorial</button>
          <button type="button" className="btn btn-ghost text-danger" onClick={() => { setOpen(false); onLogout(); }}><LogOut size={18} /> Sign Out</button>
        </div>
      </div>
    </DialogOverlay>}
  </>;
}
