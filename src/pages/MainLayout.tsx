import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard, FileText, Clock, CheckSquare, Users,
  LogOut, Menu, X, Building2, GitMerge
} from 'lucide-react';

export const MainLayout: React.FC = () => {
  const { user, logout, isHR, isAdmin, isSystemAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navTo = (path: string) => {
    navigate(path);
    setSidebarOpen(false);
  };

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const initials = user?.username?.slice(0, 2).toUpperCase() || '??';

  return (
    <div className="app-layout">
      {/* Mobile menu toggle */}
      <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Backdrop for mobile */}
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <img src="/logo.png" alt="HIBLOW Logo" style={{ width: '100%', maxHeight: 45, objectFit: 'contain' }} />
        </div>

        <nav className="sidebar-nav">
          {!(isHR || isAdmin) && (
            <>
              <div className="nav-section-title">Main Menu</div>
              <button className={`nav-item ${isActive('/') && location.pathname === '/' ? 'active' : ''}`} onClick={() => navTo('/')}>
                <LayoutDashboard size={18} /> Dashboard
              </button>
              <button className={`nav-item ${isActive('/file-leave') ? 'active' : ''}`} onClick={() => navTo('/file-leave')}>
                <FileText size={18} /> File Leave
              </button>
              <button className={`nav-item ${isActive('/my-requests') ? 'active' : ''}`} onClick={() => navTo('/my-requests')}>
                <Clock size={18} /> My Requests
              </button>

              <div className="nav-section-title">Approvals</div>
              <button className={`nav-item ${isActive('/approvals') ? 'active' : ''}`} onClick={() => navTo('/approvals')}>
                <CheckSquare size={18} /> Pending Approvals
              </button>
            </>
          )}

          {(isHR || isAdmin) && (
            <>
              <div className="nav-section-title">HR Administration</div>
              <button className={`nav-item ${isActive('/hr') ? 'active' : ''}`} onClick={() => navTo('/hr')}>
                <Users size={18} /> HR Dashboard
              </button>
              <button className={`nav-item ${isActive('/departments') ? 'active' : ''}`} onClick={() => navTo('/departments')}>
                <Building2 size={18} /> Departments
              </button>
              <button className={`nav-item ${isActive('/approval-routes') ? 'active' : ''}`} onClick={() => navTo('/approval-routes')}>
                <GitMerge size={18} /> Custom Routes
              </button>
            </>
          )}

          {isSystemAdmin && (
            <>
              <div className="nav-section-title">System Administration</div>
              <button className={`nav-item ${isActive('/system-admin') ? 'active' : ''}`} onClick={() => navTo('/system-admin')}>
                <Users size={18} /> Role Management
              </button>
            </>
          )}
        </nav>

        <div className="sidebar-user">
          <div className="sidebar-user-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user?.username}</div>
            <div className="sidebar-user-role">{user?.role}</div>
          </div>
          <button className="btn-ghost" onClick={handleLogout} title="Sign Out">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99 }} onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main Content */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};
