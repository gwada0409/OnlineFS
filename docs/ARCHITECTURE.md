# Architecture and access boundaries

## Runtime flow

The React PWA calls same-origin `/api/*` endpoints through Axios and connects to `/hubs/notifications` through SignalR. NGINX proxies both paths to ASP.NET Core. The backend authenticates JWTs, resolves the current database identity and capabilities, executes domain services, and persists to SQLite. Notification events are recorded in a durable outbox before SignalR, email, or Web Push delivery is attempted.

Backend authorization is authoritative. Hiding a link in React is usability—not security—and direct URLs remain subject to API policies.

## Workspaces and capabilities

| Identity | Personal leave | Approvals | HR operations | HR management | System operations | User/role management |
|---|---:|---:|---:|---:|---:|---:|
| Employee | Yes | Only when assigned | No | No | No | No |
| Employee approver | Yes | Yes | No | No | No | No |
| HRStaff | Yes | Only when assigned | Yes | No | No | No |
| HRManager | Yes | Only when assigned | Yes | Yes | No | No |
| Admin account | No | No | Yes | Yes | Yes | No |
| SystemAdmin account | No | No | Yes | Yes | Yes | Yes |

An approver may act only on an active step assigned directly to them or covered by an effective, non-circular delegation. Numeric User and Employee IDs are separate identity domains.

## Domain ownership

- `LeavePolicyService`: working days, holidays, hours, balances, overlaps, attachment rules
- `LeaveApprovalRoutingService`: route resolution, snapshots, delegation, reconciliation, pending queues
- Notification service and dispatcher: audience creation, deduplication, durable outbox delivery
- Controllers: HTTP validation/mapping and authorization boundaries
- React feature pages/services/hooks: presentation, interaction, bounded loading, and stale-response protection

## Important invariants

- Completed approval steps and signed history are immutable.
- Request approval snapshots are preserved after routing changes. New filings use the updated route; existing pending and completed workflows retain their original signatories. See [Sick Leave review and grouped stages](SICK_LEAVE_APPROVALS.md).
- Sick Leave attachments are required for two or more working days and for any one-day Monday/Friday request.
- Notification recipients have independent read state and cannot cross Personal/Approval/HR/System capability boundaries.
- Finalization and balance mutation are transactional and cannot be repeated.
