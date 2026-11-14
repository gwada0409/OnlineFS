# Operations and deployment

## Required production configuration

| Setting | Requirement |
|---|---|
| `JWT__SIGNINGKEY` | Required; at least 32 UTF-8 bytes; store in the host secret manager |
| `DB_PATH` | Writable persistent SQLite path; container default `/app/data/app.db` |
| `Cors__AllowedOrigins` | Comma-separated trusted origins when frontend and API are cross-origin |
| `BootstrapAdmin__Username` / `BootstrapAdmin__Password` | Optional one-time provisioning only; remove after first startup |
| Web Push keys | Configure shared keys for multi-host deployments; never commit private key material |

Production must terminate TLS at NGINX or another trusted reverse proxy. Do not expose port 5000 publicly.

## Database migration procedure

1. Announce maintenance and stop the verified AutoID backend process/container.
2. Resolve the exact `DB_PATH`; never assume a similarly named root-level `app.db` is production.
3. Copy the database plus `-wal` and `-shm` files when present to `C:\Users\g.adorio\Documents\AutoID\backups\<timestamp>`.
4. Verify the backup opens and run `PRAGMA integrity_check;` and `PRAGMA foreign_key_check;`.
5. Deploy the matching backend build. The application applies checked-in EF migrations at startup.
6. Check `/health/ready`, inspect migration errors, and run role-safe smoke checks.
7. Retain the backup until regression acceptance is complete.

Never run automated workflow tests against the production database.

## Backup and recovery

Administrators with the backend `SystemOperations` capability (`Admin` and `SystemAdmin`) can create, download, and restore backups from **System Operations → Backup & Restore**. Authorization is enforced by the API. Backup creation takes an SQLite online snapshot, pauses API operations and notification delivery while packaging the associated files, and returns a ZIP. The restore preview must pass before the administrator can type `RESTORE` and apply it. Restore also pauses API operations and notification delivery, creates an automatic pre-restore safety backup, replaces managed files and `DB_PATH`, and rolls back moved files if the swap fails. Other API requests receive `503` with a retry hint during this maintenance window. After a successful restore, background notification delivery remains paused until the backend is restarted so the restored Data Protection and Web Push keys are loaded before delivery resumes.

Each new archive contains:

- The configured SQLite database, including every application table and the applied EF migration list. SQLite backup API produces a consistent standalone database without copying live WAL/SHM files.
- Employee photos and signatures, leave attachments, uploaded templates, and pump images from the application data directory.
- `Data/settings.json`, the protected Web Push key file, and the ASP.NET Data Protection key ring from the backend user profile (`~/.aspnet/DataProtection-Keys` on Linux; `%LOCALAPPDATA%\ASP.NET\DataProtection-Keys` on Windows). The key ring is needed to unprotect the persisted Web Push key.
- A format/version manifest with a SHA-256 hash and size for each archived file.

The ZIP contains sensitive employee records and key material. Keep server-side backup storage and downloaded copies restricted to trusted administrators; encrypt copies in external storage. Linux files are created with owner-only permissions. On Windows, keep the backend user data directory under an account-restricted ACL. The API does not expose backup paths through the static-file endpoint. Old backups are retained without automatic pruning; review and remove them using the host's protected storage procedures.

