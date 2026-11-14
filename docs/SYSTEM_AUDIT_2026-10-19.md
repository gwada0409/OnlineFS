# OnlineFS / AutoID system audit — 19 October 2026

Remediation update: findings **2, 3, 4 and 6** were fixed and deployed on Linux in `security-20261019-155204`. A server-side database backup was created, all 35 business tables were preserved, and three exposed current sessions were invalidated. The earlier disk cleanup reduced usage from 97% to 88%; retaining the patched runtime/release brings the current figure to 90% (about 2.9 GiB free). See [verified security changes](SECURITY_FIXES_2026-10-19.md). The findings below retain the original audit evidence; unselected findings remain open.

Production server: 192.168.2.137. Audit scope: deployed backend source, OnlineFS frontend, aggregate production configuration and health checks, current container logs, dependency advisories, and synthetic workflow probes. No application changes, deployments, PIN resets, session invalidations, or production database exports were performed during this audit.

The application, database and notification outbox currently report Healthy. SQLite quick_check returned ok with zero foreign-key violations. No negative leave balances or pending requests without a pending approval step were found. These health checks do not cover the security and workflow issues below.

## Priority findings

### 1. High — shared initial PIN grants a normal session before the PIN is changed

105 of 110 employee profiles have no PIN hash. The employee-login implementation accepts the shared initial PIN for those accounts, returns a normal bearer token and asset cookie, and supplies RequiresPinChange as a client-side flag. The server's capability resolver and authentication middleware do not restrict that session to changing the PIN. A synthetic login reproduced RequiresPinChange=true together with a full token and PersonalLeave access. No production login was attempted.

Suggested fix: use unique, expiring activation credentials rather than one shared initial PIN. Until activation finishes, issue a short-lived setup-only token and reject normal application/API access at the backend. Review unused accounts before enabling them. Add regression tests that prove setup sessions cannot file requests, view leave history, or access assets.

Evidence: [deployed AuthController](../.deployment/summary-assignment-backend/src/AutoID/Controllers/AuthController.cs), employee-login block at lines 107–190; authentication/capability checks in Program.cs and AccessCapabilities.cs.

### 2. High — notification connection tokens are written to Nginx logs

The current OnlineFS container log contains three access_token query-string entries whose JWT expiration times were still in the future when checked. Only counts were retained; the audit report contains no tokens. The backend suppresses raw request-start diagnostics, but the Nginx access log still records the complete request URL for SignalR connections.

Suggested fix: define an access-log format using method and path without credential-bearing query strings. Redact tokens from error/application diagnostics too. After correcting logging, handle retained sensitive logs and invalidate affected sessions in a planned maintenance step. [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) recommends excluding access tokens and session identifiers from logs.

Evidence: aggregate current-container log scan; [frontend proxy configuration](../nginx.conf).

### 3. High — the generic file endpoint lacks employee/request ownership checks

The deployed StaticController requires authentication but no narrower capability or owner check. Its path resolver allows files anywhere under the application user-data root, except explicitly excluded backup locations. Synthetic path-resolution checks accepted another employee's photo path and a leave-attachment path. Thus a signed-in user who knows a stored path can request those files through this generic endpoint without the ownership checks implemented by the dedicated leave-attachment API.

Suggested fix: enforce a resource authorization check before serving each file. Allow only the owning employee, an authorized current approver for that request, or a permitted administrator. Keep leave documents behind the dedicated attachment endpoint, and expose asset IDs instead of arbitrary stored paths. Test cross-employee access, delegated approval access, and traversal protection. No real employee photo or attachment was retrieved for this audit.

Evidence: [deployed StaticController](../.deployment/summary-assignment-backend/src/AutoID/Controllers/StaticController.cs), lines 10, 20–55 and 59–78. The local main checkout has a stricter controller attribute than production; this audit finding refers to the deployed version.

### 4. High — overlapping signatories silently remove required approval stages

LeaveApprovalRoutingService checks that required stages exist, then globally deduplicates by ApproverId. If one person is both Recommending and Approver, the final stage disappears while ValidateRouteAsync still returns valid. If an HR reviewer is also Recommending, Recommending can disappear instead. Both cases were reproduced using the deployed service with synthetic SQLite data. Aggregate production configuration shows one assigned employee with the same non-self recommending/final approver, and one with a recommending approver who is also an HR reviewer; the groups may overlap.

