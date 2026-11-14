# Linux disk cleanup assessment — 2026-10-20

Read-only inspection of 192.168.2.137. No server files were deleted, transferred off-server, or changed.

Filesystem: **92% used; 2.40 GiB available** on the 30G root filesystem.

## Recommended first pass

Identified file candidates total **1.95 GiB**, plus approximately **201 MiB private Docker build cache**. Expected combined recovery is about **2.15 GiB**; remeasure after cleanup. Docker shared-layer estimates are not additive.

### Verified redundant backup copies

These old-release ZIPs have SHA-256 hashes identical to the retained ZIPs in the active backup directory. Delete only the redundant paths, retaining the listed counterparts. This establishes duplicate identity, not a new restore validation.

- Redundant: `/home/pgadmin/releases/20260916-1105/backup/AutoID_Data_Data/Backups/AutoID_Backup_20260806_140502.zip` — 510.5 MiB.
  Retain: `/home/pgadmin/AutoID/AutoID_Data/Data/Backups/AutoID_Backup_20260806_140502.zip`.
  Matching SHA-256: `05a141b2f93f6299b5ce0b4df3a9b3f8e95bc6601aab26fe4ad90ab32171145a`.
- Redundant: `/home/pgadmin/releases/20260916-1105/backup/AutoID_Data_Data/Backups/AutoID_Backup_20260916_105951.zip` — 577.9 MiB.
  Retain: `/home/pgadmin/AutoID/AutoID_Data/Data/Backups/AutoID_Backup_20260916_105951.zip`.
  Matching SHA-256: `659acc4155315190a7f17319f6aa82e54a2d9e8b651b8f2331643e5b73d5efb5`.

### Reinstallable frontend dependencies

Neither directory is a mount of any current container. Keep package.json and package-lock.json so dependencies can be installed again.

- `/home/pgadmin/AutoID/autoid-web/node_modules` — 200.4 MiB.
- `/home/pgadmin/releases/20260916-1105/backup/OnlineFS-old/node_modules` — 124.6 MiB.

### Superseded deployment artifacts

Only the following build outputs and uploaded build bundles are candidates. Keep their parent folders, source snapshots, database files, keys, manifests and verification records. Current release and preceding security release are excluded. Current containers use baked images; none mounts these release paths. Removing these files reduces the ability to rebuild older releases from their ready-made binaries.

- `/home/pgadmin/releases/approval-labels-20261006/dist` — 3.1 MiB.
- `/home/pgadmin/releases/approval-labels-20261006/release.tgz` — 2.1 MiB.
- `/home/pgadmin/releases/backup-storage-20261020-081520/dist` — 3.2 MiB.
- `/home/pgadmin/releases/backup-storage-20261020-081520/publish` — 81.3 MiB.
- `/home/pgadmin/releases/backup-storage-20261020-081520/release.tar.gz` — 34.0 MiB.
- `/home/pgadmin/releases/department-space-20261007-080007/dist` — 3.1 MiB.
- `/home/pgadmin/releases/department-space-20261007-080007/release.tgz` — 2.2 MiB.
- `/home/pgadmin/releases/employee-hub-20261006-104813/dist` — 3.1 MiB.
- `/home/pgadmin/releases/employee-hub-20261006-104813/release.tgz` — 2.2 MiB.
- `/home/pgadmin/releases/leave-error-fix-20261019-084913/dist` — 3.1 MiB.
- `/home/pgadmin/releases/leave-error-fix-20261019-084913/frontend.tar.gz` — 2.2 MiB.
- `/home/pgadmin/releases/leave-progress-20261006/dist` — 3.1 MiB.
- `/home/pgadmin/releases/leave-progress-20261006/release.tgz` — 2.1 MiB.
- `/home/pgadmin/releases/leave-summary-mobile-20261019-141047/dist` — 3.2 MiB.
- `/home/pgadmin/releases/leave-summary-mobile-20261019-141047/frontend.tar.gz` — 2.2 MiB.
- `/home/pgadmin/releases/leave-workflow-20261008-155204/dist` — 3.1 MiB.
- `/home/pgadmin/releases/leave-workflow-20261008-155204/publish` — 70.6 MiB.
- `/home/pgadmin/releases/leave-workflow-20261008-155204/release.tar.gz` — 35.8 MiB.
- `/home/pgadmin/releases/onlinefs-20261016-133703/dist` — 3.1 MiB.
- `/home/pgadmin/releases/onlinefs-20261016-133703/publish` — 70.3 MiB.
- `/home/pgadmin/releases/onlinefs-20261016-133703/release.tar.gz` — 34.9 MiB.
- `/home/pgadmin/releases/onlinefs-20261019-085729/dist` — 3.1 MiB.
- `/home/pgadmin/releases/onlinefs-20261019-085729/publish` — 70.3 MiB.
- `/home/pgadmin/releases/onlinefs-20261019-085729/release.tar.gz` — 34.8 MiB.
- `/home/pgadmin/releases/onlinefs-20261019-143528/dist` — 3.2 MiB.
- `/home/pgadmin/releases/onlinefs-20261019-143528/publish` — 70.3 MiB.
- `/home/pgadmin/releases/onlinefs-20261019-143528/release.tar.gz` — 34.9 MiB.

