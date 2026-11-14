import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApproverAbsenceManagement } from './ApproverAbsenceManagement';
import { ApproverAbsenceAPI, DepartmentAPI, HRAPI } from '../lib/api';

vi.mock('../lib/api', () => ({
  ApproverAbsenceAPI: { getAll: vi.fn(), create: vi.fn(), revoke: vi.fn() },
  DepartmentAPI: { getHierarchy: vi.fn() }, HRAPI: { getEmployees: vi.fn() },
  getApiErrorMessage: (error: Error) => error.message,
}));
vi.mock('../components/ToastProvider', () => ({ useToast: () => ({ success: vi.fn() }) }));
vi.mock('../services/notificationService', () => ({ NotificationService: { subscribeOrganizationChanges: () => () => {} } }));

const today = () => new Date().toLocaleDateString('en-CA');
const employees = [{ id: 2, fullName: 'Selected Line Leader', employeeID: 'LEAD-2', department: 'Production' }, { id: 5, fullName: 'Backup Approver', employeeID: 'BACKUP-5', department: 'Production' }] as any;
const record = () => ({ id: 10, employeeId: 2, employeeName: 'Selected Line Leader', employeeDepartment: 'Production', startDate: today(), endDate: today(), reason: 'Annual leave', status: 'Active', isActive: true, createdBy: 'Administrator' }) as any;
const open = () => render(<MemoryRouter><ApproverAbsenceManagement /></MemoryRouter>);
beforeEach(() => {
  vi.mocked(ApproverAbsenceAPI.getAll).mockResolvedValue([]);
  vi.mocked(ApproverAbsenceAPI.create).mockResolvedValue({});
  vi.mocked(ApproverAbsenceAPI.revoke).mockResolvedValue({});
  vi.mocked(HRAPI.getEmployees).mockResolvedValue(employees);
  vi.mocked(DepartmentAPI.getHierarchy).mockResolvedValue([{ id: 1, departments: [{ id: 10, name: 'Production', isActive: true, notedByApproverIds: [2], backupApprovers: { notedBy: 5, recommending: null, approver: null } }] }] as any);
});
afterEach(cleanup);

describe('admin approver leave coverage', () => {
  it('records who is on leave without selecting a manual delegate', async () => {
    open();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Record Approver Leave' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Record Approver Leave' }));
    fireEvent.change(screen.getByLabelText('Find employee'), { target: { value: 'LEAD-2' } });
    fireEvent.change(screen.getByLabelText('Approver on leave *'), { target: { value: '2' } });
    expect(screen.getByText('Backup Approver')).toBeVisible();
    expect(screen.getByText('Production · Noted by / Line leader')).toBeVisible();
    fireEvent.change(screen.getByLabelText('Reason *'), { target: { value: '  Annual leave  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Record Leave' }));
    await waitFor(() => expect(ApproverAbsenceAPI.create).toHaveBeenCalledWith({ employeeId: 2, startDate: today(), endDate: today(), reason: 'Annual leave' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('keeps conflicting leave dates reviewable after a server rejection', async () => {
    vi.mocked(ApproverAbsenceAPI.create).mockRejectedValue(new Error('This employee already has an absence overlapping these dates.'));
    open();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Record Approver Leave' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Record Approver Leave' }));
    fireEvent.change(screen.getByLabelText('Approver on leave *'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Reason *'), { target: { value: 'Annual leave' } });
    fireEvent.click(screen.getByRole('button', { name: 'Record Leave' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('overlapping');
    expect(screen.getByLabelText('Approver on leave *')).toHaveValue('2');
  });

  it('ends coverage with a recorded reason while keeping the history', async () => {
    vi.mocked(ApproverAbsenceAPI.getAll).mockResolvedValue([record()]); open();
    fireEvent.click(await screen.findByRole('button', { name: 'End leave coverage for Selected Line Leader' }));
    fireEvent.change(screen.getByLabelText('Reason for ending coverage *'), { target: { value: 'Returned early' } });
    fireEvent.click(screen.getByRole('button', { name: 'End Coverage' }));
    await waitFor(() => expect(ApproverAbsenceAPI.revoke).toHaveBeenCalledWith(10, 'Returned early'));
  });

  it('warns when the department backup is also on leave', async () => {
    vi.mocked(ApproverAbsenceAPI.getAll).mockResolvedValue([{ ...record(), employeeId: 5, employeeName: 'Backup Approver' }]); open();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Record Approver Leave' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Record Approver Leave' }));
    fireEvent.change(screen.getByLabelText('Approver on leave *'), { target: { value: '2' } });
    expect(screen.getByText('Backup Approver — unavailable during these dates')).toBeVisible();
  });
});
