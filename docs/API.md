# OnlineFS API reference

## Sick Leave review and grouped signatories

`POST /api/leave/{id}/extend-sick-leave` accepts multipart form data: `request` is JSON with `expectedDateTo`, a later `dateTo`, and an assessment `reason`; optional `files` add supporting documents. It requires HROperations and an HR employee assigned to the active HR Review stage. The response includes the new dates/duration and `notificationsQueued`. Policy failures return 400; changed dates or an unavailable review stage return 409. It updates the pending request without signing it.

`POST /api/approval/{id}/approve` requires `fitnessAssessment` (`FitToWork` or `RestRequired`) and `expectedDateTo` for an HR Review step. Other stages retain the existing request format. Any one member can decide a grouped stage. Pending approval/request detail responses include nullable `stageOrder` and `stageKind`; null metadata means a legacy sequential step.

Department create/update accepts `firstApproverIds` for Recommending and `notedByApproverIds` for the optional earlier Noted by stage. Existing singular `firstApproverId` clients remain compatible. Department route preview accepts `leaveTypeCode=SL` to show the mandatory HR-first route. Reconciliation retains existing snapshots and reports zero updated requests. See [setup and workflow](SICK_LEAVE_APPROVALS.md).

All business endpoints use `/api`. JWT authentication is required except login and anonymous liveness/readiness health checks. Backend capability policies—not UI visibility—control access. Error responses use Problem Details and include an `X-Correlation-ID` header.

| Area | Principal routes | Required boundary |
|---|---|---|
| Authentication | `POST /api/auth/login`, `employee-login`; authenticated `logout`; `GET /api/auth/access` | Public login; authenticated logout/access |
| Personal leave | `/api/leave/my-profile`, types, balance, requests, apply/reschedule/cancel, attachments, history | PersonalLeave; employee scoped |
| Approvals | `/api/approval/pending`, `{id}/approve`, `{id}/disapprove`, team calendar | Approvals plus assigned/effective delegated step |
| HR | `/api/hr/finalization-pending`, ledger, balances, employees, reports, `export.csv`, finalize | HROperations; mutations may require HRManagement |
| Organization | `/api/category`, `/api/department`, route preview/reorder/reconcile | HRManagement |
| Delegation | `/api/delegation`, `my-delegations`, create/revoke | Authenticated approver or authorized management boundary |
| Notifications | `/api/notifications`, unread count, detail/read/read-all/preferences | Recipient plus workspace capability |
| Push | `/api/push/public-key`, subscriptions | Authenticated owner |
| System | `/api/system-operations/*`, employee statuses | SystemOperations |
| Backup & restore | `GET /api/backup/history`, `GET /api/backup/download/{name}`, `POST /api/backup/create`, `POST /api/backup/restore/uploads`, `PUT /api/backup/restore/uploads/{id}/chunks/{index}`, `POST /api/backup/restore/uploads/{id}/complete`, `DELETE /api/backup/restore/uploads/{id}`, `POST /api/backup/restore/preview-saved`, `POST /api/backup/restore/apply` | SystemOperations; each upload chunk is at most 8 MiB; restore apply requires a validated, unexpired preview and exact `RESTORE` confirmation |
| User roles | `/api/systemadmin/*` | UserRoleManagement |
| Health | `/health/live`, `/health/ready`, `/health/integrations` | First two anonymous/non-sensitive; integrations requires SystemOperations |

Notification listing accepts `workspace`, `category`, `unread`, `type`, `page`, and `pageSize`; page size is capped at 100. CSV exports validate date order, return UTF-8 with BOM, and escape formulas and quoted fields.

Large restore uploads start with JSON `{ "fileName": "backup.zip", "totalLength": 123456 }`; the response returns an upload ID, 8 MiB chunk size, and chunk count. Send each chunk as a raw `application/octet-stream` PUT to its numbered route. Chunks may arrive in parallel and retries of an already received identical chunk are safe. Complete the upload to validate ZIP integrity, SQLite integrity, and schema compatibility; the returned preview is then applied using JSON `{ "restoreId": "…", "confirmation": "RESTORE" }`. Uploads support archives up to 10 GB and expanded contents up to 20 GB. The legacy multipart preview route remains available for files up to 90 MiB. Invalid paths, unsupported archive entries, SQLite integrity/foreign-key errors, and migrations unknown to the running build are rejected before application. Applying a validated restore pauses API operations and the notification worker, creates an automatic pre-restore safety backup, migrates the staged database to the running build, rebases stored file paths to the current data directory, then replaces the database and managed data files. See [operations recovery guidance](OPERATIONS.md#backup-and-recovery) for contents and limitations.

`GET /api/approval/{leaveRequestId}/leave-summary?year={year}` returns the employee leave summary only while the authenticated approver (or an active delegate) is the effective assignee of that request's current pending approval step. It returns only that request employee's profile, that year's leave balances, and up to 40 recent leave requests. A request that is no longer pending with the caller, or belongs to another approval route, returns `404`.

Swagger is available only in Development. Never enable development Swagger or detailed exception pages on a public production host.
