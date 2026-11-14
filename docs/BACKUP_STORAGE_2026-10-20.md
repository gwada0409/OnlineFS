# Backup storage inventory and safeguards — 20 October 2026

## Read-only production inventory

No production files were deleted to prepare this report. Only filenames, sizes and folder totals were read; backup contents and employee databases were not downloaded.

| Saved archive | Bytes | MiB |
| --- | ---: | ---: |
| OnlineFS_Backup_20261006_033341_efd88ed2.zip | 647,573,990 | 617.6 |
| AutoID_Backup_20260916_105951.zip | 606,023,254 | 577.9 |
| AutoID_Backup_20260806_140502.zip | 535,272,910 | 510.5 |

Total saved ZIP data: **1,788,870,154 bytes (1.67 GiB)**. Free space: **3,022,438,400 bytes (2.81 GiB)**. Existing staging data: zero bytes. Managed photos occupy about 567.8 MiB and are the largest input copied into every full ZIP. Deployment release folders occupy another 4.84 GiB; these are separate rollback artifacts and are excluded from backup retention.

The oldest ZIP is a potential 510.5 MiB saving under a two-copy policy, **after recovery verification and a separate cleanup decision**. Existing archives have no new verification receipts; retention therefore protects them automatically. This report does not certify any of them as a complete current recovery copy.

## Policy

Configuration lives under `BackupStorage` in .NET configuration. Environment variables use two underscores, e.g. `BackupStorage__DryRun=true`.

| Setting | Default | Purpose |
| --- | --- | --- |
| DryRun | true | Preview retention and staging cleanup without deleting existing files |
| KeepLast | 2 | Minimum recent ZIP copies retained |
| RetainDays | 30 | Preserve recent backups unless storage pressure requires removing eligible older copies |
| MaximumStoredBytes | 3221225472 (3 GiB) | Hard limit for saved archives and incomplete archive output |
| MaximumStagingBytes | 2147483648 (2 GiB) | Limit for restore uploads and temporary work, including declared upload sizes |
| MinimumFreeBytes | 1073741824 (1 GiB) | Minimum operating reserve |
| MinimumFreePercent | 5 | Reserve is the larger of this percentage and MinimumFreeBytes |
| StagingExpiryHours | 24 | Minimum age for recognized, inactive temporary files |
| MaintenanceIntervalMinutes | 60 | Housekeeping interval; dry-run by default |

Retention protects the latest manifest-verified recovery ZIP, the newest ZIP, minimum retained copies, unverified/legacy archives and downloads/restores in use. Storage limits can refuse new work rather than delete a protected recovery copy. Limits do not retroactively remove excess data.

New backups retain the existing version-1 ZIP layout and recovery keys. They are read back for manifest hashes and SQLite integrity/schema validation before receiving an external verification receipt. Legacy archives retain their existing restore behavior; without original manifest hashes they remain ineligible for automatic retention. Archive deletion requires rechecking the protected recovery copy's recorded SHA-256.

Backup and restore preflight estimates include incompressible media, SQLite work copies, uploaded ZIPs, restore extraction, installed replacement files and the pre-restore safety ZIP. Free space is measured on the target paths, including separate filesystems. Writes recheck capacity; parallel upload declarations reserve space. Restore refusal happens before live database or managed-file replacement.

## Administrator API

All endpoints require SystemOperations authorization:

- `GET /api/backup/storage`: read-only policy, sizes, protection reasons and cleanup preview.
- `POST /api/backup/storage/verify/{name}`: validate a saved archive and record its verification status without applying a restore.
- `POST /api/backup/storage/cleanup` with `{ "dryRun": true }`: explicit preview. Actual deletion requires both `dryRun:false` in the request and `BackupStorage:DryRun=false` in server configuration. The hosted worker also obeys that configuration.

The existing create, history, download, preview and restore endpoints remain available. The UI exposes storage status and verification; no destructive cleanup button is added.

## Deployment and verification

Deployed on Linux as `/home/pgadmin/releases/backup-storage-20261020-082412`. Cleanup remains **dry-run**. The three original ZIP files retain their original names, lengths and modification timestamps; no production backup was deleted. The server reports Healthy, database integrity is `ok`, and all 35 business tables were verified after activation. The new release and rollback artifacts use additional disk space; the final reading is 92% used, with about 2.4 GiB available. The safeguards prevent backup operations from consuming their configured operating reserve; they do not reclaim existing protected data.

Final verification compared every row in all 35 business tables with the original pre-deployment snapshot: they match, including **110 employees and 28 configured departments**. Public frontend assets match the release, and anonymous backup-storage access returns 401.

Tests: **106 frontend tests**, including three backup-panel tests; **52 Windows backup/storage checks** and **53 Linux checks**. The Linux checks additionally verify that disk capacity is measured on a separate temporary filesystem. Tests cover version-1 and legacy restores, recovery keys, quota admission, aggregate upload reservations, active downloads/previews, protected-copy corruption, stale staging, unknown artifacts, symlinks and simulated mid-write disk exhaustion. Production storage preview ran with read-only mounts and proposed zero deletions.

The first activation exposed a pre-existing startup seeder that recreated 10 departments from legacy employee text and assigned 64 null `DepartmentId` values. The deployment check detected this and rolled the application back. A guarded server-side transaction restored exactly those 64 assignments and removed only the 10 startup-created, otherwise-unreferenced departments. The repair validated that unrelated business data was unchanged and retained both the original and current database backups on Linux. Ordinary startup no longer runs this routine: `BootstrapDepartments:Enabled` now defaults to **false** and must be explicitly enabled for legacy provisioning. Administrator-managed departments and leave-routing assignments are preserved.

The implementation assumes one backend process owns this backup directory. Coordinate housekeeping across instances before deploying multiple backend replicas. Free-space estimates intentionally include worst-case temporary copies and may reject an operation that could fit with better compression; use the preview, separate storage or adjusted limits rather than removing protected recovery copies.

## Separate proposal: off-server incremental backups

Use a dedicated NAS or separate backup host for a deduplicating repository, with a consistent SQLite snapshot plus managed files, settings and recovery keys. Back up those files directly rather than repeatedly packing all unchanged media into new ZIPs. Keep the full ZIP export for portable manual recovery.

A starting remote policy is seven daily, four weekly and three monthly recovery points, adjusted to the business's acceptable data loss and recovery times. Verify repository integrity and perform a restore rehearsal before retiring old copies. Restrict and encrypt backup access, retain the repository credentials separately, and isolate at least one recovery copy from application write access.

Restic supports [deduplicated snapshots](https://restic.readthedocs.io/en/stable/040_backup.html) and [retention with storage reclamation](https://restic.readthedocs.io/en/stable/060_forget.html). The repository destination, credentials, backup schedule and deletion policy need to be chosen before implementation. No off-server transfer or recurring backup job is created by this change.
