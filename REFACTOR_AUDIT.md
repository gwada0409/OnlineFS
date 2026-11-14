# OnlineFS Refactor Audit

Baseline date: 2026-09-11 (Asia/Manila)  
Phase: 0 — Baseline and safety  
Scope: frontend `C:\Users\g.adorio\Documents\OnlineFS`, backend `C:\Users\g.adorio\Documents\AutoID\src\AutoID`

## Phase 0 outcome

The current system has been inventoried without changing application behavior. The frontend builds, the backend builds with warnings, the existing isolated authorization/notification regression suite passes, all 20 EF migrations are applied, and a cold SHA-256-verified copy of the production SQLite database has been made.

Phase 1 must start with authorization and secret remediation. Several legacy endpoints are currently unauthenticated, including database restore operations and unrestricted physical-file serving. These findings are documented below; they were deliberately not changed during the baseline phase.

## Safety baseline

### Database and backup

- Production database: `C:\Users\g.adorio\Documents\AutoID\src\AutoID\app.db`
- Engine: SQLite through Entity Framework Core
- Database size at backup: 778,240 bytes
- Cold backup: `C:\Users\g.adorio\Documents\AutoID\backups\app-phase0-baseline-20260911-154935.db`
- Backup size: 778,240 bytes
- Source and backup SHA-256: `A199BF645DDBFCEF5F8B6A1C558BBEC0CD640D59130A9CCEA6A8243A4DD4E274`
- Verification: source and destination sizes and hashes match
- Migration status: all 20 migrations applied; no pending migrations
- Latest migration: `20260911055119_UppercaseEmploymentStatuses20260911`

The API process was stopped before copying the SQLite file to avoid an inconsistent hot copy. The backup has not been restored over production. A restore drill against a disposable copy should be added before Phase 2 database work.

### Source-control safety

No `.git` directory exists at either inspected codebase root. The `.gitignore` files do not provide rollback without repository history. Before Phase 1, initialize or recover the authoritative repository and commit/tag this baseline. Until then, the verified database backup protects data but application-code rollback remains weak.

## Runtime and deployment inventory

| Component | Current implementation | Local runtime |
|---|---|---|
| Frontend | React + TypeScript + Vite + Tailwind, PWA via `vite-plugin-pwa` | Node 24.19.0 / npm 11.17.0, Vite on port 5173 |
| Backend | ASP.NET Core Web API, SignalR, EF Core/SQLite | .NET SDK 10.0.302, API on port 5000 |
| Database | SQLite | `DB_PATH` or relative `app.db` |
| Realtime | SignalR `/hubs/notifications` plus Web Push | proxied by Vite/nginx |
| Containers | frontend nginx image and backend image; compose at AutoID root | not exercised in Phase 0 |

Frontend development proxies `/api` and `/hubs` to `127.0.0.1:5000`. The PWA uses an inject-manifest service worker, prompts for updates, and treats API/hub requests as network-only. The frontend Docker build uses `npm install` rather than deterministic `npm ci`.

Backend startup automatically applies migrations, normalizes stored paths, seeds departments and a default SystemAdmin if one is absent, reconciles untouched pending routes, and writes last-active timestamps during authenticated traffic. Startup therefore has significant database side effects and should be separated into explicit migration/seed jobs in a later phase.

## Codebase inventory

### Frontend

- 57 TypeScript/TSX source files.
- Central areas: routing/access bootstrap, API client, authentication context, PWA/service worker, employee dashboard and leave workflow, approvals, HR dashboard, departments/categories, delegation, notifications, and system administration.
- Highest-complexity UI files by line count include `HRDashboard.tsx` (783), `FileLeavePage.tsx` (743), `ApprovalRouteTemplatesPage.tsx` (662), `DepartmentManagementPage.tsx` (510), `UnitDetailsPanel.tsx` (495), and `api.ts` (441).
- No frontend test or lint script is configured. Only `dev`, `build`, and `preview` scripts exist.

### Backend

- 23 controllers, 26 services, 26 model files, 20 migrations, and 157 HTTP action attributes.
- Major domains: authentication/access, employees/ID generation, leave requests and ledger, approvals/routing, HR operations, categories/departments, delegation, notifications/SignalR/Web Push, and system administration.
- Highest-complexity files include `LeaveController.cs` (775), `DepartmentController.cs` (611), `AppDbContext.cs` (585), `ApprovalController.cs` (485), `ImportController.cs` (451), `TemplateEngine.cs` (446), and `HRLeaveController.cs` (441).
- Utility projects also exist (`Checker`, `DBTester`). The only identified automated regression project is `tests/NotificationAccessChecks`.

### Database model

The model includes unique constraints for employee IDs, department/category names, leave-type codes, notification deduplication, notification principal recipients, push endpoints, route template names/steps, employee route assignments, and per-year employee leave balances. Foreign-key delete behavior is intentionally mixed among cascade, restrict, and set-null. Notification and push ownership have database check constraints ensuring exactly one employee/user principal.

## Authentication, roles, and capabilities

JWT bearer authentication includes a per-account session identifier checked against the database. The backend capability resolver is the authoritative access model:

| Principal | Effective capabilities |
|---|---|
| Employee | Personal leave |
| Assigned approver | Employee capabilities + approvals |
| HRStaff | Personal leave + HR operations; approvals when assigned |
| HRManager | Personal leave + HR operations + HR management; approvals when assigned |
| Admin account | HR operations + HR management + system operations + system-alert management |
| SystemAdmin account | Admin capabilities + user/role management |
| Editor account | No capability currently resolved |

Approver status is inferred from current department/category/routes, active delegation, and any current or historical approval step. Historical-step membership may retain the Approvals capability after an assignment ends and needs an explicit product/security decision.

Frontend routing retrieves `/api/auth/access`, but falls back to locally inferred legacy capabilities if that request fails. This can expose navigation that the backend later rejects. Session data and JWTs are stored in `sessionStorage`; parsing is not guarded against corrupted values. Backend policy checks remain the required security boundary.

## API authorization map

| Surface | Current boundary | Baseline assessment |
|---|---|---|
| Auth login / employee login / forgot PIN | Public | Intended entry points, but rate limiting and enumeration resistance need review |
| Auth access and account administration | Authenticated / UserRoleManagement | Appropriate capability direction |
| Personal leave | Authenticated with PersonalLeave on personal actions | Object-level request/attachment checks require dedicated negative tests |
| Approval actions | Approvals; HR view paths use HROperations | Mixed class/action policy usage; consolidate |
| HR leave, categories, departments | HROperations; selected mutations use HRManagement | Mutation boundaries are inconsistent and need a method-by-method matrix |
| Approval routes/routing management | HRManagement | Appropriate direction |
| Delegation | Authenticated with internal ownership/admin checks | Add explicit policy and lifecycle tests |
| Notifications/push | Authenticated and principal-filtered | Existing isolation tests pass |
| System operations/settings | SystemOperations | Appropriate direction |
| User/role administration | UserRoleManagement | Appropriate direction |
| Legacy employee/import/generation/log APIs | Role strings (`SystemAdmin,Admin,Editor`) | Does not match capability architecture; Editor scope is especially unclear |
| Backup create/restore/history | **Public** | Critical unauthorized data exfiltration/destructive restore risk |
| Static physical-file and thumbnail routes | **Public** | Critical arbitrary local-file read/path traversal risk |
| Template CRUD/background upload | **Public** | Critical unauthorized configuration/file-write risk |
| Pump-choice write/delete APIs | **Public** | High unauthorized file and data mutation risk |

