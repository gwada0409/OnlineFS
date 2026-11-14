import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HREmployee, LeaveBalance, LeaveRequest } from '../lib/api';
import { LeaveSummaryForm } from './LeaveSummaryForm';

const employee = { id: 1, employeeID: 'TEST-001', fullName: 'Employee with a long name', department: 'Information Technology', section: 'Operations', position: 'Staff', employmentStatus: 'REGULAR', dateHired: '2020-01-15' } as HREmployee;
const balances = ['SL', 'VL'].map((code, index) => ({ leaveTypeId: index + 1, leaveTypeCode: code, totalCredits: 10, carryOver: 0, used: 1, pending: 1, available: 8 })) as LeaveBalance[];
const request = { id: 1, dateFiled: '2026-10-10', leaveTypeCode: 'SL', leaveTypeDescription: 'Sick Leave', dateFrom: '2026-10-12', dateTo: '2026-10-12', totalDays: 1, totalHours: 0, reason: 'Medical appointment', status: 'Approved', requestKind: 'Leave', hrRemarks: 'Reviewed supporting document', approvalSteps: [{ stepOrder: 0, stepLabel: 'Recommending', stageKind: 'RECOMMENDING', action: 'Approved', approverName: 'Test Supervisor', approverPosition: 'Supervisor' }] } as LeaveRequest;

afterEach(() => { cleanup(); vi.useRealTimers(); });
const open = (requests: LeaveRequest[] = [request], onClose = vi.fn(), profile = employee) => {
  render(<LeaveSummaryForm employee={profile} balances={balances} requests={requests} onClose={onClose}/>);
  return { mobile: within(document.querySelector<HTMLElement>('.loa-mobile-summary')!), onClose };
};

describe('mobile leave summary', () => {
  it('uses the assigned Admin department as Section / Team on screen and in print', () => {
    const { mobile } = open([], vi.fn(), { ...employee, section: '', leaveDepartmentId: 47, leaveDepartmentName: 'ASST.SUPERVISOR/TEAMLEADER' });
    expect(mobile.getByText('Section / team').nextElementSibling).toHaveTextContent('ASST.SUPERVISOR/TEAMLEADER');
    const fields = document.querySelectorAll('body > .loa-print-root .loa-line');
    expect(fields[1]).toHaveTextContent('Information Technology / ASST.SUPERVISOR/TEAMLEADER');
  });

  it('prefers the current assignment over an older Section value', () => {
    const { mobile } = open([], vi.fn(), { ...employee, section: 'Previous team', leaveDepartmentName: 'Current assigned team' });
    expect(mobile.getByText('Section / team').nextElementSibling).toHaveTextContent('Current assigned team');
  });

  it('falls back to legacy Section and avoids repeating identical department names', () => {
    const { mobile } = open([], vi.fn(), { ...employee, department: 'Operations', section: 'Operations' });
    expect(mobile.getByText('Section / team').nextElementSibling).toHaveTextContent('Operations');
    expect(document.querySelectorAll('body > .loa-print-root .loa-line')[1]?.textContent).toBe('SECTION/TEAM :Operations');
  });

  it('marks a missing assignment without inventing one', () => {
    const { mobile } = open([], vi.fn(), { ...employee, section: ' ', leaveDepartmentName: null });
    expect(mobile.getByText('Section / team').nextElementSibling).toHaveTextContent('Not assigned');
  });
  it('shows balances and readable records with expandable approval information', () => {
    const { mobile } = open();
    expect(mobile.getByRole('heading', { name: employee.fullName })).toBeInTheDocument();
    expect(mobile.getByText('Total credits').nextElementSibling).toHaveTextContent('20');
    expect(mobile.getByText('SL available').nextElementSibling).toHaveTextContent('8');
    const record = mobile.getByRole('article');
    expect(record).toHaveTextContent('Medical appointment');
    expect(record).toHaveTextContent('1 day');
    fireEvent.click(within(record).getByText('Approval details & remarks'));
    expect(record.querySelector('details')).toHaveAttribute('open');
    expect(within(record).getByText('Test Supervisor')).toBeVisible();
    expect(within(record).getByText('Reviewed supporting document')).toBeVisible();
  });

  it('shows an empty state instead of forty blank mobile rows', () => {
    const { mobile } = open([]);
    expect(mobile.getByText(/No leave records yet/)).toBeInTheDocument();
    expect(mobile.queryAllByRole('article')).toHaveLength(0);
    expect(document.querySelectorAll('body > .loa-print-root tbody tr')).toHaveLength(40);
  });

  it('keeps the same chronological forty-record limit as the printed form', () => {
    const { mobile } = open(Array.from({ length: 41 }, (_, index) => ({ ...request, id: 41 - index })));
    expect(mobile.getAllByRole('article')).toHaveLength(40);
    expect(mobile.getByText(/Showing the first 40 records/)).toBeInTheDocument();
  });

  it('closes from the visible control and Escape and identifies the dialog for focus management', () => {
    const { onClose } = open();
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /^Close$/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('prints the two A4 pages rather than the mobile cards', () => {
    vi.useFakeTimers();
    open();
    fireEvent.click(screen.getByRole('button', { name: /^Print$/ }));
    const frame = screen.getByTitle('Leave summary print document') as HTMLIFrameElement;
    const print = vi.spyOn(frame.contentWindow!, 'print').mockImplementation(() => {});
    vi.spyOn(frame.contentWindow!, 'focus').mockImplementation(() => {});
    expect(frame.contentDocument?.querySelectorAll('.loa-form')).toHaveLength(2);
    expect(frame.contentDocument?.querySelectorAll('tbody tr')).toHaveLength(40);
    expect(frame.contentDocument?.querySelector('.loa-mobile-summary')).toBeNull();
    expect(frame.contentDocument?.querySelector('style')).toHaveTextContent('@page{size:A4 portrait;margin:5mm}');
    act(() => vi.advanceTimersByTime(150));
    expect(print).toHaveBeenCalledTimes(1);
    frame.remove();
  });
});
