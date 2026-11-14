import { describe, expect, it } from 'vitest';
import { canRequestLeaveChange, isApprovedLeaveForYear, isPendingLeaveStatus, leaveStatusBadgeClass, leaveStatusLabel } from './statusFormat';

describe('leave status presentation', () => {
  it.each([
    ['Approved', 'badge-approved'],
    ['Disapproved', 'badge-disapproved'],
    ['Cancelled', 'badge-cancelled'],
    ['Rescheduled', 'badge-cancelled'],
    ['PendingTeamLeader', 'badge-pending']
  ])('maps %s to %s', (status, expected) => {
    expect(leaveStatusBadgeClass(status)).toBe(expected);
  });

  it('turns workflow status identifiers into readable labels', () => {
    expect(leaveStatusLabel('PendingHRSection')).toBe('Pending HRSection');
    expect(leaveStatusLabel('Pending Team Leader')).toBe('Pending Team Leader');
    expect(leaveStatusLabel('Pending Employee Details')).toBe('Waiting for Employee Details');
  });

  it('distinguishes an approved cancellation workflow from approved leave', () => {
    expect(leaveStatusLabel('Approved', 'Cancellation')).toBe('APPROVE CANCELLED');
    expect(leaveStatusLabel('Approved', 'Leave')).toBe('Approved');
  });

  it('excludes cancellation workflows from approved leave totals', () => {
    const dateFiled = '2026-09-15T12:00:00';
    expect(isApprovedLeaveForYear({ status: 'Approved', requestKind: 'Cancellation', dateFiled }, 2026)).toBe(false);
    expect(isApprovedLeaveForYear({ status: 'Approved', requestKind: 'Leave', dateFiled }, 2026)).toBe(true);
    expect(isApprovedLeaveForYear({ status: 'Approved', requestKind: 'Reschedule', dateFiled }, 2026)).toBe(true);
  });
});

describe('leave change policy', () => {
  it('allows only Vacation Leave and Half-Day Leave', () => {
    expect(canRequestLeaveChange('VL')).toBe(true);
    expect(canRequestLeaveChange('hdl')).toBe(true);
    expect(canRequestLeaveChange('SL')).toBe(false);
    expect(canRequestLeaveChange('UT')).toBe(false);
  });
});

describe('pending leave status', () => {
  it('does not classify completed workflow statuses as pending', () => {
    expect(isPendingLeaveStatus('Pending Team Leader')).toBe(true);
    expect(isPendingLeaveStatus('Rescheduled')).toBe(false);
    expect(isPendingLeaveStatus('Approved')).toBe(false);
    expect(isPendingLeaveStatus('Cancelled')).toBe(false);
  });
});