## Priority findings

### Critical — resolve first in Phase 1

1. `BackupController` has no authorization. Anonymous callers can create/download backups, upload a 500 MB restore, assemble restore chunks, restore from an arbitrary existing local path, and read backup history. Uploaded names/IDs are also used in temporary paths without sufficient canonicalization.
2. `StaticController` accepts a catch-all decoded path and returns any existing physical file, including rooted paths, without authentication or an allow-listed storage root.
3. `TemplatesController` exposes anonymous CRUD and uploads. `PumpChoicesController` likewise permits anonymous create, rename, and delete.
4. The JWT signing secret is hardcoded in source. It must be rotated and supplied from protected configuration; existing tokens should be invalidated as part of the controlled change.
5. Startup creates a SystemAdmin with a predictable default credential when none exists. Replace with one-time provisioning and mandatory secret rotation; do not log credentials.

### High

1. CORS trusts every origin while allowing credentials. Restrict it to configured frontend origins.
2. Legacy role-string authorization and the newer capability system coexist, producing inconsistent boundaries and unclear Editor behavior.
3. The project suppresses NuGet vulnerability warning codes `NU1902` and `NU1903`; remove suppression and assess packages.
4. Backend targets .NET 10 while EF Core SQLite/Design is 8.0.11. Align supported package/framework versions and regression-test migrations.
5. There is no repository history at the inspected roots and no verified code rollback point.

### Medium / maintainability

1. Large controllers and pages combine data access, authorization, workflow, and presentation state.
2. Automatic migrations, seeding, path mutation, and route reconciliation occur during ordinary process startup.
3. The frontend has no automated tests or lint command.
4. The frontend access fallback can show stale/unauthorized workspaces.
5. Backend builds with nullable-reference warnings in `ChangeRequestController`, `SettingsManager`, and `SystemControllers`.
6. Docker frontend dependency installation is not lockfile-strict.

## Baseline verification results

| Check | Result |
|---|---|
| `npm run build` | PASS; 1,929 modules transformed; PWA precache generated with 53 entries (~2.81 MiB) |
| Backend forced build | PASS with 0 errors and 5 nullable warnings |
| EF migration listing | PASS; all 20 migrations applied, none pending |
| `NotificationAccessChecks` | PASS using an isolated database; production data was not used |
| Frontend unit/integration tests | NOT AVAILABLE; no test script/framework configured |
| Database backup hash verification | PASS |

The backend regression suite covers employee/approver/HR/admin notification boundaries, numeric-ID collisions, system counts and security-alert isolation, deep-link isolation, overview privacy, mark-read boundaries, shared notification state, system preferences/audit, ambiguous-recipient rejection, migration/backfill behavior, and durable SignalR/per-recipient/deduplication behavior.

## Phased refactor plan

### Phase 1 — Security boundary and recovery foundation

- Establish source control and tag the Phase 0 baseline.
- Lock down backup, static-file, template, and pump endpoints.
- Move and rotate JWT/default credentials; restrict CORS; add rate limiting and safe error responses.
- Replace role-string checks with named capabilities and add exhaustive authorization matrix tests.
- Add a disposable-database restore drill and documented rollback procedure.
- Exit criteria: no anonymous administrative/file-system mutation or arbitrary file read; capability tests pass for every role and denial case.

### Phase 2 — Database and migration integrity

- Align .NET/EF versions, remove warning suppression, audit schema constraints and route/leave invariants.
- Move migrations/seeding out of request-serving startup; make provisioning idempotent and explicit.
- Add transactional tests for approvals, balances, routing changes, and rollback.
- Exit criteria: clean build, deterministic migration/restore test, and verified data invariants.

### Phase 3 — Backend domain boundaries

- Extract leave, approval, routing, department, notification, and system operations from oversized controllers into application/domain services.
- Standardize validation, DTOs, errors, pagination, auditing, and idempotency.
- Exit criteria: thin controllers and service-level tests for core workflows.

### Phase 4 — Routing and approval correctness

- Define one canonical route-resolution algorithm and immutable approval snapshots.
- Test category/department moves, approver changes, delegation periods, no-route cases, concurrent actions, and finalized requests.
- Exit criteria: deterministic routing with explainable audit records and no stale/misdirected approvals.

### Phase 5 — Notifications and realtime delivery

- Separate durable notification creation, recipient fan-out, SignalR refresh, and Web Push delivery.
- Add retry/dead-letter observability, per-principal preferences, and PWA/Windows delivery diagnostics.
- Exit criteria: in-app and OS notification behavior is measurable, deduplicated, and access-isolated.

### Phase 6 — Frontend architecture and access UX

- Split large pages into feature modules; centralize query/mutation state, modals, forms, and capability-gated navigation.
- Remove unsafe legacy capability fallback or make failure explicit.
- Add accessible keyboard/focus behavior, consistent loading/error/empty states, and responsive layouts.
- Exit criteria: role workspaces are complete and consistent, with component/integration coverage.

### Phase 7 — Leave workflow and print/PWA quality

- Formalize multi-step leave policy validation (including SL attachments), summaries, print pagination/orientation, and post-submit actions.
- Add browser coverage for install/update/logout, modal interaction, printing, and offline boundaries.
- Exit criteria: policy rules are shared server/client and critical user journeys pass automated browser tests.

### Phase 8 — Observability and operations

- Add structured correlation IDs, security/audit events, health/readiness endpoints, metrics, backup retention, and runbooks.
- Ensure secrets/tokens never enter logs.
- Exit criteria: actionable dashboards and tested operational recovery procedures.

### Phase 9 — Deployment hardening and release

- Pin dependencies, use deterministic container builds, scan dependencies/images, and define environment-specific configuration.
- Run staged migration, smoke, authorization, routing, notification, and restore tests before production promotion.
- Exit criteria: signed release checklist, rollback rehearsed, and stakeholder acceptance recorded.

## Phase 1 entry gate

Do not begin structural refactoring until the code is under version control and the Critical items have regression tests that first demonstrate the current exposure. Phase 1 changes should be small, reviewable, and reversible, with the verified database backup retained outside the application data directory.

## Phase 1 completion — Authentication, authorization, and role boundaries

Completed: 2026-09-11 (Asia/Manila)

### Confirmed defects and root causes

- JWT creation and validation duplicated a hardcoded signing key, omitted issuer/audience validation, used a seven-day lifetime, and accepted older tokens without a server session claim.
- Logout removed browser state but did not invalidate the corresponding backend session.
- Failed capability refreshes restored frontend-inferred permissions, so visible navigation could disagree with backend authority.
- Backup/restore, arbitrary physical-file delivery, template management, and pump-choice mutation had no authorization attribute.
- Legacy employee/ID-card APIs used role strings including the capability-less Editor role rather than the authoritative capability model.
- CORS accepted every origin together with credentials.
- Public employee authentication responses disclosed whether an employee ID existed, and authentication endpoints had no request throttling.
- Startup contained a predictable SystemAdmin bootstrap credential.

### Changes made

