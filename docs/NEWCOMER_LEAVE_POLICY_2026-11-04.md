# Newcomer leave policy and scoped recovery

The new policy starts November 1, 2026. Cohort membership uses AutoID's hire date plus six calendar months: regularization on or after January 1, 2026 is the newcomer cohort. Eligibility starts on the hire date, without waiting for regularization. Invalid or missing hire dates are flagged for correction before a reset; no employee master data is rewritten.

Newcomer SL/VL and the SL/VL source of HDL share an internal NPL account. NPL is not a selectable leave request type. Initial annual allocation is 20 days. Each November 1, unused unreserved credits plus the HR annual allocation roll into the new period, capped at 25. Period 2026 means November 1, 2026 through October 31, 2027. HR can configure a different annual allocation for each employee and period; the latest configured allocation continues until a later allocation is supplied. Legacy employees keep separate SL/VL and calendar years. Other statutory leave-type eligibility rules remain unchanged.

HR confirms whether a newcomer's disapproved or voided ordinary request was taken as paid leave. Paid confirmation charges the combined account once, preserves the approval status and flags disciplinary review. A correction to unpaid refunds the exceptional deduction. Future absences cannot be confirmed as already taken. Insufficient credits require reconciliation first. There is no automatic disciplinary penalty or automatic approval.

Open **Employees → Annual leave credits & recovery**, or **System Administration → Leave credits, clear & recovery** (`/hr/leave-administration`). HR can edit allocations and confirm exceptions. Clear and restore execution additionally require the System Operations capability; HR-only accounts cannot execute either endpoint.

## Clear and restore

Select a year and cohort, then preview. The preview fingerprint must still match at execution. Type the displayed confirmation before invoking clear. The server pauses other API work and the notification worker, starts a database transaction, writes and reads back a verified private leave-only ZIP and checksum receipt, and only then deletes the selected rows. A failure rolls back the database transaction. The recovery copy stays on the server.

Recovery covers scoped balances, annual grants, ledger, requests, daily entries, approval steps, attachment metadata and bytes, request audit history, related notifications, recipients and deliveries. Clearing retains physical attachment files. Employee identities, profile fields, routing departments, approver configuration, recovery keys and unrelated groups/years are preserved. Newcomer resets reset NPL to 20; legacy resets reset SL/VL to 10 each. HR can adjust these allocations afterward.

Saved copies live in `Data/Backups/LeaveResets` within the application's private data directory, outside generic file serving. A restore validates the whole archive and original employee identities/hire dates, takes another safety copy of the current leave scope, and restores only the saved leave tables and missing attachment bytes. It refuses to overwrite an attachment with different contents. Existing full-system ZIP backup/restore remains compatible and separate. Leave-only recovery ZIPs are protected from automatic retention deletion and count against shared backup storage limits.

Cross-period requests, out-of-scope cancellation/rescheduling links, missing attachments, changed preview data, insufficient storage, and initialized later years block clearing. Later initialized balance years also block an earlier restore to avoid silently changing subsequent rollover history. Correct/reconcile those cases before proceeding. Existing legacy ledger rows without a policy-year field can only be scoped by their transaction calendar year; new entries explicitly record their policy year.

Migration: `20261104090832_AddNewcomerLeavePolicy`. It adds the annual grants table, paid-exception metadata, ledger policy year and the inactive internal NPL type. It does not clear requests, reset existing balances or change employee/department records. Account initialization occurs when applicable balances are requested.

Validation includes a synthetic SQLite fixture covering cohort boundaries, November rollover, combined deductions, HR corrections, repeated confirmation, cap enforcement, stale preview, quota refusal, missing attachments, scoped reset, recovery of approvals and missing attachment bytes, tampered ZIP refusal, and preservation of other groups and master records. Frontend tests cover typed confirmation, HR-only permissions and failed previews.

## Deployment and verification

Deployed to Linux on November 4, 2026: `/home/pgadmin/releases/newcomer-policy-20261104-172911`.

- 31 newcomer policy and scoped recovery checks passed inside the isolated Linux image; no production data was mounted in those tests.
- All 52 existing full ZIP backup/storage/restore compatibility checks passed against the new schema.
- All 109 frontend tests passed; production typecheck and Vite/PWA build passed.
- Isolated web startup and deployed backend readiness returned Healthy; public website returned HTTP 200.
- Anonymous maintenance execution returned HTTP 401 through backend, OnlineFS and legacy frontend API entry points.
- All pre-existing business rows in 35 tables were compared to a consistent server-side pre-deployment snapshot and preserved. The migration additionally inserts the internal inactive NPL type and migration history entry.
- Employee count: 110; configured departments: 28; existing leave requests: 6. No production leave scope was cleared or restored during deployment.
- Existing full backup ZIP metadata was unchanged, and automatic cleanup remains in dry-run mode.
- Pre-deployment database recovery copy: `/home/pgadmin/releases/newcomer-policy-20261104-172911/app.db.before`. It remains on Linux; no employee database was downloaded.
- Final verification receipt: `.deployment/releases/newcomer-policy-20261104-172911/final-verification.json` locally and `final-verification.json` in the server release directory.
- Free space after staging/activation: approximately 4.2 GiB (86% used). Current and rollback artifacts are retained.
