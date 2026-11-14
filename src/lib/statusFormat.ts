export const leaveStatusBadgeClass = (status: string): string => {
  switch (status.trim().toLowerCase()) {
    case 'approved': return 'badge-approved';
    case 'disapproved': return 'badge-disapproved';
    case 'cancelled':
    case 'rescheduled': return 'badge-cancelled';
    default: return 'badge-pending';
  }
};

export const leaveStatusLabel = (status: string, requestKind?: string): string => {
  if (requestKind === 'Cancellation' && status.trim().toLowerCase() === 'approved')
    return 'APPROVE CANCELLED';
  if (status.trim().toLowerCase() === 'pending employee details') return 'Waiting for Employee Details';
  return status.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^Pending(?=\S)/, 'Pending ').trim();
};

export const isApprovedLeaveForYear = (
  request: { status: string; requestKind?: string; dateFiled: string },
  year: number
): boolean => request.status === 'Approved'
  && request.requestKind !== 'Cancellation'
  && new Date(request.dateFiled).getFullYear() === year;

export const canRequestLeaveChange = (leaveTypeCode?: string): boolean =>
  ['VL', 'HDL'].includes((leaveTypeCode || '').trim().toUpperCase());

export const leaveChangeDateIsOpen = (dateTo: string, today = new Date()): boolean => {
  const endDate = dateTo.slice(0, 10);
  const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(endDate) && endDate >= localToday;
};

export const isPendingLeaveStatus = (status?: string): boolean =>
  (status || '').trim().toLowerCase().startsWith('pending');
