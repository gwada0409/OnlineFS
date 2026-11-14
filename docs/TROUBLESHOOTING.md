# Troubleshooting

## Backend will not start

- `Jwt:SigningKey is required`: provide `JWT__SIGNINGKEY` with at least 32 UTF-8 bytes.
- Database errors: confirm `DB_PATH` points to the intended writable database and inspect `/health/ready`.
- Port conflict: identify the exact process bound to port 5000; do not kill unrelated `dotnet` processes.
- Migration failure: stop, preserve logs/database, and restore the verified pre-release backup. Do not manually edit migration history.

## Login succeeds but navigation is missing

Call authenticated `GET /api/auth/access` and compare returned capabilities with the role matrix. Re-login after role changes so the session and frontend state refresh. Direct access is intentionally denied when the backend capability is absent.

## Pending request is missing or approval fails

Use Department route preview for the employee. Confirm current `DepartmentId`, department Recommending role, category Approver, active delegation dates, and the request approval-step snapshot. Completed workflows intentionally do not rewrite after hierarchy changes. Use the response correlation ID to locate the safe server log entry.

## Notifications update in-app but Windows toast is absent

Confirm browser permission is Allowed, the PWA is installed, the device subscription is active, Windows Focus/Do Not Disturb is off, and OnlineFS appears in Windows notification settings after a successful system notification. SignalR updates the in-app counter; Windows toasts require Web Push/service-worker delivery and matching preferences.

## PWA does not update

Reload while online and accept the update prompt. If the installed app is stuck, close all OnlineFS windows, reopen, and inspect the service worker with browser application tools. API and SignalR responses are NetworkOnly and must never be recovered from cache.

## CSV report fails

Check that Date To is not before Date From, the account has HR access, `/health/ready` is healthy, and note the response correlation ID. The browser must allow downloads from the site.

## A4 leave summary prints incorrectly

Use A4, Portrait, 100% scale, two-sided printing, and long-edge flip. Page 1 contains records 1–20 and page 2 contains records 21–40 or blank rows. Disable browser headers/footers if the printer driver adds them.

## Health and logs

- `/health/live`: process liveness
- `/health/ready`: application, SQLite, and notification outbox
- `/health/integrations`: authorized integration detail
- Requests taking at least one second emit a warning with endpoint, status, duration, and correlation ID. Logs intentionally omit query strings, JWTs, PINs, bodies, and HR content.