- JWT signing material now comes from protected configuration (`JWT__SIGNINGKEY` / `Jwt:SigningKey`); issuer, audience, expiration, lifetime, and one-minute clock skew are validated consistently for issued and received tokens.
- A secure random per-user development signing value was installed without displaying or writing it into source. Deployments must provide their own environment-scoped value.
- Tokens without `SessionId` are rejected. Authenticated logout clears the matching User or Employee session server-side, with principal kind determined by the EmployeeID claim rather than a collision-prone numeric ID.
- Credentialed CORS is restricted to configured origins, defaulting locally to `localhost:5173` and `127.0.0.1:5173`.
- Authentication and PIN-reset endpoints are rate-limited. Employee login and PIN reset return non-enumerating messages.
- Backup, static-file, template, pump-choice, employee, import, generation, change-request, and log surfaces now require named backend capabilities. Employee portal access uses `PersonalLeave`.
- Static files are constrained to the application data root. Backup restore paths and uploaded chunk identifiers/file types are canonicalized and constrained.
- Predictable bootstrap provisioning was removed. A missing SystemAdmin is created only when protected `BootstrapAdmin` configuration is explicitly supplied.
- The frontend no longer restores legacy permissions after authoritative access resolution fails, handles corrupt session storage, and calls backend logout before clearing local state.
- Administrative account roles and minimum password length are validated on the older auth account-management endpoints.

### Files changed

- Backend: `Program.cs`, `Services/JwtSettings.cs`, `Controllers/AuthController.cs`, `BackupController.cs`, `StaticController.cs`, `TemplatesController.cs`, `SystemControllers.cs`, `EmployeePortalController.cs`, `EmployeesController.cs`, `GenerationController.cs`, `ImportController.cs`, `ChangeRequestController.cs`, `LogController.cs`, and `LeaveController.cs`.
- Frontend: `src/contexts/AuthContext.tsx`, `src/pages/MainLayout.tsx`.
- Tests: `tests/NotificationAccessChecks/SecurityBoundaryChecks.cs`, `Program.cs`.

### Database changes

None. No migration was created and production data was not used by automated tests.

### Verification

- Frontend TypeScript/PWA production build: PASS.
- Backend build: PASS with the same five Phase 0 nullable warnings; no new warnings.
- Isolated authorization/notification/migration/delivery suite: PASS.
- New boundary assertions: protected legacy controllers, PersonalLeave portal, authenticated logout, employee/admin session invalidation, and numeric-ID collision isolation: PASS.
- Live anonymous probes for backup history, static database path, templates, pumps, employees, and logout: all returned HTTP 401.
- Live untrusted-origin probe: no `Access-Control-Allow-Origin` header returned.

### Remaining risks

- Source control is still absent at the inspected roots. This remains the largest code-rollback weakness.
- The legacy Editor database role remains for compatibility but resolves no application capability. It should be migrated or formally retired with stakeholder approval.
- Current account/PIN policy still includes the established first-login `000000` flow. Replacing that business policy requires a controlled enrollment design.
- Object-level leave and approval rules rely on controller/service queries; broader HTTP integration coverage should accompany Phase 3 routing work.
- Rate limiting is process-local. Multi-instance deployment will require a distributed limiter or gateway policy.
- Installed PWAs will receive the new frontend through the existing prompt-based service-worker update cycle; users with an old JWT must log in again because signing material and validation changed.

### Recommended next phase

Proceed to Phase 2 — Domain model and database integrity, beginning with a fresh verified backup, schema/status invariant tests, and reversible migrations only where tests demonstrate a missing constraint.

## Phase 2 completion — Domain model and database integrity

Completed: 2026-09-11 (Asia/Manila)

### Problems found and root causes

- Workflow, approval, change-request, employment, and organization-role values were repeated as free-form strings across entities, controllers, and services.
- Database foreign keys were healthy, but important domain rules existed only in application code: valid statuses, nonnegative balances/totals, ordered approval steps, delegation ranges, self-reference prevention, attachment size, and daily hours.
- Usernames were not database-unique and used case-sensitive storage semantics, allowing race conditions or case-only duplicates despite application checks.
- Approval-step ordering and per-request daily records had non-unique indexes, allowing ambiguous workflow snapshots or duplicate daily breakdown rows.
- Two production employees had blank organization roles. Import used mixed-case employment status values that would conflict with the established uppercase API convention.

### Pre-migration production validation

- SQLite `integrity_check`: `ok`.
- Foreign-key violations: none.
- Case-insensitive username duplicates: none.
- Duplicate approval-step orders or leave-request dates: none.
- Invalid/self approval routes, hierarchy self-links, or delegation date ranges: none.
- Invalid leave date ranges, negative totals/balances, or invalid numeric daily hours: none.
- Production counts before and after migration: 110 employees and 21 leave requests.

### Changes made

- Added centralized domain values for leave-request statuses, approval actions, change-request statuses, uppercase employment statuses, and organization roles.
- Updated core leave filing, rescheduling, approval, reconciliation, employee-change, import, and employment-status paths to use centralized values while preserving response strings and the existing dynamic `Pending <step>` format.
- Added database checks for valid Employee employment/organization roles, no self supervisor/manager, no self department parent, valid delegation dates and distinct parties, nonnegative route/step order, no self-approval routes, allowed approval/change/leave statuses, valid leave dates/totals, valid day hours, nonnegative balances, valid balance years, and nonnegative attachment sizes.
- Added case-insensitive unique usernames, unique approval step order per request, unique daily date per request, and supporting indexes for attachments and change-request queues.
- Normalized blank legacy organization roles to `Employee` and employment status to `REGULAR`/`NON-REGULAR` before constraints were applied.
- Added validation to administrative role updates and employee imports so new writes conform to the schema.

### Database backup and migration

- Pre-change cold backup: `C:\Users\g.adorio\Documents\AutoID\backups\app-phase2-prechange-20260911-162406.db`.
- Backup bytes: 778,240.
- SHA-256: `66705E73DD9B572B4AAA556369EE4417B27AE53C8FB2C7A6BD501673571C9BAA`.
- Migration: `20260911082723_DomainIntegrityPhase2`.
- The migration has a generated `Down` path restoring the previous indexes, collation, and constraint set.
- A copy of the production schema was upgraded first. It passed integrity and foreign-key checks before the same migration was applied to production.
- Post-production migration: latest migration recorded correctly, integrity `ok`, no foreign-key violations, all blank roles normalized, and business record counts preserved.

### Files changed

- Backend domain/model/configuration: `Domain/WorkflowValues.cs`, `GlobalUsings.cs`, `Data/AppDbContext.cs`, `Models/Employee.cs`, `LeaveRequest.cs`, `ApprovalStep.cs`, and `EmployeeChangeRequest.cs`.
- Backend write/workflow paths: `Controllers/ApprovalController.cs`, `LeaveController.cs`, `ChangeRequestController.cs`, `EmployeePortalController.cs`, `AuthController.cs`, `HRLeaveController.cs`, `SystemOperationsController.cs`, `SystemAdminController.cs`, `ImportController.cs`, and `Services/LeaveApprovalRoutingService.cs`.
- Migration: `Migrations/20260911082723_DomainIntegrityPhase2.cs`, its designer, and the updated model snapshot.
- Tests: `tests/NotificationAccessChecks/DomainIntegrityChecks.cs` and the test runner.

### Tests performed

- Disposable upgrade from the exact Phase 2 production backup: PASS.
- Full migration chain on isolated SQLite: PASS.
- Database rejection tests for invalid employment status, self approval, reversed delegation dates, and case-only duplicate usernames: PASS.
- Schema assertion tests for all newly constrained domain tables: PASS.
- Existing role, notification, recipient, migration, delivery, and Phase 1 security tests: PASS.
- Frontend TypeScript/PWA production build: PASS.
- Backend/test build retains only the same five nullable warnings recorded in Phase 0; the Phase 2 test warning was removed.

