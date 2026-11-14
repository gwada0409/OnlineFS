# OnlineFS notification and workspace audit

Date: 2026-09-07

## Outcome

The employee-only notification identity model was replaced by capability-checked employee and system-user recipients. Personal, Approvals, HR, and System inboxes are filtered at the API, and each recipient has an independent read and delivery state. This change has been compiled and tested against an isolated SQLite database. It has **not** been applied to the live database and has not been manually validated with every real account/device.

## Root causes

- Notification ownership used only `RecipientEmployeeId`; Admin and SystemAdmin are `User` accounts and numeric IDs can overlap employee IDs.
- Frontend role hierarchy mixed personal, approval, HR, and system functions and could not substitute for endpoint authorization.
- SignalR grouped administrators separately from the employee-only delivery target, so persistence, realtime delivery, and UI identity disagreed.
- Read state lived on the notification, preventing safe shared audiences.
- Severity was being used without an independent category/workspace boundary.
- Push subscription lookups could compare nullable employee IDs and did not model system-user preferences independently.

## Capability matrix

| Principal | PersonalLeave | Approvals | HROperations | HRManagement | SystemOperations | SystemAlertManagement | UserRoleManagement |
|---|---:|---:|---:|---:|---:|---:|---:|
| Employee | Yes | Only when assigned/delegated | No | No | No | No | No |
| Approver/delegate | Yes | Yes | No | No | No | No | No |
| HRStaff employee | Yes | Only when assigned/delegated | Yes | No | No | No | No |
| HRManager employee | Yes | Only when assigned/delegated | Yes | Yes | No | No | No |
| Admin user | No | No | Yes | Yes | Yes | Yes | No |
| SystemAdmin user | No | No | Yes | Yes | Yes | Yes | Yes |

Employee capabilities are resolved only when the signed EmployeeID claim matches the employee record. System-user capabilities are resolved only when ID and username match the `User` record. A coincident numeric ID is never treated as an identity link.

## Category and audience matrix

| Workspace | Categories | Required capability | Typical recipients |
|---|---|---|---|
| Personal | PersonalRequest | PersonalLeave | The affected employee |
| Approvals | ApprovalAction | Approvals | Named assigned/delegated approvers |
| HR | HROperations | HROperations | HRStaff and HRManager |
| HR | Compliance | HRManagement | HRManager |
| System | SystemOperations, Integration, Configuration, Announcement | SystemOperations | Admin and SystemAdmin |
| System | Security | UserRoleManagement | SystemAdmin |

Severity (`Info`, `Success`, `Warning`, `Critical`) affects urgency only; it does not authorize access.

## Data and migration

Migration: `AutoID/src/AutoID/Migrations/20260907003930_NotificationPrincipalRecipients.cs`

- Adds normalized `NotificationRecipients` with exactly one Employee or User identity.
- Adds per-system-user notification preferences and links deliveries to recipients.
- Adds category, workspace, and required-capability metadata.
- Preserves historical employee recipient, unread/read state, timestamp, and preferences.
- Backfills uncertain historical notifications as `PersonalRequest` / `Personal` / `PersonalLeave`; it never broadens old content to HR or System audiences and creates no fake employees.
- The migration is intentionally forward-only because the old schema cannot represent shared/system recipients and independent read states. Rollback requires a verified pre-migration database backup plus the matching application version.

The full migration chain and backfill were tested in an in-memory SQLite database. The production migration was applied on 2026-09-07 after taking a stopped-state backup at `AutoID/backups/app-before-notification-migration-20260907-1205.db`.

## API and authorization changes

- `GET /api/notifications` — current principal only; optional workspace/category/type/unread filters and pagination.
- `GET /api/notifications/unread-count` — current principal and authorized categories only.
- `GET /api/notifications/{id}` — secured detail lookup used after realtime invalidation.
- `PUT /api/notifications/{id}/read` — recipient-scoped read state; system acknowledgements are audited.
- `PUT /api/notifications/read-all` — recipient-, workspace-, and category-scoped; system bulk acknowledgements are audited.
- `GET/PUT /api/notifications/preferences` — separate employee/system-user storage; partial updates preserve omitted values.
- `GET /api/auth/access` — returns the server-resolved principal kind, role, and capabilities.
- `GET /api/system-operations/overview` — system-recipient operational counts and recent events only.
- `GET /api/system-admin/employee-directory` — redacted directory for role administration without HR leave data.

