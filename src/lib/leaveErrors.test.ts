import { AxiosError } from 'axios';
import { describe, expect, it } from 'vitest';
import { getFriendlyLeaveError } from './leaveErrors';

const rejected = (message: string, status = 400) => new AxiosError('Request failed', undefined, undefined, undefined, {
  status, statusText: 'Request failed', headers: {}, config: { headers: {} } as never, data: { message }
});

describe('leave filing errors', () => {
  it('preserves the SL routing explanation that mentions the filing employee', () => {
    const message = 'Sick Leave requires HR review, an active leave department with a designated SL line leader, Recommending, and Approver, excluding the filing employee. Ask HR to configure the missing assignments.';
    expect(getFriendlyLeaveError(rejected(message))).toBe(message);
  });
  it('preserves employment eligibility and approval route instructions', () => {
    for (const message of ['Sick Leave is not available for PROBATIONARY employees.', 'No approval route is configured for this employee. Please contact HR before rescheduling leave.']) {
      expect(getFriendlyLeaveError(rejected(message))).toBe(message);
    }
  });
  it.each(['Employee not found', 'Employee record not found.', 'Employee profile not found.'])('recognizes a genuinely missing profile: %s', message => {
    expect(getFriendlyLeaveError(rejected(message, 401))).toBe('Your employee profile could not be found. Please contact HR.');
  });
  it('keeps specific attachment instructions and client validation', () => {
    expect(getFriendlyLeaveError(rejected('A medical certificate attachment is required.'))).toBe('A medical certificate attachment is required.');
    expect(getFriendlyLeaveError(new Error('Please select a leave type.'))).toBe('Please select a leave type.');
  });
  it('handles unavailable connections and database constraints', () => {
    expect(getFriendlyLeaveError(new AxiosError('Network Error'))).toContain('Unable to connect');
    expect(getFriendlyLeaveError(rejected('FOREIGN KEY constraint failed', 500))).toContain('no longer available');
  });
});
