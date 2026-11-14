import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AlertTriangle, Archive, CheckCircle2, Download, RefreshCw, RotateCcw, ShieldCheck, Upload } from 'lucide-react';
import api, { getApiErrorMessage } from '../lib/api';

const MAX_BACKUP_BYTES = 10 * 1024 * 1024 * 1024;
const UPLOAD_PARALLELISM = 4;

interface FileWritable {
  write(data: Uint8Array): Promise<void>;
  close(): Promise<void>;
  abort?(): Promise<void>;
}
interface SaveFileHandle { createWritable(): Promise<FileWritable> }
type SavePicker = (options: { suggestedName: string; types: Array<{ description: string; accept: Record<string, string[]> }> }) => Promise<SaveFileHandle>;

const downloadBackup = async (method: 'GET' | 'POST', path: string, suggestedName: string, onProgress: (loaded: number, total?: number) => void) => {
  const picker = (window as Window & { showSaveFilePicker?: SavePicker }).showSaveFilePicker;
  // Call the picker before the first await so the browser can treat it as a direct user action.
  const fileHandle = picker
    ? await picker({ suggestedName, types: [{ description: 'OnlineFS backup', accept: { 'application/zip': ['.zip'] } }] })
    : null;
  const token = sessionStorage.getItem('token');
  const response = await fetch(`/api${path}`, { method, headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  if (!response.ok) {
    const message = await response.text();
    let userMessage = message;
    try {
      const parsed: unknown = JSON.parse(message);
      if (parsed && typeof parsed === 'object' && 'message' in parsed && typeof parsed.message === 'string') userMessage = parsed.message;
    } catch { /* Keep response text for non-JSON errors. */ }
    throw new Error(userMessage || `Backup download failed (${response.status}).`);
  }
  const disposition = response.headers.get('content-disposition');
  const filename = disposition?.match(/filename="?([^";]+)"?/i)?.[1] ?? suggestedName;
  if (fileHandle && response.body) {
    const writable = await fileHandle.createWritable();
    const reader = response.body.getReader();
    const total = Number(response.headers.get('content-length')) || undefined;
    let loaded = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await writable.write(value);
        loaded += value.byteLength;
        onProgress(loaded, total);
      }
      await writable.close();
    } catch (error) {
      await writable.abort?.();
      throw error;
    }
    return filename;
  }
  const blob = await response.blob();
  onProgress(blob.size, blob.size);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return filename;
};

interface BackupFile {
  name: string;
  size: number;
  createdAt: string;
}

interface StorageReport {
  dryRun: boolean;
  storedBytes: number;
  stagingBytes: number;
  availableBytes: number;
  reservedFreeBytes: number;
  proposedBackupCleanupBytes: number;
  proposedStagingCleanupBytes: number;
  latestVerifiedBackup: string | null;
  policy: { maximumStoredBytes: number; maximumStagingBytes: number; keepLast: number; retainDays: number };
  backups: Array<{ name: string; verified: boolean; protected: boolean; proposedForCleanup: boolean; reason: string }>;
  warnings: string[];
}

interface BackupPreview {
  restoreId: string;
  fileName: string;
  createdAt: string;
  databaseSize: number;
  fileCount: number;
  format: string;
  applicationVersion: string;
  appliedMigrations: string[];
  pendingMigrations: string[];
  hasIntegrityManifest: boolean;
}

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = -1;
  do { value /= 1024; unit++; } while (value >= 1024 && unit < units.length - 1);
  return `${value.toFixed(1)} ${units[unit]}`;
};

const getDownloadError = async (error: unknown, fallback: string) => {
  if (error && typeof error === 'object' && 'response' in error) {
    const data = (error as { response?: { data?: unknown } }).response?.data;
    if (data instanceof Blob) {
      try {
        const parsed: unknown = JSON.parse(await data.text());
        if (parsed && typeof parsed === 'object') {
          const body = parsed as Record<string, unknown>;
          for (const key of ['message', 'detail', 'title', 'error'])
            if (typeof body[key] === 'string' && body[key]) return body[key] as string;
        }
        return fallback;
      } catch { return fallback; }
    }
  }
  return getApiErrorMessage(error, fallback);
};