### Remaining risks

- Dynamic leave statuses remain API-compatible strings (`Pending <step>`). A future versioned API could expose a stable status code and separate display label.
- SQLite check constraints protect row-level rules but cannot prevent multi-row cycles in department hierarchies or delegation graphs; these remain service-level responsibilities for Phase 3.
- Duplicate leave-request prevention is a business-policy decision and was not introduced silently.
- Existing attachment files were not content-scanned in this phase; upload policy belongs to Phase 4.
- The five baseline nullable warnings remain scheduled for Phase 9/10.

### Recommended next phase

Proceed to Phase 3 — Approval routing engine. Consolidate route resolution and queue truth behind one service, then add one-step, two-step, delegated, department-change, missing-route, duplicate-approver, and partially-completed workflow tests.

## Phase 3 completion — Approval routing engine

Completed: 2026-09-11 (Asia/Manila)

### Problems found and root causes

- Initial filing and rescheduling built approval chains through different algorithms. Rescheduling used a legacy service and could append HR independently, so the same employee could receive a different route depending on the operation.
- Employee-specific approval routes existed but were ignored by the active hierarchy resolver.
- Approver queues, authorization to act, and the company-pending view each reconstructed workflow truth independently, allowing displayed work and actionable work to disagree.
- Delegation overlap/cycle rules lived in a controller and did not validate an arbitrary delegation graph centrally.
- Tracked employee navigation data could remain stale after a department change within the same service scope.

### Changes made

- Consolidated hierarchy resolution, employee override resolution, snapshot creation, approver/action authorization, delegated queues, company-pending queries, reconciliation, and delegation validation behind `ILeaveApprovalRoutingService`.
- Explicit per-employee routes now take precedence over department/category hierarchy routes. Duplicate approvers and self-approval steps are removed while preserving deterministic order.
- Filing and rescheduling now use the same authoritative snapshot builder.
- Approval and disapproval authorize the direct approver or an effective delegate through the same resolver used by pending queues.
- Company pending now derives from persisted pending leave status plus pending/waiting workflow steps.
- Delegations reject self-delegation, reversed ranges, overlaps, and graph cycles.
- Route writes validate employees, approvers, order, duplicate/self approvers, normalize order after deletion, and reconcile only untouched pending workflows.
- Partially completed and completed workflow snapshots remain immutable when hierarchy configuration changes.
- Department resolution now uses current no-tracking data, so a changed employee department selects the current route.

### Database backup and runtime reconciliation

- No schema migration was required.
- Pre-reconciliation cold backup: `C:\Users\g.adorio\Documents\AutoID\backups\app-phase3-pre-reconcile-20260911-164223.db`.
- Backup bytes: 974,848.
- SHA-256: `DA828C7A4809CAEC8B0E2DD979FFF4291C621477BAE0622E035AE5C3D02B78B5`.
- Production startup reconciliation changed zero approval-step rows (32 before and after). Three leave requests remain pending with ten pending/waiting approval steps.
- Post-startup SQLite `integrity_check`: `ok`; foreign-key violations: none.

### Files changed

- Routing contracts and engine: `Services/ILeaveApprovalRoutingService.cs`, `Services/LeaveApprovalRoutingService.cs`.
- Workflow entry/action paths: `Controllers/LeaveController.cs`, `Controllers/ApprovalController.cs`.
- Administrative routing/delegation paths: `Controllers/ApprovalRouteController.cs`, `Controllers/DelegationController.cs`.
- Tests: `tests/NotificationAccessChecks/RoutingEngineChecks.cs` and the test runner.

### Tests performed

- Two-step department/category routing, employee override precedence, changed department resolution, duplicate collapse, self-approver removal, missing-route diagnostics, and first-actionable-step snapshot behavior: PASS.
- Direct approver, unauthorized actor, effective delegate, expired delegate, delegated queue parity, overlap rejection, and circular delegation rejection: PASS.
- Company-pending workflow truth, untouched-route reconciliation, and partially completed workflow immutability: PASS.
- Full isolated Phase 0–3 backend suite: PASS.
- Backend build: PASS with the same five baseline nullable warnings; no new warnings.
- Frontend TypeScript/PWA production build: PASS (existing PWA deprecation warning only).
- Live backend protected endpoint returned HTTP 401 without authentication.

### Remaining risks

- The Employee model has no active/inactive employment flag, so inactive-approver exclusion cannot be implemented safely without a product and data-model decision.
- Legacy route-template and automatic-rule entities remain a separate dormant configuration subsystem and are not applied by the leave engine. They should be formally retired or redesigned rather than silently reactivated.
- Explicit employee routes are treated as personal overrides based on the existing custom-route semantics; changing that precedence requires a documented business-rule decision.
- Production approval actions were not executed during verification; action correctness was tested against isolated databases to preserve live requests.

### Recommended next phase

Proceed to Phase 4 — Leave filing and policy enforcement. Centralize leave-day calculations, attachment requirements (including the established sick-leave weekday policy), balance checks, overlap rules, and submission validation with isolated policy tests.

## Phase 4 completion — Leave filing and policy validation

Completed: 2026-09-11 (Asia/Manila)

### Problems found and root causes

- The frontend excluded weekends but not configured holidays, while the backend used both; displayed duration and persisted duration could disagree.
- Sick Leave attachment rules were implemented only in the browser. A caller could bypass them through the JSON API.
- The request entered the approval workflow before files were uploaded, allowing a required-document request to become visible even when upload failed.
- Filing and rescheduling duplicated date, balance, daily-breakdown, and duration calculations.
- Rescheduling guessed database leave-type IDs from `VL`/non-`VL`, routing some leave types through the wrong policy and balance.
- Overlapping active requests, daily date coverage, hours bounds, attachment count, and server-side extension/size validation were incomplete.
- Attachment storage used the client filename in the stored path, creating collision and path-safety risks.

### Changes made

- Added one backend leave-policy service for active leave type, date range, holidays/weekends, hours, daily breakdown, overlap, balance, and attachment validation.
- Enforced the Sick Leave rule on the backend: one Tuesday–Thursday working day needs no document; two or more working days, or one Monday/Friday working day, require one.
- Added atomic multipart filing and rescheduling endpoints. Request, daily breakdown, approval snapshot, pending balance, attachment metadata, and audit trail commit together; written files are removed if the database transaction fails.
- Kept the legacy JSON endpoints compatible for requests that do not require documents; they cannot bypass required-document policy.
- Limited attachments to five files of 10 MB each and the established SVG, PNG, JPG/JPEG, PDF, and DOCX extensions. Stored names are server-generated and original names are retained only as metadata.
- The frontend now loads configured holidays for the selected year, mirrors the backend weekday/holiday calculation, sends request data and files together, and displays structured backend validation errors.
- Rescheduling now uses the request's actual leave-type ID, current holiday calendar, daily breakdown, and optional/required supporting documents.
- The existing three-step form remains explicit (details, supporting documents, review/submit), followed by a dedicated success result with actions to view the request, open My Requests, or file another leave.

### Files changed

- Backend policy: `Services/ILeavePolicyService.cs`, `Services/LeavePolicyService.cs`, `Program.cs`.
- Backend filing/rescheduling/upload integration: `Controllers/LeaveController.cs`.
- Frontend request contracts and multipart transport: `src/lib/api.ts`.
- Frontend phased filing and rescheduling: `src/pages/FileLeavePage.tsx`, `src/pages/LeaveDetailPage.tsx`.
- Tests: `tests/NotificationAccessChecks/LeavePolicyChecks.cs` and the test runner.

