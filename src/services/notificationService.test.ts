import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('notification performance contract', () => {
  const service = readFileSync(resolve(process.cwd(), 'src/services/notificationService.ts'), 'utf8');
  const page = readFileSync(resolve(process.cwd(), 'src/pages/NotificationsPage.tsx'), 'utf8');
  const bell = readFileSync(resolve(process.cwd(), 'src/components/NotificationBell.tsx'), 'utf8');

  it('batches legacy real-time invalidations instead of refreshing per event', () => {
    expect(service).toContain("connection.on('NotificationCreated', scheduleRefresh)");
    expect(service).toContain('window.setTimeout');
  });

  it('uses bounded pages for the center and notification bell', () => {
    expect(page).toContain('nextPage, 30');
    expect(page).toContain('Load more');
    expect(bell).toContain('1, 10');
    expect(service).not.toContain('pageSize: 100');
  });
});