Environment secrets (including `JWT__SIGNINGKEY`, VAPID overrides, database credentials, and CORS origins), deployment files, Data Protection configuration outside the default key ring, and generated output folders are not included. Maintain those separately. `AppSettings.OutputFolder` may point outside the application data directory, so generated files in that location are not collected. New archives can contain up to 20 GB of expanded data and 10 GB compressed. Compression uses the ZIP Fastest setting to reduce backup time, so files may be larger than with maximum compression. Ensure the server has temporary disk space for the database snapshot and ZIP while creating a backup. Restore needs space for the uploaded ZIP, extracted contents, candidate database, and pre-restore safety backup. Restore uploads use parallel 8 MiB chunks, stay below proxied request-body limits, allow retrying identical chunks, and expire if left incomplete for two hours. At most two uploads are active per backend process. Backup downloads stream directly to disk in browsers that support the File System Access API; other browsers use an in-memory download and may need enough available memory for the full archive. Previewed restores remain staged in the backend process for 20 minutes; preview and apply must reach the same backend instance. The current SQLite deployment uses one backend instance. Multi-instance deployment would need shared staging/session affinity and shared consistent storage, and is not supported by the present SQLite setup. A manifest detects accidental or untrusted changes only when the archive's manifest remains trustworthy; it is not a digital signature. Keep backups in trusted storage. Legacy ZIPs without a manifest can be previewed after SQLite integrity and schema checks, but do not have per-file hashes.

Cloudflare request-size limits are plan-dependent. Cloudflare documents maximum uploads of 100 MB on Free/Pro, 200 MB on Business, and up to 5 GB on Enterprise; a tunnel does not make one oversized request smaller. OnlineFS sends restore archives in 8 MiB requests to avoid that per-request cap. Backup downloads are HTTP responses and use streaming/range support; the request upload limit is not the same as a download-size limit.

Recovery using the admin interface:

1. Deploy/run a backend build that recognizes the backup's migration history. The preview rejects databases with migrations unknown to the running build; older known schemas are accepted and the checked-in migrations are applied to a staged database before it is installed. Stored employee photo/signature, template, pump, and leave-attachment paths are rebased to the current data directory.
2. Open **System Operations → Backup & Restore**, choose the ZIP, and select **Validate & Preview**. Confirm its application version, date, database size, file count, migration counts, and validation result.
3. Coordinate a maintenance window. Type `RESTORE` and apply. The system creates a safety backup before replacing data. If the operation reports failure, check the server logs by correlation/event context and confirm the safety backup is still available.
4. Restart the backend so it loads the restored Data Protection/Web Push keys and resumes notification delivery. Verify `/health/ready`, login, employee photos/signatures, leave attachments, templates, Web Push configuration, and a read-only request in each workspace. Retain the safety backup until acceptance is complete.

For manual recovery when the API cannot start, stop the backend first, preserve the failed database and data directory, extract only a verified trusted archive using a safe archive utility, and restore the database to the exact `DB_PATH` and managed data to the same backend user data/profile locations. Restore the matching Data Protection key ring and external secrets, then start a compatible backend and perform the checks above. Never restore archives from untrusted locations and never downgrade binaries against a newer schema.

## Docker deployment

From `C:\Users\g.adorio\Documents\AutoID`:

```powershell
$env:ONLINEFS_JWT_SIGNING_KEY = '<secret from your approved secret manager>'
$env:ONLINEFS_ALLOWED_ORIGINS = 'https://onlinefs.example.internal'
docker compose build
docker compose up -d
```

OnlineFS is exposed on port 8082 by default. The backend database persists in `./data`; back up that directory before upgrades. Compose intentionally fails fast if the signing key is absent.

## Release checklist

- [ ] `npm run quality` passes from a clean dependency install
- [ ] Database backup verified before a migration-bearing release
- [ ] Required secrets supplied outside source control
- [ ] TLS, hostname, origin, time zone, and persistent volume verified
- [ ] `/health/live` and `/health/ready` return Healthy
- [ ] Anonymous `/health/integrations` returns 401
- [ ] Employee, approver, HRStaff, HRManager, Admin, and SystemAdmin navigation checked
- [ ] Leave filing/attachment policy, approval/rejection, HR finalization, routing/delegation, reports, notifications, PWA update, and A4 duplex print smoke-tested with isolated data
- [ ] Rollback binary and compatible database backup identified

## Rollback

For code-only releases, redeploy the previous artifact. For schema releases, stop the backend and restore the pre-release database backup before starting the compatible prior artifact. Never downgrade application binaries against a newer, unverified schema.