export const BackupRestorePanel = () => {
  const [history, setHistory] = useState<BackupFile[]>([]);
  const [storage, setStorage] = useState<StorageReport | null>(null);
  const [storageError, setStorageError] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState<'create' | 'history' | 'preview' | 'restore' | string | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const refreshHistory = useCallback(async () => {
    setBusy(current => current === null ? 'history' : current);
    try {
      const response = await api.get<BackupFile[]>('/backup/history');
      setHistory(response.data);
      try {
        const report = await api.get<StorageReport>('/backup/storage');
        setStorage(report.data); setStorageError('');
      } catch (reportError) { setStorageError(getApiErrorMessage(reportError, 'Storage report is unavailable.')); }
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Could not load backup history.'));
    } finally {
      setBusy(current => current === 'history' ? null : current);
    }
  }, []);

  useEffect(() => { void refreshHistory(); }, [refreshHistory]);

  const createBackup = async () => {
    setBusy('create'); setError(''); setStatus('Pausing API work briefly while a consistent database snapshot and application files are packaged…');
    try {
      const suggestedName = `OnlineFS_Backup_${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}.zip`;
      const filename = await downloadBackup('POST', '/backup/create', suggestedName, (loaded, total) => {
        setStatus(total ? `Downloading backup to disk… ${Math.min(99, Math.floor(loaded * 100 / total))}%` : `Downloading backup to disk… ${formatBytes(loaded)}`);
      });
      setStatus(`Backup created and downloaded: ${filename}`);
      await refreshHistory();
    } catch (requestError) {
      setStatus('');
      if (!(requestError instanceof DOMException && requestError.name === 'AbortError')) setError(await getDownloadError(requestError, 'Backup creation failed.'));
    } finally { setBusy(null); }
  };

  const downloadExisting = async (backup: BackupFile) => {
    setBusy(backup.name); setError(''); setStatus('');
    try {
      await downloadBackup('GET', `/backup/download/${encodeURIComponent(backup.name)}`, backup.name, (loaded, total) => {
        setStatus(total ? `Downloading ${backup.name}… ${Math.min(99, Math.floor(loaded * 100 / total))}%` : `Downloading ${backup.name}… ${formatBytes(loaded)}`);
      });
      setStatus(`Downloaded ${backup.name}.`);
    } catch (requestError) {
      setStatus('');
      if (!(requestError instanceof DOMException && requestError.name === 'AbortError')) setError(await getDownloadError(requestError, 'Backup download failed.'));
    }
    finally { setBusy(null); }
  };

  const verifyExisting = async (backup: BackupFile) => {
    setBusy(`verify:${backup.name}`); setError(''); setStatus('Checking archive integrity and database compatibility…');
    try {
      const response = await api.post<StorageReport>(`/backup/storage/verify/${encodeURIComponent(backup.name)}`);
      setStorage(response.data);
      setStatus('Validation completed. Legacy archives without manifest hashes remain protected from automatic cleanup.');
    } catch (requestError) { setStatus(''); setError(getApiErrorMessage(requestError, 'Backup verification failed.')); }
    finally { setBusy(null); }
  };

  const previewRestore = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile) { setError('Choose a backup ZIP file first.'); return; }
    if (selectedFile.size > MAX_BACKUP_BYTES) { setError('Backup exceeds the 10 GB limit.'); return; }
    setBusy('preview'); setError(''); setStatus('Starting a secure, resumable chunked upload…'); setPreview(null); setConfirmation('');
    let uploadId: string | undefined;
    try {
      const upload = await api.post<{ uploadId: string; chunkSize: number; chunkCount: number }>('/backup/restore/uploads', {
        fileName: selectedFile.name,
        totalLength: selectedFile.size
      });
      ({ uploadId } = upload.data);
      const { chunkSize, chunkCount } = upload.data;
      const uploadedBytes = new Array<number>(chunkCount).fill(0);
      let nextChunk = 0;
      let firstChunkError: unknown;
      const uploadWorker = async () => {
        while (!firstChunkError) {
          const chunkIndex = nextChunk++;
          if (chunkIndex >= chunkCount) return;
          const start = chunkIndex * chunkSize;
          const chunk = selectedFile.slice(start, Math.min(start + chunkSize, selectedFile.size));
          let attempt = 0;
          while (true) {
            try {
              await api.put(`/backup/restore/uploads/${uploadId}/chunks/${chunkIndex}`, chunk, {
                headers: { 'Content-Type': 'application/octet-stream' },
                onUploadProgress: event => {
                  uploadedBytes[chunkIndex] = Math.min(chunk.size, event.loaded);
                  const loaded = uploadedBytes.reduce((sum, value) => sum + value, 0);
                  setStatus(`Uploading backup… ${Math.floor(loaded * 100 / selectedFile.size)}% (${formatBytes(loaded)} of ${formatBytes(selectedFile.size)})`);
                }
              });
              uploadedBytes[chunkIndex] = chunk.size;
              const loaded = uploadedBytes.reduce((sum, value) => sum + value, 0);
              setStatus(`Uploading backup… ${Math.floor(loaded * 100 / selectedFile.size)}% (${formatBytes(loaded)} of ${formatBytes(selectedFile.size)})`);
              break;
            } catch (chunkError) {
              const statusCode = (chunkError as { response?: { status?: number } })?.response?.status;
              const retryable = !statusCode || statusCode === 408 || statusCode === 429 || statusCode >= 500;
              if (!retryable || attempt >= 3) throw chunkError;
              attempt++;
              setStatus(`Retrying upload part ${chunkIndex + 1} of ${chunkCount}…`);
              await new Promise(resolve => window.setTimeout(resolve, 500 * attempt));
            }
          }
        }
      };
      const workers = await Promise.allSettled(Array.from({ length: Math.min(UPLOAD_PARALLELISM, chunkCount) }, () => uploadWorker().catch(error => { firstChunkError ??= error; })));
      const failedWorker = workers.find(worker => worker.status === 'rejected');
      if (firstChunkError) throw firstChunkError;
      if (failedWorker?.status === 'rejected') throw failedWorker.reason;
      setStatus('Upload complete. Checking archive integrity, database integrity, and schema compatibility…');
      const response = await api.post<BackupPreview>(`/backup/restore/uploads/${uploadId}/complete`);
      setPreview(response.data);
      setStatus('Backup validated. Review the contents and confirm below to replace current application data.');
    } catch (requestError) {
      if (uploadId) await api.delete(`/backup/restore/uploads/${uploadId}`).catch(() => undefined);
      setStatus(''); setError(getApiErrorMessage(requestError, 'Backup validation failed.'));
    }
    finally { setBusy(null); }
  };

  const previewSavedRestore = async (backup: BackupFile) => {
    setBusy(`preview:${backup.name}`); setError(''); setStatus('Validating saved backup, database integrity, and schema compatibility…'); setPreview(null); setConfirmation('');
    try {
      const response = await api.post<BackupPreview>('/backup/restore/preview-saved', { name: backup.name });
      setPreview(response.data);
      setStatus('Saved backup validated. Review the contents and confirm below to replace current application data.');
    } catch (requestError) { setStatus(''); setError(getApiErrorMessage(requestError, 'Backup validation failed.')); }
    finally { setBusy(null); }
  };

  const applyRestore = async () => {
    if (!preview || confirmation !== 'RESTORE') return;
    setBusy('restore'); setError(''); setStatus('Applying restore. OnlineFS requests will be paused briefly…');
    try {
      const response = await api.post<{ message: string; safetyBackupName: string; restoredFiles: number; completedAt: string; warning?: string }>('/backup/restore/apply', {
        restoreId: preview.restoreId,
        confirmation
      });
      setStatus(`${response.data.message} Safety copy: ${response.data.safetyBackupName}. Restored ${response.data.restoredFiles} files.${response.data.warning ? ` Notice: ${response.data.warning}` : ''}`);
      setPreview(null); setSelectedFile(null); setConfirmation('');
      await refreshHistory();
    } catch (requestError) { setStatus(''); setError(getApiErrorMessage(requestError, 'Restore failed. Current data was retained when rollback succeeded.')); }
    finally { setBusy(null); }
  };

  const disabled = busy !== null;
  return <section className="glass-card space-y-5" aria-labelledby="backup-restore-title">
    <div className="glass-card-header flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3"><Archive size={20} className="text-primary mt-1" /><div>
        <h2 id="backup-restore-title">Backup &amp; Restore</h2>
        <p className="text-xs text-muted mt-1">Create a protected application backup or preview a recovery before applying it. Large restore uploads use parallel 8 MB parts to stay below Cloudflare’s per-request limit.</p>
      </div></div>
      <button className="btn btn-primary" onClick={() => void createBackup()} disabled={disabled}>
        {busy === 'create' ? <span className="spinner" /> : <Download size={16} />}{busy === 'create' ? 'Creating…' : 'Create & Download Backup'}
      </button>
    </div>

    {(error || status) && <div role={error ? 'alert' : 'status'} className={`rounded-lg border p-3 text-sm ${error ? 'border-danger text-danger' : 'border-border text-muted'}`}>
      {error ? <AlertTriangle size={16} className="inline mr-2" /> : <CheckCircle2 size={16} className="inline mr-2 text-success" />}{error || status}
    </div>}

    <div className="rounded-lg border border-border p-4 space-y-2">
      <div className="flex items-center gap-2 font-semibold"><ShieldCheck size={16} className="text-primary" /> Included in a backup</div>
      <p className="text-xs text-muted">SQLite database and all records, employee photos and signatures, leave attachments, templates, pump images, application settings, persisted Web Push keys, and the Data Protection key ring needed to read those protected keys. Backups contain sensitive employee and application data; store downloaded copies in restricted encrypted storage.</p>
      <p className="text-xs text-muted">Environment secrets (including JWT signing keys), deployment files, and generated output folders are not included. Keep the deployment configuration and secret manager recovery process available separately.</p>
    </div>

    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold">Saved backups</h3><p className="text-xs text-muted">Stored in the backend’s private backup directory.</p></div>
        <button className="btn btn-outline btn-sm" onClick={() => void refreshHistory()} disabled={disabled}><RefreshCw size={14} /> Refresh</button></div>
      {storageError && <p role="status" className="text-sm text-warning">{storageError}</p>}
      {storage && <div className="rounded-lg border border-border p-4 space-y-3" aria-label="Backup storage report">
        <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">Backup storage</strong><span className="text-xs text-muted">{storage.dryRun ? 'Cleanup preview only — no files deleted' : 'Retention cleanup enabled'}</span></div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div><dt className="text-xs text-muted">Saved backups / limit</dt><dd>{formatBytes(storage.storedBytes)} / {formatBytes(storage.policy.maximumStoredBytes)}</dd></div>
          <div><dt className="text-xs text-muted">Temporary files / limit</dt><dd>{formatBytes(storage.stagingBytes)} / {formatBytes(storage.policy.maximumStagingBytes)}</dd></div>
          <div><dt className="text-xs text-muted">Disk free / operating reserve</dt><dd>{formatBytes(storage.availableBytes)} / {formatBytes(storage.reservedFreeBytes)}</dd></div>
          <div><dt className="text-xs text-muted">Proposed cleanup</dt><dd>{formatBytes(storage.proposedBackupCleanupBytes + storage.proposedStagingCleanupBytes)}</dd></div>
        </dl>
        <p className="text-xs text-muted break-all">Protected recovery copy: {storage.latestVerifiedBackup ?? 'No manifest-verified copy recorded yet'}. Retains at least {storage.policy.keepLast} recent copies and backups within {storage.policy.retainDays} days, subject to the storage limit.</p>
        {storage.warnings.map(warning => <p key={warning} className="text-sm text-warning">{warning}</p>)}
      </div>}
      {history.length ? <div className="divide-y divide-border rounded-lg border border-border">
        {history.map(backup => <div key={backup.name} className="flex flex-wrap items-center justify-between gap-3 p-3">
          <div className="min-w-0 flex-1"><div className="font-medium break-all">{backup.name}</div><div className="text-xs text-muted">{formatBytes(backup.size)} · {new Date(backup.createdAt).toLocaleString()}</div>
            {storage?.backups.find(item => item.name === backup.name)?.reason && <p className="text-xs text-muted">{storage.backups.find(item => item.name === backup.name)?.reason}</p>}
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button className="btn btn-outline btn-sm" onClick={() => void verifyExisting(backup)} disabled={disabled}><ShieldCheck size={14} />{busy === `verify:${backup.name}` ? 'Verifying…' : 'Verify'}</button>
            <button className="btn btn-outline btn-sm" onClick={() => void downloadExisting(backup)} disabled={disabled}><Download size={14} />{busy === backup.name ? 'Downloading…' : 'Download'}</button>
            <button className="btn btn-outline btn-sm" onClick={() => void previewSavedRestore(backup)} disabled={disabled}><RotateCcw size={14} />{busy === `preview:${backup.name}` ? 'Validating…' : 'Restore'}</button>
          </div>
        </div>)}
      </div> : <p className="rounded-lg border border-border p-4 text-sm text-muted">{busy === 'history' ? 'Loading backup history…' : 'No saved backups yet.'}</p>}
    </div>

    <form onSubmit={previewRestore} className="space-y-3 border-t border-border pt-5">
      <div><h3 className="font-semibold">Restore from a backup</h3><p className="text-xs text-muted mt-1">Select a backup file to validate it and review its contents. Preview expires after 20 minutes.</p></div>
      <div className="flex flex-wrap items-center gap-3">
        <input className="form-input min-w-0 flex-1" aria-label="Backup ZIP file" type="file" accept=".zip,application/zip" disabled={disabled} onChange={event => { setSelectedFile(event.target.files?.[0] ?? null); setPreview(null); setConfirmation(''); setError(''); }} />
        <button className="btn btn-outline" type="submit" disabled={disabled || !selectedFile}>{busy === 'preview' ? <span className="spinner" /> : <Upload size={16} />}{busy === 'preview' ? 'Validating…' : 'Validate & Preview'}</button>
      </div>
    </form>

    {preview && <div className="rounded-lg border border-border p-4 space-y-4">
      <div className="flex items-start gap-2"><CheckCircle2 size={18} className="text-success mt-0.5" /><div><h3 className="font-semibold">Backup passed validation</h3><p className="text-xs text-muted break-all">{preview.fileName} · {preview.format}</p></div></div>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div><dt className="text-xs text-muted">Created</dt><dd>{new Date(preview.createdAt).toLocaleString()}</dd></div>
        <div><dt className="text-xs text-muted">Database size</dt><dd>{formatBytes(preview.databaseSize)}</dd></div>
        <div><dt className="text-xs text-muted">Files in backup</dt><dd>{preview.fileCount}</dd></div>
        <div><dt className="text-xs text-muted">Backup app version</dt><dd>{preview.applicationVersion}</dd></div>
        <div><dt className="text-xs text-muted">Applied database migrations</dt><dd>{preview.appliedMigrations.length}</dd></div>
        <div><dt className="text-xs text-muted">Migrations to apply during restore</dt><dd>{preview.pendingMigrations.length}</dd></div>
      </dl>
      {!preview.hasIntegrityManifest && <p className="text-xs text-warning">This is a legacy archive. SQLite integrity and compatibility passed, but the archive has no manifest hashes.</p>}
      {preview.pendingMigrations.length > 0 && <p className="text-xs text-muted">These checked-in migrations will be applied to the staged database before it replaces current data: {preview.pendingMigrations.slice(0, 4).join(', ')}{preview.pendingMigrations.length > 4 ? '…' : ''}</p>}
      {!preview.hasIntegrityManifest && <p className="text-xs text-muted">Legacy backups may not contain newer managed-file categories; files omitted from the archive will be preserved from the current installation.</p>}
      <div className="rounded-lg border border-danger/40 p-3 space-y-3">
        <p className="text-sm"><strong className="text-danger">This replaces current application data.</strong> The current database and managed files will be saved to a new safety backup first. Active API work will pause during the restore.</p>
        <label className="form-label block" htmlFor="restore-confirmation">Type <code>RESTORE</code> to apply this backup</label>
        <div className="flex flex-wrap gap-2">
          <input id="restore-confirmation" className="form-input" value={confirmation} disabled={disabled} onChange={event => setConfirmation(event.target.value)} autoComplete="off" />
          <button type="button" className="btn btn-danger" onClick={() => void applyRestore()} disabled={disabled || confirmation !== 'RESTORE'}><RotateCcw size={16} />{busy === 'restore' ? 'Restoring…' : 'Restore Backup'}</button>
        </div>
      </div>
    </div>}
  </section>;
};