### Database changes

- None. No schema migration or production-data write was required, so no Phase 4 database backup was necessary.
- Automated policy tests used an isolated in-memory SQLite database only.

### Tests performed

- Sick Leave Tuesday exception, Monday/Friday requirement, multi-day requirement, and valid-document cases: PASS.
- Weekend and configured-holiday exclusion: PASS.
- Hours-based range and day conversion: PASS.
- Daily-breakdown completeness, overlap rejection, and insufficient balance: PASS.
- Unsupported and oversized attachment rejection: PASS.
- Full isolated Phase 0–4 backend suite: PASS.
- Clean backend build: PASS with the same five baseline nullable warnings and no new warnings.
- Frontend TypeScript/PWA production build: PASS (existing PWA deprecation warning only).

### Remaining risks

- Extension, size, and count are enforced, but attachment content signatures and malware scanning are not yet available. Deployment should add a scanner/quarantine integration before accepting untrusted external uploads.
- Cross-calendar-year deductible leave still uses the established single balance-year ledger behavior. A split-year accounting policy must be agreed with HR before changing it.
- Notification delivery occurs after the filing transaction. Phase 5/6 should add an outbox/retry boundary so delivery failure never obscures a committed request.
- Browser-level authenticated filing was not performed because it would create a production leave request; destructive workflow verification remains isolated by design.

### Recommended next phase

Proceed to Phase 5 — Approval and HR workflows. Consolidate approval transactions, prevent double actions, isolate post-commit notification failure, repair modal keyboard/focus behavior, align HR queues/details, and verify CSV exports.

## Phase 5 completion — Approval and HR workflows

Completed: 2026-09-11 (Asia/Manila)

### Problems found and root causes

- Approval state and leave-balance mutations were saved independently inside one logical action, allowing partial state if a later operation failed.
- Realtime delivery was attempted before the database transaction committed, so clients could observe work that later rolled back and a delivery exception could make a successful action appear failed.
- Approval rows and leave requests had no optimistic-concurrency checks, allowing two actors to process the same pending step concurrently.
- HR finalization accepted requests that were not fully approved and allowed an already-finalized request to be processed again.
- The finalization screen loaded a broad leave-request collection instead of an authoritative finalization queue.
- CSV generation happened in the browser and lacked a stable server contract, complete quoting, formula-injection protection, and deterministic download naming.
- Approval comments lacked consistent length validation and rejection reasons were not required by the backend.

### Changes made

- Approval status, workflow-step action, leave-balance ledger changes, audit records, and request processing now commit as one transaction.
- Added optimistic concurrency to leave-request status/date-processed and approval-step action. A stale action returns HTTP 409 with an instruction to refresh.
- Moved durable/realtime notification work after commit and isolated delivery failures from the completed business action.
- Required a rejection reason, limited approval/rejection remarks to 500 characters, and matched these limits in the approval modal.
- Stabilized dialog focus and disabled dismissal/actions during submission, preserving uninterrupted keyboard entry and preventing duplicate UI actions.
- Added an authoritative HR finalization-pending endpoint and constrained finalization to approved, unprocessed requests only.
- Added a server-generated CSV export with date validation, explicit headers, UTF-8 BOM, correct CSV quoting, spreadsheet-formula neutralization, and deterministic filenames.
- HR overview/finalization queues now refresh on relevant application events and organization changes; request details remain modal and can be closed without navigation.

### Files changed

- Concurrency model: `Data/AppDbContext.cs`.
- Approval transaction and validation: `Controllers/ApprovalController.cs`, `Services/LeaveService.cs`.
- HR finalization and CSV export: `Controllers/HRLeaveController.cs`.
- Frontend API and HR workflows: `src/lib/api.ts`, `src/pages/HRDashboard.tsx`.
- Approval dialog behavior: `src/pages/ApprovalsPage.tsx`.
- Tests: `tests/NotificationAccessChecks/ApprovalHrWorkflowChecks.cs` and the test runner.

### Database changes

- None. Concurrency tokens are runtime EF model metadata and require no SQLite schema migration.
- No production workflow action or data modification was performed; isolated tests used a temporary SQLite database.
- Post-restart production SQLite `integrity_check`: `ok`; foreign-key violations: none.

### Tests performed

- Concurrent processing of the same approval step rejects the stale writer: PASS.
- Pending requests cannot be finalized, approved requests finalize once, and repeat finalization returns Conflict: PASS.
- CSV content type, deterministic filename, UTF-8 BOM, headers, quoting, formula neutralization, and reversed-date rejection: PASS.
- Full isolated Phase 0–5 backend suite: PASS.
- Clean backend build: PASS with the same five baseline nullable warnings and no new warnings.
- Frontend TypeScript/PWA production build: PASS (existing PWA deprecation warning only).
- Live approval, HR finalization, and CSV endpoints returned HTTP 401 without authentication: PASS.

### Remaining risks

- Post-commit notification failures are logged and no longer corrupt action results, but guaranteed delivery still requires a persistent outbox and retry worker.
- Very large CSV ranges are materialized in memory; streaming or bounded export jobs should be introduced if data volume grows substantially.
- SQLite can surface lock contention under sustained multi-process writes; deployment-level retry/backoff and load testing remain appropriate.
- Authenticated production approvals/finalizations were intentionally not executed. Destructive workflow verification used isolated databases.

### Recommended next phase

Proceed to Phase 6 — Notifications. Introduce a durable outbox, idempotent delivery, reconnect-safe realtime updates, push-subscription diagnostics, audience enforcement, and delivery observability.

## Phase 6 completion — Notifications and real-time updates

Completed: 2026-09-11 (Asia/Manila)

### Problems found and root causes

- SignalR and Web Push delivery ran synchronously inside notification creation, coupling HTTP workflow success to external delivery availability.
- Failed deliveries were recorded but had no persistent worker to retry them after the request ended or the application restarted.
- Realtime reconnect refreshed data, but a failed initial connection or prolonged outage had no bounded polling fallback.
- Push-registration API failures surfaced as generic client errors and device settings did not show whether background delivery had ever succeeded.
- Delivery state mixed one-shot request handling with retry behavior, making idempotency and operational diagnosis difficult.

### Changes made

- Reused `NotificationDeliveries` as a durable outbox; notification, independent recipients, and SignalR/WebPush delivery intents are persisted together before delivery begins.
- Added a background delivery worker with bounded batches, five-attempt transient retry, permanent-failure classification, capability revalidation, and per-channel timestamps/errors.
- SignalR sends only an invalidation containing notification ID/workspace; clients retrieve authorized content through the API.
- Web Push now returns an explicit delivery outcome to the outbox dispatcher, honors recipient/event preferences, disables rejected subscriptions, and retains nonsensitive lock-screen payloads.
- Added bounded 15-second fallback refresh polling during realtime connection failure/reconnection, stopping after 20 attempts or immediately on reconnect.
- Preserved client event deduplication and forced an authorized refresh after reconnect.
- Improved PWA registration errors for server, permission, key, and authentication failures. Device settings now show first-delivery, last-success, or last-failure state.

### Files changed

