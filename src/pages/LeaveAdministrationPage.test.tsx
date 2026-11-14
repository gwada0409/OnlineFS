import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import api from '../lib/api';
import { LeaveAdministrationPage } from './LeaveAdministrationPage';
const access = vi.hoisted(() => ({ isAdmin: true }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => access }));
vi.mock('../lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() }, getApiErrorMessage: (e: Error) => e.message }));
beforeEach(() => {
  vi.resetAllMocks(); access.isAdmin = true;
  vi.mocked(api.get).mockResolvedValue({ data: [] });
  vi.mocked(api.post).mockResolvedValue({ data: { fingerprint: 'reviewed-scope', employees: 2, counts: { LeaveRequests: 3 } } });
});
afterEach(cleanup);
it('requires a preview and typed confirmation before requesting backup and clear', async () => {
  render(<MemoryRouter><LeaveAdministrationPage /></MemoryRouter>);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Preview year/group' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Preview year/group' }));
  const clear = await screen.findByRole('button', { name: 'Back up, verify & clear selection' });
  expect(clear).toBeDisabled();
  const year = Number((screen.getByLabelText('Policy year') as HTMLInputElement).value);
  fireEvent.change(screen.getByLabelText('Clear confirmation'), { target: { value: `CLEAR ${year}` } });
  expect(clear).toBeEnabled();
  fireEvent.click(clear);
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/leave-administration/maintenance/clear', { scope: { year, group: 'All' }, confirmation: `CLEAR ${year}`, fingerprint: 'reviewed-scope' }));
});
it('keeps reset and restore execution out of the HR-only interface', async () => {
  access.isAdmin = false;
  render(<MemoryRouter><LeaveAdministrationPage /></MemoryRouter>);
  await screen.findByText('No employees in this selection.');
  expect(screen.queryByRole('button', { name: 'Preview year/group' })).not.toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled();
});
it('surfaces a failed preview and never enables clear', async () => {
  vi.mocked(api.post).mockRejectedValue(new Error('A linked request crosses the selected period.'));
  render(<MemoryRouter><LeaveAdministrationPage /></MemoryRouter>);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Preview year/group' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Preview year/group' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('A linked request crosses');
  expect(screen.queryByLabelText('Clear confirmation')).not.toBeInTheDocument();
});
