import { describe, expect, it } from 'vitest';
import { canViewPendingApprovals, legacyCapabilities, type User } from './AuthContext';

const user = (role: string, extra: Partial<User> = {}): User => ({ id: 1, username: role, role, ...extra });

describe('role navigation capabilities', () => {
  it('keeps personal navigation away from administrative accounts', () => {
    expect(legacyCapabilities(user('Admin'))).not.toContain('PersonalLeave');
    expect(legacyCapabilities(user('SystemAdmin'))).not.toContain('PersonalLeave');
  });

  it('grants HR workspaces at the correct boundary', () => {
    expect(legacyCapabilities(user('HRStaff'))).toEqual(expect.arrayContaining(['PersonalLeave', 'HROperations']));
    expect(legacyCapabilities(user('HRManager'))).toEqual(expect.arrayContaining(['PersonalLeave', 'HROperations', 'HRManagement']));
    expect(legacyCapabilities(user('Employee'))).not.toContain('HROperations');
  });

  it('shows approvals only to users with the approval capability', () => {
    expect(canViewPendingApprovals(user('Employee', { isApprover: true }))).toBe(true);
    expect(canViewPendingApprovals(user('Admin', { isApprover: true }))).toBe(false);
    expect(canViewPendingApprovals(user('Employee', { capabilities: [] }))).toBe(false);
    expect(canViewPendingApprovals(user('Employee', { capabilities: ['Approvals'] }))).toBe(true);
  });
});
