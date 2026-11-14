import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../lib/api';
import { BackupRestorePanel } from './BackupRestorePanel';

vi.mock('../lib/api', () => ({ default: { get: vi.fn(), post: vi.fn() }, getApiErrorMessage: (error: Error) => error.message }));
const name = 'OnlineFS_Backup_fixture.zip';
const report = {
  dryRun: true, storedBytes: 1024, stagingBytes: 0, availableBytes: 10 * 1024 ** 3, reservedFreeBytes: 1024 ** 3,
  proposedBackupCleanupBytes: 0, proposedStagingCleanupBytes: 0, latestVerifiedBackup: name,
  policy: { maximumStoredBytes: 3 * 1024 ** 3, maximumStagingBytes: 2 * 1024 ** 3, keepLast: 2, retainDays: 30 },
  backups: [{ name, verified: true, protected: true, proposedForCleanup: false, reason: 'Latest verified recovery copy.' }], warnings: [],
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.get).mockImplementation(async path => ({ data: path === '/backup/storage' ? report : [{ name, size: 1024, createdAt: '2026-10-20T00:00:00Z' }] }) as any);
  vi.mocked(api.post).mockResolvedValue({ data: report });
});
afterEach(cleanup);

describe('backup storage visibility', () => {
  it('shows capacity, protection and dry-run status without requesting cleanup', async () => {
    render(<BackupRestorePanel />);
    expect(await screen.findByLabelText('Backup storage report')).toHaveTextContent('Cleanup preview only — no files deleted');
    expect(screen.getByText('Latest verified recovery copy.')).toBeVisible();
    expect(screen.getByLabelText('Backup storage report')).toHaveTextContent('3.0 GB');
    expect(api.post).not.toHaveBeenCalled();
  });
  it('verifies a saved copy without restoring or deleting it', async () => {
    render(<BackupRestorePanel />);
    await screen.findByLabelText('Backup storage report');
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(`/backup/storage/verify/${name}`));
    expect(await screen.findByText(/Validation completed/)).toBeVisible();
    expect(api.post).toHaveBeenCalledTimes(1);
  });
  it('keeps saved backup actions available if storage reporting fails', async () => {
    vi.mocked(api.get).mockImplementation(async path => {
      if (path === '/backup/storage') throw new Error('Storage report is unavailable.');
      return { data: [{ name, size: 1024, createdAt: '2026-10-20T00:00:00Z' }] } as any;
    });
    render(<BackupRestorePanel />);
    expect(await screen.findByText('Storage report is unavailable.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Download' })).toBeEnabled();
    expect(api.post).not.toHaveBeenCalled();
  });
});
