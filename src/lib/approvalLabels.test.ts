import { describe, expect, it } from 'vitest';
import { approvalStageLabel, notificationCopy } from './approvalLabels';

describe('approval stage labels', () => {
  it('renames legacy configured stages without changing the workflow data', () => {
    expect(approvalStageLabel('1st Approver')).toBe('Recommending');
    expect(approvalStageLabel('2nd Approver')).toBe('Approver');
    expect(approvalStageLabel('Manager Review')).toBe('Manager Review');
  });

  it('uses the updated labels for unnamed stages', () => {
    expect(approvalStageLabel('', 0)).toBe('Recommending');
    expect(approvalStageLabel('', 1)).toBe('Approver');
  });

  it('removes request-number wording from notification copy', () => {
    expect(notificationCopy('Leave Request #123 needs 2nd Approver action'))
      .toBe('Leave Request needs Approver action');
  });
});