- Durable creation: `Services/NotificationService.cs`.
- Outbox dispatcher/worker: `Services/NotificationDeliveryWorker.cs`, `Program.cs`.
- Web Push delivery outcomes: `Services/PushNotificationService.cs`.
- Reconnect and polling behavior: `src/services/notificationService.ts`.
- Push registration and diagnostics: `src/services/pushService.ts`, `src/components/PushDeviceSettings.tsx`.
- Notification delivery tests: `tests/NotificationAccessChecks/DeliveryChecks.cs`.

### Database changes

- None. The existing notification-delivery schema supports the outbox state and retry metadata.
- Before startup, production delivery inventory contained only completed rows (56 SignalR and 3 WebPush); no old pending/failed delivery can be replayed.
- No production notifications or subscriptions were created during testing.

### Tests performed

- Cross-role workspace isolation, deep-link isolation, capability filtering, ID-collision safety, independent read state, mark-all boundaries, and preference ownership: PASS.
- Durable persistence before delivery, per-recipient/per-channel fanout, event deduplication, disabled-push skip, and transient SignalR retry: PASS.
- Full isolated Phase 0–6 backend suite: PASS.
- Backend Debug and Release builds: PASS with the same five baseline nullable warnings and no new warnings.
- Frontend TypeScript/PWA production build and service-worker generation: PASS (existing PWA deprecation warning only).
- Live notification/push endpoints returned HTTP 401 without authentication; outbox pending/failed count remained zero after startup.
- Post-startup production SQLite `integrity_check`: `ok`; foreign-key violations: none.

### Remaining risks

- Delivery claiming is safe for the current single backend instance; multiple simultaneous backend replicas would require an atomic lease/claim field or an external queue.
- Web Push verification used deterministic fakes and did not send an unsolicited notification to a production user. Windows banner presentation still depends on Edge/PWA and Windows Focus Assist settings.
- Email preferences exist, but no email transport is configured; the UI already states this dependency.
- Delivery diagnostics are stored in the database but do not yet have a dedicated restricted operations screen.

### Recommended next phase

Proceed to Phase 7 — Frontend architecture and user experience. Break down the largest pages, centralize query/mutation state and errors, improve accessibility/responsiveness, and guard against stale asynchronous updates.

## Phase 7 completion — Frontend architecture and user experience

Completed: 2026-09-11 (Asia/Manila)

### Problems found and root causes

- Dashboard requests could resolve out of order after tab, role, realtime, or visibility changes and overwrite newer state.
- Employee and HR dashboards logged load failures but frequently rendered empty content with no actionable retry path.
- Repeated loading/error/status presentation was implemented independently across pages.
- Employee dashboard request rows were mouse-clickable but not keyboard-operable.
- Employee dashboard data did not consistently refresh after leave/approval events or after returning to the app.
- Leave-status labels and badge selection were duplicated and could format compound pending states inconsistently.

### Changes made

- Added a reusable latest-request guard that invalidates stale async responses and unmounted component updates.
- Added shared accessible loading and retryable error-state components with live-region semantics.
- Applied stale-response protection, explicit error/retry states, and background refresh behavior to the employee and HR dashboard containers.
- Employee dashboard now refreshes for relevant realtime invalidations and when the app becomes visible, while preserving current content during background refresh failures.
- Made recent-request rows keyboard accessible with Enter/Space activation and descriptive accessible labels.
- Centralized leave status labels and badge classes and adopted them in Employee Dashboard and My Requests.
- Preserved the existing reusable dialog focus trap, Escape handling, focus restoration, and responsive table wrappers.

### Files changed

- Async guard: `src/hooks/useLatestRequest.ts`.
- Shared page states: `src/components/ui/PageState.tsx`.
- Dashboard containers: `src/pages/EmployeeDashboard.tsx`, `src/pages/HRDashboard.tsx`.
- Status presentation: `src/lib/statusFormat.ts`, `src/pages/MyRequestsPage.tsx`.

### Database changes

- None. Phase 7 is frontend-only.

### Tests performed

- Frontend TypeScript typecheck: PASS.
- Frontend Vite/PWA production build and service-worker generation: PASS.
- Existing backend Phase 0–6 isolated suite remained PASS before the frontend-only changes.

### Remaining risks

- HR Dashboard and File Leave remain large feature containers. Their business behavior is now guarded, but further visual component extraction should be mechanical and covered by component tests in Phase 10 rather than mixed with behavior changes.
- The project currently has no frontend component-test runner; keyboard/focus behaviors are typechecked and code-reviewed but require automated DOM tests in Phase 10.
- Some lower-traffic administration pages still use local `any` types and bespoke error handling; these should migrate incrementally to typed feature services.

### Recommended next phase

Proceed to Phase 8 — Leave summary and printing. Make the two-page A4 layout deterministic, prevent clipping/duplication, and verify portrait and landscape output through rendered artifacts.

## Phase 8 completion — Leave summary and printing

Completed: 2026-09-11 (Asia/Manila)

### Problems found and root causes

- Print CSS did not declare an A4 orientation and depended on browser-selected scaling (135% portrait or 99% landscape).
- Pixel-based page, row, padding, and typography dimensions produced different pagination across printers and browser preview settings.
- Table column percentages totaled more than 100%, causing date and approval columns to compete for space and cross borders.
- Missing employment status silently printed as REGULAR, which could misrepresent employee data.
- Earlier print verification relied on screenshots rather than a generated PDF and exact page/element checks.

### Changes made

- Declared `@page { size: A4 portrait; margin: 5mm; }` and sized each sheet to the exact 200mm x 287mm printable area.
- Replaced print pixel sizing with millimeter/point dimensions, fixed row heights, and exact page breaks.
- Normalized all 15 table columns to exactly 100%, with dedicated widths for dates, recommended actions, balances, and remarks.
- Kept page 1 strictly numbered 1–20 and page 2 strictly numbered 21–40. Page 2 always prints and its data cells remain blank when fewer than 21 records exist.
- Removed manual scale instructions; the application now instructs A4 Portrait at 100%, duplex printing, and long-edge flipping.
- Formats Date Hired consistently and prints `NOT SET` rather than inventing REGULAR when employment status is missing.
- Corrected the Phase 7 latest-request hook for React Strict Mode remounts after rendered testing exposed a permanent loading state in development.

### Files changed

- Print form and deterministic CSS: `src/components/LeaveSummaryForm.tsx`.
- Strict Mode async lifecycle correction: `src/hooks/useLatestRequest.ts`.
- Rendered QA artifact: `output/pdf/leave-summary-phase8-qa.pdf`.

### Database changes

- None. The phase reads employee and leave data without modifying it.

### Tests performed

- Real React dashboard loaded in headless Edge with isolated mocked employee data: PASS.
- DOM assertions for exactly two sheets, page 1 numbering 1–20, page 2 numbering 21–40, populated record 21, and blank page-2 data below 21 records: PASS.
- Generated PDF reports exactly two A4 portrait pages with no rotation: PASS.
- Poppler render and full visual inspection of both latest pages: PASS; no clipped dates, overflowing approval labels, duplicated records, or border crossings.
- PDF text bounding-box check: PASS; every extracted word remains within its page.
- Page labels `Page 1 of 2` and `Page 2 of 2`: PASS.
- Frontend TypeScript/Vite/PWA production build: PASS (existing PWA deprecation warning only).

### Remaining risks

- Browser printer drivers can still impose hardware non-printable margins; `preferCSSPageSize` verification confirms standards-compliant browser output, while physical printers should retain A4 and 100% scale.
- The print layout is intentionally portrait and deterministic. A separate landscape template should only be added if HR requires it, rather than allowing the printer dialog to reshape this portrait form.
- Free-text cells are constrained to fixed row height; exceptionally long reasons/remarks are clipped to preserve the official one-page-per-side form and remain available in the digital request detail.

