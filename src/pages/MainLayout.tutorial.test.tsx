import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../contexts/AuthContext';
import { getTutorialSteps, tutorialStorageKey } from '../lib/tutorial';
import { MainLayout } from './MainLayout';

vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../contexts/ThemeContext', () => ({ useTheme: () => ({ preference: 'system', setPreference: vi.fn() }) }));
vi.mock('../components/NotificationBell', () => ({ NotificationBell: () => <button aria-label="Notifications: 0 unread">Alerts</button> }));
vi.mock('../components/PWAStatus', () => ({ PWAStatus: () => null }));
vi.mock('../services/notificationService', () => ({ NotificationService: { disconnect: vi.fn() } }));
vi.mock('../services/pushService', () => ({ PushService: { signOut: vi.fn() } }));

function account(capabilities: string[], id = 1) {
  vi.mocked(useAuth).mockReturnValue({
    user: { id, username: 'tutorial-user', role: 'Employee', capabilities }, token: 'test',
    capabilities, accessLoading: false, isAuthenticated: true, login: vi.fn(), logout: vi.fn(),
    isEmployee: capabilities.includes('PersonalLeave'), isApprover: capabilities.includes('Approvals'),
    canViewPendingApprovals: capabilities.includes('Approvals'), isHR: capabilities.includes('HROperations'),
    isAdmin: capabilities.includes('SystemOperations'), isSystemAdmin: capabilities.includes('UserRoleManagement')
  });
}

describe('tutorial discovery and navigation integration', () => {
  beforeEach(() => { localStorage.clear(); });
  it.each([
    ['Employee', ['PersonalLeave']],
    ['Approver', ['PersonalLeave', 'Approvals']],
    ['HR staff', ['PersonalLeave', 'HROperations']],
    ['HR manager', ['PersonalLeave', 'HROperations', 'HRManagement']],
    ['Admin', ['HROperations', 'HRManagement', 'SystemOperations']],
    ['System admin', ['HROperations', 'HRManagement', 'SystemOperations', 'UserRoleManagement']],
    ['Restricted account', []]
  ])('has a real navigation or control target for every %s step', (_role, capabilities) => {
    account(capabilities as string[]);
    render(<MemoryRouter><MainLayout /></MemoryRouter>);
    for (const step of getTutorialSteps(capabilities as string[])) expect(document.querySelector(step.target), step.title).not.toBeNull();
  });
  it('lets a first-time user dismiss discovery, restart, skip, and recover their collapsed sidebar', () => {
    account(['PersonalLeave']);
    localStorage.setItem('onlinefs-sidebar-collapsed', 'true');
    render(<MemoryRouter><MainLayout /><div className="page-container"><header className="page-header" /><div className="stat-grid" /><div className="balance-grid" /><div data-tutorial="dashboard-recent" /></div></MemoryRouter>);
    expect(screen.getByText('New to OnlineFS?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Maybe later' }));
    expect(screen.queryByText('New to OnlineFS?')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Get Started' }));
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
    expect(document.querySelector('.app-layout')).not.toHaveClass('sidebar-collapsed');
    fireEvent.click(screen.getByRole('button', { name: 'Skip tutorial' }));
    expect(document.querySelector('.app-layout')).toHaveClass('sidebar-collapsed');
    expect(localStorage.getItem(tutorialStorageKey(1, ['PersonalLeave']))).toBe('skipped');
    fireEvent.click(screen.getByRole('button', { name: 'Get Started' }));
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
  });
  it('remembers discovery per user without hiding the restart button', () => {
    account(['PersonalLeave']);
    localStorage.setItem(tutorialStorageKey(1, ['PersonalLeave']), 'finished');
    const view = render(<MemoryRouter><MainLayout /></MemoryRouter>);
    expect(screen.queryByText('New to OnlineFS?')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Get Started' })).toBeInTheDocument();
    view.unmount();
    account(['PersonalLeave'], 2);
    render(<MemoryRouter><MainLayout /></MemoryRouter>);
    expect(screen.getByText('New to OnlineFS?')).toBeInTheDocument();
  });
  it('returns keyboard focus to the persistent launcher after closing an invited tour', async () => {
    account(['PersonalLeave']);
    render(<MemoryRouter><MainLayout /></MemoryRouter>);
    const invitation = screen.getByRole('button', { name: 'Start tutorial' });
    invitation.focus();
    fireEvent.click(invitation);
    fireEvent.click(screen.getByRole('button', { name: 'Skip tutorial' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Get Started' })).toHaveFocus());
  });
});
