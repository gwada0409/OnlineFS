# Backend leave-only reset — November 4, 2026

Completed the user-authorized reset on the Linux server. No employee database or leave attachments were downloaded. The reset was rehearsed on a server-side copy, and a leave-only restore round trip passed before the live operation. The rehearsal also changed employee/department master fields after taking the recovery copy and confirmed that leave recovery preserved those newer settings.

## Result

- Cleared all years of requests, request approval steps, daily leave entries, attachment metadata, leave audit history, prior usage/credit ledger and annual credit records.
- Removed only request-related notifications and request-related routing audit entries. Unrelated alerts and configuration audit records were preserved.
- Six requests and sixteen request approval steps were removed. Both counts are now zero.
- Initial allocations: nine newcomers received twenty combined NPL days; 101 legacy-policy employee records received ten SL plus ten VL. All used, pending and carry-over values are zero.
- Current allocations are for the applicable current policy period. Old 2025 and future 2027 balances were removed along with historical balances.
- Non-credit leave types retain zero-credit balance records, and the ledger now contains only 211 initial-allocation entries.
- One stored hire date could not be parsed by the policy's existing date parser. That record retains the legacy classification; its hire date and all employee fields were preserved.

## Preserved and verified

The reset transaction compared hashes of 28 protected record groups. Employee master fields, all 29 departments, approval categories, department approvers, route templates, automatic routing rules, employee route assignments, delegations, approver absences, leave-type policy definitions, holidays, calendars, accounts and other configuration tables were preserved. Existing administrative audit history was retained, and a reset audit entry was appended. Physical attachment files, photos, signatures, recovery keys and other managed settings files were not deleted or modified.

Post-restart verification compared the full rows of thirteen core master/configuration tables against the immediate pre-reset snapshot. All matched. Employee count remains 110; department count remains 29. SQLite integrity returned `ok`, foreign-key checks were unchanged, backend readiness was Healthy and the public website returned HTTP 200.

## Recovery copy

Private Linux operation directory:

`/home/pgadmin/releases/leave-reset-policy-20261104-194450`

- `server-before-reset.db`: consistent complete pre-reset SQLite recovery snapshot.
- `server-before-reset.db.sha256`: verified checksum.
- `server-before-reset-attachments/`: both leave attachments, with per-file checksums and original paths in `manifest.json`.
- `server-reset.json`: reset receipt and protected-group verification count.
- `post-reset-verification.json`: final integrity, balance, hierarchy and service verification.
- `tool/Program.cs` and the maintenance assembly: the tested reset/leave-only restore tool.

These are server-side maintenance recovery files, separate from the application's managed ZIP history. Retain this operation directory. For a production recovery, stop all writers and take another current safety snapshot first, then use the tested maintenance tool's `restore` mode to restore only leave tables, request-related notifications/audit entries and missing leave attachment files. Do not replace the whole production database: leave-only restoration preserves current employee records and department settings. Recovery refuses a changed checksum, conflicting existing attachment or invalid foreign-key state.

Local metadata-only receipt: `.deployment/leave-reset-policy/last-reset-result.json`.
