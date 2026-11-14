import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../contexts/AuthContext';
import { MobileNavigation } from './MobileNavigation';

vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../contexts/ThemeContext', () => ({ useTheme: () => ({ preference: 'system', setPreference: vi.fn() }) }));

function RouteProbe() { return <output data-testid="route">{useLocation().pathname}</output>; }
function account(capabilities: string[]) {
  vi.mocked(useAuth).mockReturnValue({
    user: { id: 1, username: 'Preview', role: 'Employee', capabilities }, token: 'preview', capabilities,
    accessLoading: false, isAuthenticated: true, login: vi.fn(), logout: vi.fn(),
    isEmployee: capabilities.includes('PersonalLeave'), isApprover: capabilities.includes('Approvals'),
    canViewPendingApprovals: capabilities.includes('Approvals'), isHR: capabilities.includes('HROperations'),
    isAdmin: capabilities.includes('SystemOperations'), isSystemAdmin: capabilities.includes('UserRoleManagement'),
  });
}
function show() {
  return render(<MemoryRouter initialEntries={['/personal']}><MobileNavigation onLogout={vi.fn()} onStartTutorial={vi.fn()} /><RouteProbe /></MemoryRouter>);
}

describe('mobile workspace navigation', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    account(['PersonalLeave']);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('navigates from the bottom bar and exposes the active destination', () => {
    show();
    const nav = screen.getByRole('navigation', { name: 'Mobile primary navigation' });
    expect(within(nav).getAllByRole('button')).toHaveLength(5);
    fireEvent.click(within(nav).getByRole('button', { name: 'File Leave' }));
    expect(screen.getByTestId('route')).toHaveTextContent('/file-leave');
    expect(within(nav).getByRole('button', { name: 'File Leave' })).toHaveAttribute('aria-current', 'page');
  });

  it('keeps unauthorized HR and system destinations out of the drawer', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: 'More navigation' }));
    const drawer = screen.getByRole('dialog', { name: 'Navigation and settings' });
    expect(within(drawer).getByRole('button', { name: 'My Requests' })).toBeInTheDocument();
    expect(within(drawer).queryByRole('button', { name: 'Departments' })).not.toBeInTheDocument();
    expect(within(drawer).queryByRole('button', { name: 'System Operations' })).not.toBeInTheDocument();
    fireEvent.click(within(drawer).getByRole('button', { name: 'My Requests' }));
    expect(screen.getByTestId('route')).toHaveTextContent('/my-requests');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('gives HR users primary shortcuts and retains their personal routes in More', () => {
    account(['PersonalLeave', 'Approvals', 'HROperations']);
    show();
    expect(screen.getByRole('button', { name: 'People' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'More navigation' }));
    const drawer = screen.getByRole('dialog');
    expect(within(drawer).getByRole('button', { name: 'File Leave' })).toBeInTheDocument();
    expect(within(drawer).getByRole('button', { name: 'Departments' })).toBeInTheDocument();
    expect(within(drawer).queryByRole('button', { name: 'Leave Policies & Calendar' })).not.toBeInTheDocument();
  });

  it('leaves desktop navigation to the existing shell', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    show();
    expect(screen.queryByRole('navigation', { name: 'Mobile primary navigation' })).not.toBeInTheDocument();
  });
});
