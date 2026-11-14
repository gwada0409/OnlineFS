export const WORK_START = '07:00';
export const WORK_END = '17:35';
export const WORKDAY_MINUTES = 550;
export const BREAK_WINDOWS = [
  { from: '09:50', to: '10:20', allocatedMinutes: 10 },
  { from: '11:40', to: '13:20', allocatedMinutes: 60 },
  { from: '14:50', to: '15:20', allocatedMinutes: 10 },
  { from: '17:30', to: '17:35', allocatedMinutes: 5 },
] as const;

const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

/** Work time in a selected interval, allocating actual break minutes across staggered break windows. */
export const calculateLeaveHours = (from: string, to: string): number => {
  if (!/^\d{2}:\d{2}$/.test(from) || !/^\d{2}:\d{2}$/.test(to)) return 0;
  const start = toMinutes(from);
  const end = toMinutes(to);
  if (start < toMinutes(WORK_START) || end > toMinutes(WORK_END) || end <= start) return 0;
  const allocatedBreak = BREAK_WINDOWS.reduce((total, window) => {
    const windowStart = toMinutes(window.from);
    const windowEnd = toMinutes(window.to);
    const overlap = Math.max(0, Math.min(end, windowEnd) - Math.max(start, windowStart));
    return total + overlap * window.allocatedMinutes / (windowEnd - windowStart);
  }, 0);
  return Number(((end - start - allocatedBreak) / 60).toFixed(4));
};

export const leaveBalanceDays = (hours: number) => Number((hours / WORKDAY_MINUTES * 60).toFixed(4));