Suggested fix: deduplicate members within a stage, preserving each required stage. Validate the final route after normalization. If the business wants one signature to cover multiple roles, make that an explicit policy and record the covered roles in the audit trail rather than silently deleting them. Add tests for the same employee in HR, line leader, recommending and final roles.

Evidence: [deployed routing service](../.deployment/summary-assignment-backend/src/AutoID/Services/LeaveApprovalRoutingService.cs), required-stage check at line 100 and global DistinctBy at line 102; synthetic-probes.log.

### 5. High — disk space is nearly exhausted and Docker logs have no rotation limit

Follow-up, 19 October 2026: cleared unused Docker build cache at the user's request. Disk use dropped from 97% to 88%, and available space increased from 948,793,344 to 3,801,767,936 bytes. All six container identities/states/start times and all 21 rollback tags remained unchanged. Application, database and notification-outbox health checks passed. Images, volumes, releases, backups, databases and uploads were not pruned. Log rotation and longer-term retention remain separate recommendations.

Linux reports 97% filesystem usage with approximately 905 MiB free. The releases directory occupies 4.8 GB. Docker reports about 2.6 GB of reclaimable build cache and other unused image space; these estimates may overlap and should not be summed as guaranteed recoverable space. The inspected application containers use json-file logging with no per-container rotation options.