Policies added: `PersonalLeave`, `Approvals`, `HROperations`, `HRManagement`, `SystemOperations`, `SystemAlertManagement`, and `UserRoleManagement`. Approval actions and team calendar now require Approvals; HR-wide pending and employee balances require HROperations; role administration requires UserRoleManagement. Leave attachments reuse the secured leave-request authorization check.

## SignalR and push design

Authenticated connections join only verified applicable groups: `Employee:{id}`, `Approver:{id}`, `HR:Operations`, `HR:Managers`, `System:Operations`, and `System:Administrators`. Notification rows and recipient rows are committed before realtime delivery. The server emits a content-free `NotificationAvailable` invalidation to the exact recipient group; the client then retrieves the authorized notification through the API. Reconnect triggers API recovery. Event IDs suppress duplicate in-app toasts.

Web Push is the sole OS-toast producer. Payloads are generic and do not contain employee leave details. Subscriptions and preferences are scoped to the exact Employee or User identity. Delivery attempts are recorded per recipient, invalid subscriptions are revoked, and delivery failures create a generic Integration alert for system operators.

## Frontend files changed

- `src/contexts/AuthContext.tsx`
- `src/App.tsx`
- `src/pages/MainLayout.tsx`
- `src/pages/NotificationsPage.tsx`
- `src/pages/SystemOperationsPage.tsx`
- `src/pages/SystemAdminDashboard.tsx`
- `src/components/NotificationBell.tsx`
- `src/services/notificationService.ts`
- `src/types/notification.ts`
- `src/lib/api.ts`

## Backend files changed

- `src/AutoID/Program.cs`
- `src/AutoID/Data/AppDbContext.cs`
- `src/AutoID/Models/Notification.cs`
- `src/AutoID/Services/AccessCapabilities.cs`
- `src/AutoID/Services/INotificationService.cs`
- `src/AutoID/Services/NotificationService.cs`
- `src/AutoID/Services/PushNotificationService.cs`
- `src/AutoID/Services/OperationalAlertFilter.cs`
- `src/AutoID/Hubs/NotificationHub.cs`
- `src/AutoID/Controllers/NotificationsController.cs`
- `src/AutoID/Controllers/SystemOperationsController.cs`
- Authorization changes in Auth, Leave, Approval, HRLeave, Department, Category, routing, delegation, employee, system, and SystemAdmin controllers.
- Migration, designer, and model snapshot listed above.
- `tests/NotificationAccessChecks/*`

## Automated results

All checks passed on 2026-09-07:

- Employee, approver, HRStaff/dual-role, HRManager, Admin-without-Employee, and SystemAdmin-without-Employee capability boundaries.
- Admin/Employee numeric-ID collision isolation.
- Unauthorized counts, reads, mark-read, mark-all, and direct notification-detail deep links.
- HRStaff exclusion from SystemAdmin security alerts, even if mistakenly addressed.
- System overview count isolation and HRStaff denial.
- Shared notification independent read state and exact-one-recipient database constraint.
- Separate system preferences and system acknowledgement audit records.
- Complete migration chain and historical private read-state backfill.
- Persist-before-SignalR, exact per-user groups, recipient delivery records, and deduplication.
- Frontend TypeScript/Vite/PWA production build.

The backend build retains five pre-existing nullable-reference warnings in `SettingsManager`, `SystemControllers`, and `ChangeRequestController`; no new build error was introduced.

## Remaining rollout work and risks

- Test real Employee, approver, HRStaff, HRManager, Admin, SystemAdmin, and dual-role accounts in the deployed UI. Browser/Windows Web Push requires an installed PWA, permission, a current subscription, configured VAPID keys, and Windows notification settings; this was not end-to-end tested here.
- Approval deadline, overdue, and HR-manager escalation jobs remain disabled because no business SLA thresholds were provided. The thresholds must specify working days, calendars/holidays, and escalation timing.
- The current system dashboard reports persisted operational events, not fabricated integration/database health. Dedicated probes and background-job telemetry must be connected before claiming live health monitoring.
- Missing-document, low-balance, compliance, coverage-gap, failed import/export, authentication-pattern, and infrastructure-alert producers are not all wired. The model and boundaries support them, but each real producer needs an explicit trigger and non-sensitive message.
- Realtime delivery failures have per-recipient status and immediate push retry, but there is no durable background outbox for later SignalR/email retry.
- A broader legacy endpoint audit is still recommended for non-leave ID-card/import/settings APIs outside this notification/workspace change.