### Docker build cache

Docker reports 1.126 GB total build cache, of which 915 MB is shared and 210.9 MB private. Plan around approximately 201 MiB private cache recovery, not the full total. Cache cleanup should target unused build cache only. Do not delete Docker storage directories manually, prune volumes, or prune every unused image.

## Larger items requiring recovery review

- `/home/pgadmin/releases/onlinefs-20261001-1745/pre-deploy-data.tar.gz` — **2.24 GiB**. Contains an October 1 database, recovery keys and employee media, plus approximately **1.60 GiB of already-compressed backups inside the archive**. This explains much of the size growth. Keep it until its historical recovery value is reviewed and a verified off-server copy or suitable retained recovery coverage exists. Do not rewrite the existing archive in place.
- `/home/pgadmin/releases/20260916-1105/backup/AutoID-src-old/AutoID/bin` and `obj` — **536 MiB** combined. Archived build output, not live mounts; a further cleanup candidate after checking for any unique recovery artifacts bundled inside.
- `/home/pgadmin/AutoID/AutoID_Data/Backups` — **555 MiB** of legacy June/July ZIPs. These are separate from the managed backup directory. Retention settings do not automatically clean this legacy path; assess recovery coverage before removing them.
- Docker reports **4.019 GB reclaimable images**, including other applications and rollback images. Do not count this as fully approved cleanup. Review exact tags and shared layers while preserving active images and selected rollback versions.

## Preserve

- `/home/pgadmin/AutoID/data` — live employee records, leave data and department settings.
- `/home/pgadmin/AutoID/AutoID_Data/Data/Backups` — the three retained managed ZIPs, approximately **1.67 GiB**.
- Recovery keys, photos, signatures, templates and leave attachments in the active mounted data directory.
- Current release `/home/pgadmin/releases/backup-storage-20261020-082412`, its database snapshots and verification records.
- `/home/pgadmin/releases/backup-storage-20261020-081520/app.db.before` and its associated recovery/audit metadata.
- Security release `/home/pgadmin/releases/security-20261019-155204` and selected rollback images. Older releases have known startup/security limitations and should not be activated as routine rollback targets without addressing those limitations.
- Unrelated MIRS and portal applications and their volumes.

## Prevention

Apply separate retention to deployment build artifacts as well as application ZIPs. Keep current and selected recent release artifacts; retain recovery databases/keys separately. Avoid including backup directories, dependency folders and compiler outputs in future whole-directory archives. Keep automatic backup cleanup in dry-run until recovery verification and retention choices are complete.

## Cleanup completed after user approval

Executed the recommended first pass on October 20. Removed exactly the 31 listed build/dependency/duplicate paths and unused Docker build cache. No additional historical archives, legacy backups, Docker images or volumes were deleted.

- Disk usage fell from **92% to 83%**.
- Actual filesystem recovery: **2.40 GiB** (2,574,848,000 bytes).
- Available disk space after cleanup: **4.80 GiB**.
- All three retained managed ZIPs have unchanged SHA-256 checksums.
- Recovery keys, selected recovery database snapshots and current/security release manifests have unchanged SHA-256 checksums.
- Employee, department and leave request counts are unchanged; SQLite integrity check returned `ok`.
- Container images, mount sets, start times and running states are unchanged; no service restart occurred.
- Backend readiness, local website and public website all returned HTTP 200.
- The 2.24 GiB historical archive was preserved with unchanged size and modification time.

Detailed receipt: `.deployment/cleanup-execution-20261020-025940.json`. Server receipt: `/home/pgadmin/releases/storage-cleanup-20261020-025940/receipt.json`.