### Recommended next phase

Proceed to Phase 9 — Backend maintainability and reliability. Thin controllers, standardize validation/errors/logging, eliminate baseline nullable warnings, harden configuration, and add safe health endpoints.

## Phase 9 completion — Backend maintainability and reliability

Completed: 2026-09-11 (Asia/Manila)

### Problems found and root causes

- Unhandled exceptions relied on framework-default responses and lacked a stable, supportable correlation contract.
- No liveness/readiness endpoints existed for the application, SQLite connection, or notification outbox.
- Settings load/save failures were swallowed, hiding disk/permission/configuration faults.
- Five persistent nullable warnings obscured new warning regressions.
- Authentication and authorization information logs produced high-volume stack output for malformed/stale clients.
- Active-user projections used incompatible anonymous nullable types and labeled every employee as Employee rather than using the resolved organizational role.
- Several legacy ID-card and leave controllers remain large because HTTP mapping, storage, queries, and workflow orchestration accumulated in the same files.

### Changes made

- Added a global exception handler that logs structured method/path/correlation metadata and returns RFC-style Problem Details without exception text, credentials, or request data.
- Added validated `X-Correlation-ID` propagation; invalid/oversized supplied values are ignored in favor of the server trace identifier.
- Added anonymous `/health/live` and `/health/ready` endpoints with minimal non-sensitive component status; `/health/integrations` requires System Operations authorization.
- Readiness now checks application execution, SQLite connectivity, and stale notification-outbox deliveries.
- Settings persistence now initializes safely, logs load fallback, and surfaces save failures instead of falsely reporting success.
- Replaced fragile anonymous active-user projections with one typed DTO and preserved employee organizational roles.
- Removed all five baseline nullable warnings in Change Request, System Controllers, and Settings Manager.
- Reduced authentication/authorization log noise while retaining warnings/errors; JWTs and query-string tokens remain excluded from ordinary logs.
- Retained established domain services for leave policy, approval routing, notification delivery, and balance mutation rather than moving business rules back into controllers.

### Files changed

- Structured errors: `Services/ApiExceptionHandler.cs`, `Program.cs`.
- Health/readiness: `Services/ApplicationHealthChecks.cs`, `Program.cs`.
- Settings reliability: `Services/SettingsManager.cs`.
- Warning/query cleanup: `Controllers/ChangeRequestController.cs`, `Controllers/SystemControllers.cs`.
- Reliability tests: `tests/NotificationAccessChecks/ReliabilityChecks.cs` and the test runner.

### Database changes

- None. No migration or production-data write was required.
- Post-startup production SQLite `integrity_check`: `ok`; foreign-key violations: none.

### Tests performed

- Backend Debug build: PASS with zero errors and zero warnings.
- Backend Release build: PASS with zero errors and zero warnings.
- Full isolated Phase 0–9 backend suite: PASS.
- Database health reports Healthy against isolated SQLite: PASS.
- Stale notification outbox reports Degraded without exposing notification content: PASS.
- Unhandled errors return a correlated 500 Problem Details response without exception text: PASS.
- Live `/health/live`: HTTP 200 Healthy and correlation header round-trip: PASS.
- Live `/health/ready`: HTTP 200 Healthy for application, database, and notification outbox: PASS.
- Anonymous `/health/integrations`: HTTP 401: PASS.

### Remaining risks

- `LeaveController`, `DepartmentController`, `HRLeaveController`, and older ID-card controllers remain large. Their critical domain logic is already delegated to services, but further mechanical extraction needs endpoint-level regression coverage before changing file structure.
- SQLite remains appropriate for the current single-instance deployment; horizontal multi-writer scaling would require a database/queue architecture decision.
- Web Push key generation is protected with Windows DPAPI on this host. Multi-host deployments must explicitly configure shared WebPush keys through secure environment configuration.
- Health endpoints report component state only and intentionally omit paths, connection strings, exception messages, and personal data.

### Recommended next phase

Proceed to Phase 10 — Testing and quality gates. Add frontend DOM/component tests, API integration hosting tests, role-navigation coverage, PWA/update checks, and repeatable build/test commands that never use production data.

## Phase 10 completion — Testing and quality gates

Completed: 2026-09-11 (Asia/Manila)

### Problems found and root causes

- The frontend had no automated test runner, DOM environment, component tests, or role-navigation regression checks.
- Critical UI fixes for dialog focus and stale asynchronous responses were verified manually but could regress silently.
- PWA safety/update settings and the official two-sided print layout had no executable release contract.
- Frontend and backend checks required separate commands, making it easy to omit a build or accidentally choose the wrong database-backed runner.

### Changes made

- Added Vitest, jsdom, Testing Library, user-event, and jest-dom with a shared browser-like test setup.
- Added component tests proving approval-reason typing retains focus, Escape closes dialogs, and focus returns to the opening control.
- Added a React Strict Mode regression test proving late responses cannot overwrite newer results.
- Added role/capability tests for Employee, approver, HR Staff, HR Manager, Admin, and SystemAdmin navigation boundaries.
- Added status-format regression tests and executable contracts for the PWA update/cache policy and two-page A4 print layout.
- Exported the legacy capability resolver solely to make fallback role behavior directly testable; runtime behavior is unchanged.
- Added one `npm run quality` command that runs frontend typechecking, frontend tests, the production PWA build, a zero-warning backend Release build, and the complete isolated SQLite backend suite.

### Files changed

