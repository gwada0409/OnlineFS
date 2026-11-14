import { describe, expect, it } from 'vitest';
import { calculateLeaveHours, leaveBalanceDays } from './leaveTime';

describe('HDL and UT time calculations', () => {
  it('calculates morning HDL work time without deducting the break', () => {
    expect(calculateLeaveHours('07:00', '12:00')).toBe(4.6333);
  });

  it('calculates afternoon HDL work time without deducting the break', () => {
    expect(calculateLeaveHours('13:25', '17:35')).toBe(3.9167);
  });

  it('counts a full schedule as 9 hours 10 minutes and maps hours to a leave-day fraction', () => {
    expect(calculateLeaveHours('07:00', '17:35')).toBe(9.1667);
    expect(leaveBalanceDays(4.5833)).toBe(0.5);
  });

  it('rejects ranges outside the work schedule and reversed/empty ranges', () => {
    expect(calculateLeaveHours('06:59', '08:00')).toBe(0);
    expect(calculateLeaveHours('16:00', '17:36')).toBe(0);
    expect(calculateLeaveHours('10:00', '09:00')).toBe(0);
  });

  it('does not subtract whole stagger windows, only each employee break allocation', () => {
    expect(calculateLeaveHours('09:50', '10:20')).toBe(0.3333);
    expect(calculateLeaveHours('11:40', '13:20')).toBe(0.6667);
    expect(calculateLeaveHours('17:30', '17:35')).toBe(0);
  });
});