Suggested fix: copy required backups to approved off-server storage, retain known-good rollback releases, and remove only verified obsolete build/release artifacts. Configure bounded log rotation and a low-space alert. Never use a blanket volume prune against production data. The [Docker json-file documentation](https://docs.docker.com/engine/logging/drivers/json-file/) describes max-size and max-file settings; new defaults require container recreation to affect existing containers.

Evidence: df, docker system df, release-directory size, and the three containers' logging configuration.

### 6. High — deployed dependencies and runtime have published security advisories

The current NuGet audit flagged four dependency names. Three package versions were independently confirmed in the running application's dependency manifest:

| Component | Confirmed version / observation | Suggested treatment |
| --- | --- | --- |
| SixLabors.ImageSharp | 3.1.6 | Upgrade to a compatible patched release; test photo processing and PDF output. The reviewed [publisher advisory](https://github.com/SixLabors/ImageSharp/security/advisories/GHSA-jjfr-hcj7-qf5w) fixes its specific TIFF encoder issue in 4.1.2. Other returned ImageSharp advisories must also be checked. |
| SQLitePCLRaw.lib.e_sqlite3 | 2.1.6 | Upgrade the EF/SQLite provider and native library together, and verify the actual embedded SQLite version. The [SQLite advisory](https://github.com/advisories/GHSA-2m69-gcr7-jv3q) identifies SQLite 3.50.2 as the fix for its reported issue; do not assume updating only the managed EF package fixes the native engine. |
| System.IO.Packaging | 6.0.0 | Update the dependency chain to a patched compatible package. See [Microsoft's advisory](https://github.com/advisories/GHSA-qj66-m88j-hmgj). |
| System.Security.Cryptography.Pkcs / .NET runtime | NuGet restore flags package 8.0.1; the deployed application instead has the assembly supplied by ASP.NET Core 10.0.12 | Update the container runtime to a supported patched version covering [CVE-2026-84008](https://github.com/advisories/GHSA-846f-f764-76mx); that advisory lists 10.0.13 for the 10.0 branch. Verify assembly resolution after rebuilding. |

The project suppresses NU1902 and NU1903 warnings globally, which hides moderate/high vulnerability notices during routine builds. Remove the blanket suppression or replace it with documented, time-limited exceptions and an explicit CI audit gate. The package findings establish affected versions; exploit reachability of every advisory was not established and no malicious inputs were sent to production. The npm production-dependency audit returned zero advisories.

### 7. Medium — notification failure can report failure after a request is saved

ApplyCore commits the leave request and pending balance, then calls the notification service without isolating failures. A synthetic failing notification service caused the method to throw while one request and its pending balance remained committed. The frontend would receive a failure response even though the filing exists. Similar post-commit calls appear in other workflow paths and should be reviewed.

Suggested fix: record durable notification/outbox work in the same transaction as the leave mutation, then deliver it asynchronously. At minimum, catch post-commit delivery failures, retain a retry task, and return the committed request ID. Add request idempotency keys so a retry cannot create a second filing. Avoid telling the user that committed work failed.

Evidence: [deployed LeaveController](../.deployment/summary-assignment-backend/src/AutoID/Controllers/LeaveController.cs), commit at line 325 and notification calls from line 336; synthetic-probes.log.

### 8. Medium — some employee profiles have no leave-filing route

Fifteen employees have no active assigned leave department, and none of those fifteen has an explicit employee route or supervisor/manager fallback. One operator lacks the required SL leader/active department; that operator may be included in the fifteen. These are aggregate counts, not a claim that every unassigned account should be enabled or that all other routes are complete.

Suggested fix: have HR review active staff and assign the correct department/signatories individually. Add an Admin route-readiness report and preflight validation before the employee completes attachments. Do not bulk-assign guessed approvers. Non-operator SL does not require a line leader.

### 9. Medium — public users share the proxy's authentication rate-limit bucket

Authentication is limited to ten requests per minute using Connection.RemoteIpAddress. The frontend proxies requests to the backend, but the inspected app does not configure forwarded-header middleware. Requests passing through the same proxy therefore share its address and limiter bucket. Busy sign-in periods or one user's repeated attempts can affect other employees. This was established from configuration; no production rate-limit exhaustion test was performed.

Suggested fix: forward the original client address through trusted proxy configuration, process forwarded headers before rate limiting, and use carefully chosen account/IP limits. Do not trust arbitrary forwarded headers from the public Internet. Follow [Microsoft's trusted-proxy guidance](https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/proxy-load-balancer?view=aspnetcore-10.0).

Evidence: [deployed Program.cs](../.deployment/summary-assignment-backend/src/AutoID/Program.cs), lines 40–50; [nginx.conf](../nginx.conf), API proxy block.

### 10. Medium — leave summaries can disagree between employee, HR and approver views

The shared form sorts ascending and displays the first forty records. The employee API supplies the full history; the approver API first selects the newest forty; the HR endpoint filters by year. With more than forty records, different viewers can therefore see different subsets. HR also computes leaveBalanceAtFile, while the personal and approver responses omit that field, causing blank historical balance columns even where ledger data may exist.

Suggested fix: use one authorized summary/report service and DTO across the three entry points, with the same year/range, ordering, historical-balance calculation and pagination. Make the two-page print range explicit. Add a 45-record cross-view test. The production database currently has only one request, so the forty-record discrepancy is a future failure condition rather than a currently observed missing-record incident.

Evidence: [LeaveSummaryForm](../src/components/LeaveSummaryForm.tsx), orderedRequests slicing; deployed LeaveController.GetMyRequests, ApprovalController.GetPendingRequestLeaveSummary, and HRLeaveController.GetEmployeeLeaveSummary.

## Items needing verification

Ten backup ZIP files and deployment backups exist on the server. No application backup scheduler or pgadmin backup cron entry was found; the only visible matching timer was the operating system package-database backup. This does not rule out root-owned or external backup automation. Verify a scheduled, encrypted off-server backup and a recent restore rehearsal. Keeping every copy on the same nearly-full disk is not sufficient disaster recovery.

The development Vite process was previously observed crashing on locked .deployment/**/obj temporary files during a backend build. Exclude staging/build directories from the development watcher. This is a developer-preview issue; production serves static files through Nginx.

## Verification and limits

- Frontend: all 102 tests passed and TypeScript typecheck passed. Sandbox-only temporary-file errors disappeared when the same suite ran outside that restriction; they were not classified as application failures.
- Deployed-source backend workflow suite: 99 line-leader/migration checks and 51 absence-coverage checks passed. Extra audit probes nevertheless reproduced the overlapping-stage, committed-submission error and initial-PIN session gaps.
- Production checks used server-side read-only SQL and redacted/aggregate log processing. The requested full audit did not require exporting the employee database; a proposed export was blocked by automatic review and replaced with server-side checks.
- Current container logs only cover the lifetime of the current containers, which were recreated during earlier deployments. A 72-hour query cannot recover logs from deleted containers.
- No destructive requests, live exploit attempts, production sign-ins, session invalidations, PIN changes, file retrieval from other employees, cleanup, package upgrades or deployments were performed for this audit.

## Suggested implementation sequence

1. Stabilize storage and stop credential-bearing URL logging; plan handling of existing sensitive logs and affected sessions.
2. Correct initial account activation, resource authorization, and approval-stage preservation with regression tests.
3. Upgrade runtime/dependencies in a staging build; verify images, PDFs, SQLite migrations and backups before rollout.
4. Fix transaction/outbox responses, complete HR routing assignments, correct proxy-aware throttling, and unify summary reports.

