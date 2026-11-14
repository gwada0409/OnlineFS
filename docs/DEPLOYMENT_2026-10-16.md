# October 16, 2026 server deployment

The complete current OnlineFS frontend and AutoID backend were deployed to
192.168.2.137. Application: http://192.168.2.137:8082/.

Release directory: `/home/pgadmin/releases/onlinefs-20261016-133703`.

Included changes: mobile navigation/forms/cards/sheets, approval and notification
fixes, Employee Hub improvements, dated approver absences, department backups,
operator line-leader coverage, department member scrolling, corrected member
column order, and the Department heading.

## Deployment and data preservation

- Published a framework-dependent Linux x64 backend against the server's
  existing .NET 10 runtime image, and deployed the current production frontend.
- Staged and SHA-256 verified 129 artifacts before switching containers.
- Kept server configuration, environment secrets, signing keys, and mounted
  uploads/data directories. No local database was uploaded to the server.
- The server data directory is root-owned. The first backup attempt was denied;
  the previous containers were restored before any schema migration. The retry
  stopped the backend, copied its main database and WAL to a private writable
  snapshot, and created a consistent SQLite backup from that snapshot without
  changing live file permissions.
- Applied migration
  `20261016040645_AddApproverAbsencesAndDepartmentBackups` on the server.
- Retained old images tagged `autoid-backend:rollback-20261016-133703` and
  `autoid-onlinefs:rollback-20261016-133703`. The release contains
  `app.db.before`, `server-source-backup.tar.gz`, `manifest.json`, and
  `verification.json`. A database backup and verification report were also
  downloaded into the local `.deployment/releases/20261016-133703` directory.
- Only the backend and OnlineFS containers were recreated. Other applications
  and the existing AutoID frontend container were left running.

## Verification

- All 86 frontend tests passed; the Linux backend publication succeeded.
- Server readiness: **Healthy**, including database and notification outbox.
- Served `index.html` and service worker hashes match the staged release.
- `/`, `/departments`, `/approval-routing`, `/approvals`, `/personal`, and
  `/hr/employment-status` return HTTP 200 from OnlineFS.
- The new protected absence endpoint returns 401 without authentication through
  backend port 5000, OnlineFS port 8082, and AutoID frontend port 8080.
- SQLite integrity is `ok`, with no new foreign-key violations.
- Compared all pre-existing columns and rows with the stopped-service backup:
  110 employees, 26 departments, 6 approval categories, 11 organizational stage
  assignments, 32 leave requests, 63 approval steps, 316 request-day records,
  1,210 balance records, 584 ledger records, 2 attachments, and 1 existing manual
  delegation were preserved exactly.
- Installed frontend/backend source hashes were checked against the release.

Approximately 1.5 GB of disk space remains. No Docker images, old releases,
databases, or unrelated application files were pruned.

The release is additive. Application rollback can retag the preserved images and
recreate backend/OnlineFS while retaining the upgraded database. Restoring a
database backup would discard later writes and requires a separate decision.
