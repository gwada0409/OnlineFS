import { getApiErrorMessage } from './api';

export const getFriendlyLeaveError = (error: unknown): string => {
  const message = getApiErrorMessage(error, 'The leave request could not be filed. Please try again.');
  const normalized = message.trim().toLowerCase().replace(/[.!]+$/, '');

  // Match actual missing-profile errors, not policy/routing messages that
  // mention the filing employee. Those messages tell HR what needs fixing.
  if (['employee not found', 'employee record not found', 'employee profile not found'].includes(normalized)) {
    return 'Your employee profile could not be found. Please contact HR.';
  }
  if (normalized.includes('foreign key')) {
    return 'Some leave request information is invalid or no longer available. Refresh the page and try again.';
  }
  if (normalized.includes('row-level security')) {
    return 'You do not have permission to file this leave request.';
  }
  return message;
};
