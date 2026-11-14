# Approver leave coverage

Implemented locally and deployed to the Linux server on October 16, 2026.
See [deployment verification](DEPLOYMENT_2026-10-16.md).

## Setup and use

1. Open **Departments**, select a department, and choose **Configure backups**.
   Assign a backup for **Noted by / Line leader**, **Recommending**, and
   **Approver / 2nd approver**, then save. These are separate from the normal
   stage members and the category's primary approver.
2. Open **Delegation Management → Approver Leave → Record Approver Leave**.
   Select the unavailable employee, inclusive start/end dates, and a reason.
   Leave already in progress can be recorded if its end date is today or later.
   The form previews the department backups and warns about missing or
   unavailable coverage.
3. During those dates, the available backup receives the existing stage for
   **manual approval**. Operators still select a configured department line
   leader; if that leader is on leave, the department's Noted by backup acts.
   The same backup covers the designated Sick Leave line leader after HR review.
4. Use **End leave coverage** when the original approver returns early. The
   remaining pending work returns immediately. Scheduled and historical records
   remain available through the filters. Coverage otherwise expires after the
   selected end date.

Recording absence controls approval availability; it does not file an employee's
leave request or change their leave balances. No absence records or backup
employees were preselected in the real local database.

## Routing and history

- Backups have no authority before the absence starts or after it ends.
- An absent employee cannot act on approval work. A backup who is also absent,
  or who filed the request, cannot approve it. Missing available coverage leaves
  the request pending; it never skips or automatically approves a stage.
- Existing dated **Manual Delegations** remain available and take precedence
  over department backups. For line-leader stages, a recorded absence is needed
  before another person may cover the selected leader.
- Earlier stages must finish first. Requests paused for employee details remain
  in the backup's waiting list and cannot be approved while paused.
- HR assessment remains restricted to assigned HR reviewers. A department
  backup does not replace HR Review.
- A decision keeps the original assignee and records the actual actor, absence
  or manual delegation reference, signature, and on-behalf-of audit entry.
  Completed decisions do not move when coverage changes.
- Newly filed requests retain their routing department in the snapshot, even if
  the employee later transfers. Older snapshots without a department identifier
  use the employee's current leave routing department to find backups.
- Active absence creation/early return notifies the approver receiving existing
  pending work. Filing notifications, stage advancement, conversations, and HR
  reminders use the same effective-approver rules as the queue and decision API.
  Scheduled coverage is evaluated by date when queues and actions are requested.

## Local implementation and verification

The additive EF migration `AddApproverAbsencesAndDepartmentBackups` creates
`ApproverAbsences`, adds three nullable department backup assignments, and adds
absence/department references to approval snapshots. Older department clients
that omit backup settings preserve existing assignments. The absence endpoints
require the existing `HROperations` policy; employee approval authority remains
independent of system administrator accounts.

Source and a consistent SQLite backup were saved under
`D:\Projects\backups\approval-absence-coverage-20261016` before changes.
Migration rehearsal on a disposable local database copy preserved all original
columns across **33 tables and 6,071 records**, with a successful integrity check
and no new foreign-key violations. The migration was then applied locally.

Validation:

- 86 frontend tests passed, including department backup editing, absence
  creation/conflicts, early return, and unavailable-backup warnings.
- 86 existing line-leader workflow checks and 51 absence coverage checks passed
  against synthetic in-memory SQLite data.
- 40 browser cases passed across 390, 718, 767, 768, and 1440px in light/dark
  themes, all at 884px height. They exercise configuration, leave records,
  early return, history, manual-delegation access, mobile overflow, touch
  dimensions, and input fonts. All application API writes are intercepted.
- Frontend production build and backend compilation passed.

```powershell
# D:\Projects\OnlineFS
npm test -- --maxWorkers=2
npm run build
# Set PLAYWRIGHT_MODULE if Playwright is supplied outside node_modules.
node scripts/absence-coverage-check.cjs

# D:\Projects\AutoID
dotnet run --project tests/LineLeaderWorkflowChecks/LineLeaderWorkflowChecks.csproj --configuration Coverage
```

Browser screenshots/metrics are in `output/absence-coverage`. Migration
verification is in `AutoID/.local/coverage-migration-validation.json`.
Local notification delivery remains disabled by the existing `Start-Local.ps1`
configuration; this avoids sending external push deliveries from the copied
server database. Local application/database health remains distinct from that
notification-outbox diagnostic.

## Department scrolling follow-up

The new backup summary increased the settings header beyond the detail panel's
available height, clipping the Members section when only its body could scroll.
The complete department detail panel now owns vertical scrolling, while its
settings and body retain their natural heights. Members remain on the department
page; Manage People is used for assignment changes. Six mouse-wheel browser
checks passed at 1366×720, 1440×900, and 718×884 in light/dark themes, reaching the
last of 30 synthetic employees without opening a dialog or writing to the API.
Route Preview remains reachable, and the production build passed. Screenshots
and measurements are in `output/department-scroll`.

The Members table also now places name, ID, position, and department under their
matching headers, with **Department** replacing **AutoID Department**. Cells are
vertically centered; IDs, position names, role badges, and action labels remain
on one line on desktop while employee names can wrap. Below 768px the same rows
render labeled cards. Eight subsequent light/dark browser checks passed at
1366×720, 1440×900, 718×884, and 390×844, validating the values in all 30 rows,
column alignment, readable metadata/action labels, and member scrolling. The
production build passed.
