import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmploymentStatusPage } from './EmploymentStatusPage';

const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), balances: vi.fn(), summary: vi.fn(), update: vi.fn(), types: vi.fn(), error: vi.fn(), success: vi.fn() }));
vi.mock('../lib/api', () => ({ default: { get: mocks.get, put: mocks.put }, HRAPI: { getEmployeeBalances: mocks.balances, getEmployeeLeaveSummary: mocks.summary, updateBalance: mocks.update }, LeaveAPI: { getTypes: mocks.types }, getApiErrorMessage: (_error: unknown, fallback: string) => fallback }));
vi.mock('../components/ToastProvider', () => ({ useToast: () => ({ error: mocks.error, success: mocks.success }) }));
vi.mock('../services/notificationService', () => ({ NotificationService: { subscribe: () => () => {}, subscribeOrganizationChanges: () => () => {} } }));
vi.mock('../components/EmployeeLeaveDetail', () => ({ EmployeeLeaveDetail: ({ employee, onClose }: any) => <div role="dialog">Balances {employee.fullName}: {employee.balances[0]?.available ?? 'empty'}<button onClick={onClose}>Close balances</button></div> }));
vi.mock('../components/LeaveSummaryForm', () => ({ LeaveSummaryForm: ({ employee }: any) => <div role="dialog">Summary {employee.fullName}</div> }));
const alice = { id: 1, employeeID: 'A1', fullName: 'Alice', department: 'HR', position: 'Staff', employmentStatus: 'REGULAR' };
const bob = { ...alice, id: 2, employeeID: 'B2', fullName: 'Bob', department: 'Production' };
const balance = { leaveTypeCode: 'SL', totalCredits: 15, carryOver: 2, available: 12, hrRemarks: '' };
const open = async () => { render(<EmploymentStatusPage/>); await waitFor(() => expect(screen.getByRole('button', { name: 'Edit leave balances for Alice' })).toBeEnabled()); };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.get.mockResolvedValue({ data: [alice, bob] });
  mocks.balances.mockResolvedValue([{ ...alice, balances: [balance] }]);
  mocks.types.mockResolvedValue([{ id: 3, code: 'SL', description: 'Sick Leave' }]);
  mocks.summary.mockImplementation((id: number) => Promise.resolve({ employee: id === 1 ? alice : bob, balances: [], requests: [] }));
  mocks.update.mockResolvedValue(undefined); mocks.put.mockResolvedValue(undefined);
});
afterEach(cleanup);
describe('Employee Hub interactions', () => {
  it('combines department filtering and search while retaining employees without balances', async () => {
    await open(); expect(screen.getByRole('heading', { name: 'Employee Hub' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Filter by department'), { target: { value: 'Production' } });
    expect(screen.queryByRole('button', { name: 'Leave summary for Alice' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search employees'), { target: { value: 'B2' } });
    fireEvent.click(screen.getByRole('button', { name: 'View leave balances for Bob' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Balances Bob: empty'); expect(mocks.summary).not.toHaveBeenCalled();
  });
  it('opens the printable summary for the clicked employee and current year', async () => {
    await open(); fireEvent.click(screen.getByRole('button', { name: 'Leave summary for Bob' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Summary Bob');
    expect(mocks.summary).toHaveBeenCalledWith(2, new Date().getFullYear());
  });
  it('matches balance records by ID, cancels edits, and refreshes after saving', async () => {
    await open(); fireEvent.click(screen.getByRole('button', { name: 'View leave balances for Alice' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Balances Alice: 12'); fireEvent.click(screen.getByText('Close balances'));
    fireEvent.click(screen.getByRole('button', { name: 'Edit leave balances for Alice' }));
    expect(screen.getByLabelText('Total Credits')).toHaveValue(15); fireEvent.click(screen.getByText('Cancel')); expect(mocks.update).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Edit leave balances for Alice' }));
    fireEvent.change(screen.getByLabelText('Total Credits'), { target: { value: '20' } }); fireEvent.click(screen.getByText('Save Changes'));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(1, { leaveTypeId: 3, totalCredits: 20, carryOver: 2, hrRemarks: '' }));
    await waitFor(() => expect(mocks.balances).toHaveBeenCalledTimes(2)); expect(mocks.summary).not.toHaveBeenCalled();
  });
  it('keeps failed edits open and rolls back failed status updates', async () => {
    mocks.update.mockRejectedValue(new Error()); mocks.put.mockRejectedValue(new Error());
    await open(); fireEvent.change(screen.getByLabelText('Employment status for Alice'), { target: { value: 'NON-REGULAR' } });
    await waitFor(() => expect(screen.getByLabelText('Employment status for Alice')).toHaveValue('REGULAR'));
    fireEvent.click(screen.getByRole('button', { name: 'Edit leave balances for Alice' })); fireEvent.click(screen.getByText('Save Changes'));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('Failed to update balance'));
    expect(screen.getByRole('dialog')).toBeInTheDocument(); expect(mocks.summary).not.toHaveBeenCalled();
  });
  it('shows balance load failures without hiding employees or printable summaries', async () => {
    mocks.balances.mockRejectedValue(new Error()); render(<EmploymentStatusPage/>);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load leave balances');
    expect(screen.getByRole('button', { name: 'View leave balances for Bob' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Leave summary for Bob' })); expect(await screen.findByRole('dialog')).toHaveTextContent('Summary Bob');
  });
});
