import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { NotificationBell } from './NotificationBell';
import { NotificationService } from '../services/notificationService';

const title = 'Application operation failed while updating the department approval configuration';
const message = 'The full notification explains which department needs attention and includes a final sentence that must be readable.';
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 1 } }) }));
vi.mock('../hooks/useMobileViewport', () => ({ useMobileViewport: () => true }));
vi.mock('./ToastProvider', () => ({ useToast: () => ({ info: vi.fn() }) }));
vi.mock('../services/notificationService', () => ({ NotificationService: {
  getNotificationsForUser: vi.fn(async () => ({ items: [{ id: 17, title: 'Application operation failed while updating the department approval configuration', message: 'The full notification explains which department needs attention and includes a final sentence that must be readable.', type: 'OperationFailed', severity: 'Warning', createdAt: '2026-10-05T04:00:00Z', isRead: false, actionUrl: '/notifications?focus=17' }], total: 1 })),
  getUnreadCount: vi.fn(async () => 1),
  subscribe: vi.fn(() => vi.fn()), markAsRead: vi.fn(async () => {}), markAllAsRead: vi.fn(async () => {}),
} }));

function RouteProbe() { return <output data-testid="route">{useLocation().pathname}{useLocation().search}</output>; }
async function openPreview() {
  render(<MemoryRouter initialEntries={['/departments']}><NotificationBell /><RouteProbe /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Notifications: 1 unread' }));
  return screen.getByRole('dialog', { name: 'Notifications' });
}

describe('notification preview interactions', () => {
  it('retains the complete title and message and opens the selected notification', async () => {
    const sheet = await openPreview();
    expect(within(sheet).getByText(title)).toBeInTheDocument();
    fireEvent.click(within(sheet).getByText(message));
    await waitFor(() => expect(screen.getByTestId('route')).toHaveTextContent('/notifications?focus=17'));
    expect(NotificationService.markAsRead).toHaveBeenCalledWith(17);
  });

  it('supports keyboard activation of the notification', async () => {
    const sheet = await openPreview();
    fireEvent.keyDown(within(sheet).getByRole('button', { name: new RegExp(title) }), { key: 'Enter' });
    await waitFor(() => expect(NotificationService.markAsRead).toHaveBeenCalledWith(17));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('marks all as read without navigating or selecting an item', async () => {
    const sheet = await openPreview();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Mark all as read' }));
    await waitFor(() => expect(NotificationService.markAllAsRead).toHaveBeenCalledWith(1));
    expect(NotificationService.markAsRead).not.toHaveBeenCalled();
    expect(screen.getByTestId('route')).toHaveTextContent('/departments');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close notifications' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
