import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, Menu, X, PanelLeftClose, PanelLeftOpen, Compass } from 'lucide-react';
import { getNavigationItems } from '../lib/navigation';
import { NotificationBell } from '../components/NotificationBell';
import { PWAStatus } from '../components/PWAStatus';
import { NotificationService } from '../services/notificationService';
import { PushService } from '../services/pushService';
import { useTheme } from '../contexts/ThemeContext';
import { GetStartedTutorial } from '../components/GetStartedTutorial';
import { MobileNavigation } from '../components/MobileNavigation';
import { getSectionTutorialSteps, tutorialStorageKey, type TutorialStep } from '../lib/tutorial';

export const MainLayout: React.FC = () => {
  const { preference, setPreference } = useTheme();
  const { user, logout, isHR, isAdmin, isSystemAdmin, isEmployee, canViewPendingApprovals, capabilities } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const allowedWorkspaces = [
    ...(isEmployee ? ['Personal'] : []),
    ...(canViewPendingApprovals ? ['Approvals'] : []),
    ...(isHR ? ['HR'] : []),
    ...(isAdmin ? ['System'] : [])
  ];
  const defaultWorkspace = isAdmin ? 'System' : isHR ? 'HR' : canViewPendingApprovals ? 'Approvals' : 'Personal';
  const requestedNotificationWorkspace = new URLSearchParams(location.search).get('workspace');
  const notificationWorkspace = requestedNotificationWorkspace && allowedWorkspaces.includes(requestedNotificationWorkspace)
    ? requestedNotificationWorkspace
    : defaultWorkspace;
  const workspace = location.pathname.startsWith('/system') ? 'System'
    : ['/hr', '/departments', '/approval-routes', '/approval-routing'].some(path => location.pathname.startsWith(path)) ? 'HR'
    : location.pathname.startsWith('/approvals') ? 'Approvals'
    : location.pathname === '/notifications' ? notificationWorkspace : 'Personal';
  const sectionTitle = location.pathname.startsWith('/departments') ? 'Approval Categories & Leave Routing Departments'
    : location.pathname === '/hr' ? 'HR Dashboard'
    : location.pathname.startsWith('/hr/employment-status') ? 'Employee Hub'
    : location.pathname.startsWith('/hr/leave-policies') ? 'Leave Policies & Calendar'
    : location.pathname.startsWith('/approval-routes') ? 'Approval Routes'
    : location.pathname.startsWith('/approval-routing') ? 'Delegation Management'
    : location.pathname.startsWith('/approvals') ? 'Pending Approvals'
    : location.pathname.startsWith('/notifications') ? `${notificationWorkspace} Notifications`
    : location.pathname.startsWith('/personal') ? 'My Dashboard'
    : location.pathname.startsWith('/file-leave') ? 'File Leave'
    : location.pathname.startsWith('/my-requests') ? 'My Requests'
    : location.pathname.startsWith('/system-health') ? 'Health & Repair'
    : location.pathname.startsWith('/system-admin') ? 'Role Management'
    : location.pathname.startsWith('/system') ? 'System Operations'
    : `${workspace} Workspace`;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('onlinefs-sidebar-collapsed') === 'true'; }
    catch { return false; }
  });
  const tutorialKey = tutorialStorageKey(user?.id ?? 0, capabilities);
  const sectionSteps = useMemo(() => getSectionTutorialSteps(capabilities, location.pathname), [capabilities, location.pathname]);
  const [tutorialSteps, setTutorialSteps] = useState<TutorialStep[]>([]);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialSeen, setTutorialSeen] = useState(() => {
    try { return localStorage.getItem(tutorialKey) !== null; }
    catch { return false; }
  });
  const previousSidebar = useRef({ open: false, collapsed: false });
  useEffect(() => {
    if (!tutorialOpen) return;
    // Lazy pages and conditional form stages can mount after the route changes.
    const update = () => {
      const available = sectionSteps.filter(step => {
        const target = document.querySelector<HTMLElement>(step.target);
        return target && !target.closest('[hidden]');
      });
      setTutorialSteps(current => current.length === available.length && current.every((step, index) => step === available[index]) ? current : available);
    };
    update();
    const observer = new MutationObserver(update);
    const content = document.querySelector('.page-container');
    if (content) observer.observe(content, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [sectionSteps, tutorialOpen, location.search]);
  useEffect(() => {
    try { setTutorialSeen(localStorage.getItem(tutorialKey) !== null); }
    catch { setTutorialSeen(false); }
  }, [tutorialKey]);
  const startTutorial = () => {
    previousSidebar.current = { open: sidebarOpen, collapsed: sidebarCollapsed };
    setSidebarCollapsed(false);
    setTutorialOpen(true);
  };
  const focusTutorialLauncher = () => requestAnimationFrame(() => {
    const selector = window.innerWidth < 768 ? '.mobile-bottom-nav [aria-label="More navigation"]' : '[data-tutorial="launcher"]';
    document.querySelector<HTMLButtonElement>(selector)?.focus();
  });
  const closeTutorial = (outcome: 'skipped' | 'finished') => {
    setTutorialOpen(false);
    setTutorialSeen(true);
    setSidebarOpen(previousSidebar.current.open);
    setSidebarCollapsed(previousSidebar.current.collapsed);
    try { localStorage.setItem(tutorialKey, outcome); } catch { /* The header launcher still works without storage. */ }
    focusTutorialLauncher();
  };
  const showTutorialNavigation = useCallback((show: boolean) => setSidebarOpen(show), []);
  const dismissTutorialInvitation = () => {
    setTutorialSeen(true);
    try { localStorage.setItem(tutorialKey, 'dismissed'); } catch { /* Retain the in-memory preference. */ }
    focusTutorialLauncher();
  };

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed(current => {
      const next = !current;
      try { localStorage.setItem('onlinefs-sidebar-collapsed', String(next)); } catch { /* Keep the in-memory setting. */ }
      return next;
    });
  };

  const handleLogout = async () => {
    try { await Promise.allSettled([NotificationService.disconnect(), PushService.signOut()]); }
    finally { await logout(); navigate('/login'); }
  };

  const navTo = (path: string) => {
    navigate(path);
    setSidebarOpen(false);
  };

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const navigationItems = getNavigationItems({ isEmployee, isHR, isAdmin, isSystemAdmin, canViewPendingApprovals, capabilities });
  const navigationTitles: Record<string, string> = { Personal: 'Personal', Approvals: 'Approvals', HR: 'HR Operations', System: 'System Administration' };
  const initials = user?.username?.slice(0, 2).toUpperCase() || '??';

  return (
    <div className={`app-layout${sidebarCollapsed ? ' sidebar-collapsed' : ''}${tutorialOpen ? ' tutorial-running' : ''}`}>
      <PWAStatus />
      {/* Mobile menu toggle */}
      <button
        className="menu-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label={sidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={sidebarOpen}
        aria-controls="primary-navigation"
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Backdrop for mobile */}
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside id="primary-navigation" className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <img className="sidebar-logo-full" src="/logo.png" alt="HIBLOW Logo" />
          <img className="sidebar-logo-compact" src="/app_icon.png" alt="" aria-hidden="true" />
          <button
            type="button"
            className="sidebar-collapse-toggle"
            onClick={toggleSidebarCollapsed}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!sidebarCollapsed}
            aria-controls="primary-navigation"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        <nav className="sidebar-nav">
          {[...new Set(navigationItems.map(item => item.section))].map(section => <React.Fragment key={section}>
            <div className="nav-section-title">{navigationTitles[section]}</div>
            {navigationItems.filter(item => item.section === section).map(({ label, path, icon: Icon }) => {
              const routePath = path.split('?')[0];
              const active = routePath === '/notifications' ? isActive(routePath) && notificationWorkspace === section
                : routePath === '/hr' ? location.pathname === '/hr' : isActive(routePath);
              const sidebarLabel = label === 'Personal Notifications' || label === 'HR Notifications' ? 'Notifications' : label;
              return <button key={path} className={`nav-item ${active ? 'active' : ''}`} onClick={() => navTo(path)} aria-label={label} title={label}>
                <Icon size={18} aria-hidden="true" /><span className="nav-item-label">{sidebarLabel}</span>
              </button>;
            })}
          </React.Fragment>)}
        </nav>

        <div className="sidebar-user">
          <div className="sidebar-user-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user?.username}</div>
            <div className="sidebar-user-role">{user?.role}</div>
          </div>
          <button className="btn-ghost sidebar-logout" onClick={handleLogout} aria-label="Sign Out" title="Sign Out">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="main-header flex items-center justify-between px-4 sm:px-6 md:px-8 py-3 sm:py-3.5 border-b border-border bg-base/80 backdrop-blur-md sticky top-0 z-[60]">
          <div className="main-header-title flex items-center gap-3">
            <span className="text-xs font-semibold text-text-muted tracking-wide min-w-0 truncate" title={sectionTitle}>HIBLOW · {sectionTitle}</span>
          </div>
          <div className="main-header-controls flex items-center gap-3">
            <button type="button" data-tutorial="launcher" className="btn btn-outline btn-sm tutorial-launcher" onClick={startTutorial}>
              <Compass size={16} aria-hidden="true" /><span>Get Started</span>
            </button>
            <label className="sr-only" htmlFor="theme-preference">Color theme</label>
            <select
              id="theme-preference"
              className="form-select theme-preference"
              value={preference}
              onChange={event => setPreference(event.target.value as 'light' | 'dark' | 'system')}
              title="Choose light, dark, or system color theme"
            >
              <option value="system">System theme</option>
              <option value="light">Light mode</option>
              <option value="dark">Dark mode</option>
            </select>
            <div className="flex items-center gap-2" aria-label={`Current role: ${user?.role || 'Employee'}`}>
              <span className="text-xs text-text-muted font-medium">Role:</span>
              <span className="text-xs py-1 px-2.5 min-h-8 inline-flex items-center bg-base/80 border border-border rounded-lg font-medium text-text-secondary">
                {user?.role || 'Employee'}
              </span>
            </div>
            <NotificationBell />
          </div>
        </header>
        <div className="page-container">
          {!tutorialSeen && !tutorialOpen && <section className="glass-card tutorial-invitation" aria-label="Welcome to OnlineFS">
            <Compass size={24} className="text-primary" aria-hidden="true" />
            <div><strong>New to OnlineFS?</strong><p className="text-sm text-muted">Take a short tour of the features available to your account.</p></div>
            <button type="button" className="btn btn-primary btn-sm" onClick={startTutorial}>Start tutorial</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={dismissTutorialInvitation}>Maybe later</button>
          </section>}
          <Outlet />
        </div>
      </main>
      <MobileNavigation onLogout={handleLogout} onStartTutorial={startTutorial} />
      {tutorialOpen && tutorialSteps.length > 0 && <GetStartedTutorial key={`${tutorialKey}:${location.pathname}:${location.search}:${tutorialSteps.map(step => step.id).join(',')}`} steps={tutorialSteps} onClose={closeTutorial} onNavigationStep={showTutorialNavigation} />}
    </div>
  );
};