- Test/tooling configuration: `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `src/test/setup.ts`.
- Frontend tests: `src/lib/statusFormat.test.ts`, `src/contexts/AuthContext.test.ts`, `src/hooks/useLatestRequest.test.tsx`, `src/components/ui/DialogOverlay.test.tsx`, `src/components/LeaveSummaryForm.test.tsx`, `src/pwa.test.ts`.
- Role fallback test seam: `src/contexts/AuthContext.tsx`.
- Repeatable gate: `scripts/quality-gate.ps1`.

### Database changes

- None.
- Backend tests use a fresh in-memory SQLite database, remove test-only seed users, and never open or modify production `app.db`.

### Tests performed

- Frontend TypeScript check: PASS with zero errors.
- Frontend Vitest suite: PASS, 6 files and 15 tests.
- Frontend production Vite/PWA build: PASS. The dependency-owned injectManifest deprecation notice remains the previously documented Phase 8 warning.
- Backend Release build: PASS with zero errors and zero warnings.
- Backend isolated suite: PASS for authorization, logout/session isolation, migrations, notification boundaries and delivery, database constraints, routing and delegation, leave policy, approval/HR workflow, CSV safety, health checks, and correlated safe errors.
- Single-command `npm run quality`: PASS.

### Remaining risks

- The frontend tests exercise components and release contracts in jsdom; a future CI environment should add browser-driven smoke tests for each role against an ephemeral hosted API.
- The Vite PWA plugin currently emits an upstream deprecation notice for its internal Rollup option. This is not an application/compiler warning and should be rechecked when upgrading the plugin.
- The workspace is not a Git repository, so Git diff/status review and commit-based change isolation are unavailable.

### Recommended next phase

Proceed to Phase 11 — Deployment and operational readiness. Add a reproducible ephemeral end-to-end environment, CI execution of `npm run quality`, backup/restore drills, deployment configuration validation, and a release/runbook checklist.

## Phase 11 completion — Performance and observability

Completed: 2026-09-11 (Asia/Manila)

### Problems found and root causes

- The notification center fetched up to 100 records on every load even though the backend already exposed bounded pagination.
- Notification preferences were requested on every workspace and tab refresh, including when the Preferences panel was closed.
- A burst of legacy SignalR invalidation events could cause every subscriber to issue repeated API refreshes.
- Release builds reported chunk sizes but did not enforce a regression budget.
- Correlation IDs existed for failures, but successful/slow requests had no safe structured duration signal.
- The quality script rebuilt the backend application but used `--no-build` for the test runner, allowing newly added tests to be skipped by a stale Release binary.

### Changes made

- The notification center now loads 30 records at a time with an explicit Load More action, preserves the server total, and deduplicates appended records.
- The notification bell now fetches only its 10 visible records.
- Preferences load only when the Preferences panel is active.
- Legacy SignalR refresh events are coalesced into a 100 ms invalidation window; notification payload events remain immediate so visible alerts are not delayed.
- Added safe request-performance middleware. Normal requests log at Debug; requests taking at least one second emit a structured Warning containing method, endpoint display name, status, elapsed time, and correlation ID—never query strings, JWTs, PINs, request bodies, or personal data.
- Added executable JavaScript budgets: largest chunk at most 350 KiB and total JavaScript at most 800 KiB.
- Corrected the quality gate so the isolated backend test runner is rebuilt on every execution.

### Files changed

- Backend observability: `Services/RequestPerformanceMiddleware.cs`, `Program.cs`.
- Notification loading/reconnection behavior: `src/services/notificationService.ts`, `src/pages/NotificationsPage.tsx`, `src/components/NotificationBell.tsx`.
- Performance tests: `tests/NotificationAccessChecks/PerformanceChecks.cs`, backend test runner, `src/services/notificationService.test.ts`.
- Bundle/release gates: `scripts/check-bundle-budget.mjs`, `scripts/quality-gate.ps1`, `package.json`.

### Database changes

- None. Existing notification-recipient indexes and server pagination were sufficient for the measured path.
- No production data was modified by performance tests; they use isolated in-memory SQLite data.

### Tests and measurements performed

- Frontend TypeScript check: PASS with zero errors.
- Frontend suite: PASS, 7 files and 17 tests.
- Frontend production PWA build: PASS.
- Bundle budget: PASS; largest JavaScript chunk 316.3 KiB, total JavaScript 687.0 KiB across 30 lazy chunks.
- Backend Release build: PASS with zero errors and zero warnings.
- Notification pagination: PASS for default 30 items, accurate total, and maximum 100-item clamp.
- Observability: PASS for slow-request warning and exclusion of query strings/access tokens.
- Full rebuilt isolated backend suite: PASS.
- Live Release backend `/health/ready`: HTTP 200; application, database, and notification outbox Healthy.

### Remaining risks

- Company Pending and several HR directory endpoints still return complete collections. Current company size is small, but these endpoints should gain server pagination before materially larger deployments.
- CSV generation materializes filtered rows and the final byte array in memory. This is safe for the current dataset; a streaming export should be introduced if measured exports become large.
- EF command text remains suppressed from ordinary logs to prevent accidental personal-data exposure. Query-count profiling should use an explicitly isolated diagnostic environment.
- The PWA plugin continues to emit its dependency-owned `inlineDynamicImports` deprecation notice.

### Recommended next phase

Proceed to Phase 12 — final role-based regression and documentation, including environment setup, migration, backup/recovery, API/role references, troubleshooting, and deployment checklist.

## Phase 12 completion — Final regression and documentation

Completed: 2026-09-12 (Asia/Manila)

### Problems found and root causes

- Frontend and backend READMEs described an older topology and did not document mandatory signing-key configuration, current role boundaries, or the unified quality gate.
- Docker backend builds referenced `export_for_docker.db`, but that file does not exist.
- Docker Compose omitted the mandatory JWT signing key, so production startup would fail only after image creation.
- Compose exposed both the legacy `autoid-web` frontend and current OnlineFS frontend, making the supported deployment ambiguous.
- Migration, backup, recovery, rollback, troubleshooting, API boundaries, and deployment acceptance had no single canonical runbook.

### Changes made

- Replaced both READMEs with current OnlineFS/backend setup, topology, test, and documentation links.
- Added architecture, capability matrix, API boundary, operations, migration, backup/recovery, rollback, troubleshooting, and release-checklist documents.
- Made frontend container dependency installation reproducible with `npm ci`.
- Removed the missing bundled seed database from the backend image. Fresh persistent databases now use the checked-in EF migration chain; existing volume data is upgraded in place.
- Made Compose fail closed unless `ONLINEFS_JWT_SIGNING_KEY` is supplied and documented trusted-origin configuration.
- Removed the ambiguous legacy frontend service from the supported OnlineFS Compose stack.
- Added deployment-contract tests for reproducible frontend installation, persistent data, signing-key enforcement, and absence of a missing seed database.

### Files changed

- Canonical documentation: `README.md`, `docs/ARCHITECTURE.md`, `docs/OPERATIONS.md`, `docs/API.md`, `docs/TROUBLESHOOTING.md`.
- Backend orientation: `C:\Users\g.adorio\Documents\AutoID\README.md`.
- Deployment: frontend `Dockerfile`; backend `Dockerfile.backend`, `entrypoint.sh`, and `docker-compose.yml`.
- Deployment regression tests: `src/deployment.test.ts`.

### Database changes

- None. Production data and schema were not modified.
- The final automated suite used isolated in-memory SQLite only.
- Live readiness confirmed database connectivity after the Release backend restart. Phase 9 already verified production SQLite integrity and foreign keys; the standalone `sqlite3` CLI is not installed on this workstation for an additional duplicate check.

### Final regression performed

- Frontend TypeScript: PASS with zero errors.
- Frontend tests: PASS, 8 files and 19 tests, including role navigation, modal focus, stale requests, PWA/print/performance, and deployment contracts.
- Production PWA build and bundle budget: PASS; largest JavaScript chunk 316.3 KiB, total 687.0 KiB across 30 lazy chunks.
- Backend Release build: PASS with zero errors and zero warnings.
- Rebuilt isolated backend suite: PASS for Employee, approver, HRStaff, HRManager, Admin, and SystemAdmin boundaries; login/logout/session isolation; leave filing and SL attachments; routing/delegation; approve/reject/finalize; balances; department and employment constraints; notifications; CSV; migrations; health; reliability; and observability.
- Live Release backend `/health/ready`: HTTP 200, application/database/outbox Healthy.
- Anonymous `/health/integrations`: HTTP 401 as required.
- Documentation targets and cross-links: present.

### Verification limitations

- Docker is not installed on this workstation, so Compose parsing and image execution could not be performed locally. Static deployment-contract tests pass, but the release checklist requires an image build on the deployment/CI host.
- No production approve, reject, finalize, department mutation, or notification delivery was performed for regression safety.
- Physical Windows notification and printer-driver behavior require acceptance on the target desktop; application PWA and A4 print contracts are automated and the print artifact was rendered in Phase 8.
- The dependency-owned PWA `inlineDynamicImports` deprecation/timing notice remains; application and backend compilation are clean.

### Recommended operational next step

Run the documented deployment checklist on the target host with Docker available, an approved secret source, a verified production backup, TLS, and isolated acceptance accounts. The phase refactor plan is otherwise complete.
