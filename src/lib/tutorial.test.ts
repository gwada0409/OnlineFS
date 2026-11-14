import { describe, expect, it } from 'vitest';
import { getTutorialSteps, tutorialStorageKey } from './tutorial';

const ids = (capabilities: string[]) => getTutorialSteps(capabilities).map(step => step.id);

describe('role-aware tutorial', () => {
  it('shows only personal features to an employee', () => {
    expect(ids(['PersonalLeave'])).toEqual(['welcome', 'personal', 'file-leave', 'requests', 'notifications', 'theme', 'restart']);
  });
  it('includes delegated approval access independently of role names', () => {
    expect(ids(['Approvals'])).toContain('approvals');
    expect(ids(['Approvals'])).not.toContain('personal');
  });
  it('keeps HR management and system controls out of a staff tutorial', () => {
    const staff = ids(['PersonalLeave', 'HROperations']);
    expect(staff).toEqual(expect.arrayContaining(['hr', 'employment', 'departments', 'delegation']));
    expect(staff).not.toEqual(expect.arrayContaining(['policies']));
    expect(staff).not.toContain('system');
    expect(staff).not.toContain('roles');
  });
  it('shows manager policies and reserves role management for its capability', () => {
    expect(ids(['HROperations', 'HRManagement'])).toContain('policies');
    expect(ids(['SystemOperations'])).not.toContain('roles');
    expect(ids(['SystemOperations', 'UserRoleManagement'])).toEqual(expect.arrayContaining(['system', 'health', 'roles']));
  });
  it('never assumes personal or approval access for an administrator', () => {
    const admin = ids(['HROperations', 'HRManagement', 'SystemOperations', 'UserRoleManagement']);
    for (const id of ['personal', 'requests', 'file-leave', 'approvals']) expect(admin).not.toContain(id);
  });
  it('has only common controls for an account without business capabilities', () => {
    expect(ids([])).toEqual(['welcome', 'notifications', 'theme', 'restart']);
    expect(ids(['HRManagement'])).not.toContain('policies');
  });
  it('stores discovery preferences separately for accounts and changed permissions', () => {
    expect(tutorialStorageKey(1, ['Approvals', 'PersonalLeave'])).toBe(tutorialStorageKey(1, ['PersonalLeave', 'Approvals']));
    expect(tutorialStorageKey(1, [])).not.toBe(tutorialStorageKey(2, []));
    expect(tutorialStorageKey(1, [])).not.toBe(tutorialStorageKey(1, ['PersonalLeave']));
  });
});
