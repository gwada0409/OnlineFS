# Mobile overhaul

## Audit and scope

The application uses React, TypeScript, Tailwind, and shared CSS. Scanning
`src/components` identified shared dialogs, notifications, checkbox controls,
and the report designer. The route shell is in `src/pages/MainLayout.tsx`.
The three largest active pages selected for the overhaul were:

| Page | Initial size | Mobile bottlenecks |
| --- | ---: | --- |
| FileLeavePage | 49,471 bytes | Daily table with fixed-width selects, two-column time fields, hidden stage labels, hover-only remove action, primary actions far down a long form |
| LeaveDetailPage | 43,399 bytes | Desktop daily table, long attachment filenames, crowded action row, compressed timeline, bespoke centered reschedule modal |
| HRDashboard | 37,694 bytes | Wide company-pending and overview tables, duplicate mobile and desktop tab controls, dense report filters/results, small finalization controls |

The shell combined role, theme, tutorial, notifications, and a floating menu
button in a limited header. Existing CSS forced data tables to 520–600px even on
phones and let `.btn-sm` fall below 44px. Several responsive overrides applied
only below 640px, leaving the 640–767px range cramped.

## Implementation

All new responsive styles are in `src/mobile.css`, imported after the existing
styles and scoped to `@media (width < 768px)`. Existing desktop styles remain in
place, including their tablet sidebar behavior.

- `MobileNavigation` provides up to four capability-based shortcuts plus More.
  The More sheet contains authorized secondary routes, theme selection, tutorial
  access, and sign-out. `src/lib/navigation.ts` supplies both mobile and desktop
  navigation so their permissions and destinations stay aligned.
- `.mobile-bottom-nav` reserves content space and accounts for the device's
  bottom and side safe areas. The shell uses `100dvh`; its main header is 60px
  with device top-safe-area spacing outside that height.
- `.mobile-record-table` transforms nine existing tables into stacked cards.
  Scoped column headers and explicit `data-label` attributes preserve labels;
  the same inputs, handlers, and state serve both layouts. Status appears near
  the title, secondary values use a two-column grid, and action buttons fill
  the card width. The existing HR ledger cards retain their explicit buttons.
- `.mobile-form-grid` and `.form-row` stack form columns below 768px. Inputs
  have at least 16px text and 48px height; buttons, links, and checkbox controls
  have at least 44px targets. Numeric report filters request a decimal keyboard,
  date/time inputs retain native types, and HR name entry uses name autocomplete.
- Filing stages retain readable labels. File removal stays visible on touch
  screens. The filing action bar sticks above navigation; long names wrap or
  truncate without widening the page.
- Shared `DialogOverlay` content is portaled to the document body so transformed
  or sticky ancestors cannot clip it. Mobile dialogs and notifications become
  bottom sheets with bounded dynamic height, safe-area padding, scroll handling,
  Escape dismissal, focus trapping, and focus restoration. The reschedule dialog
  now uses that shared behavior while retaining its desktop content layout.

## Verification and immediate testing

Open the existing local app at `http://localhost:5173`. Use browser device
emulation at **320, 390, and 767px**, then switch to **768, 1024, and 1440px**.

1. As an employee, use Home, File Leave, Requests, and Alerts. As HR, check HR,
   People, Approvals, and More. Unauthorized destinations must remain absent.
2. File a multi-day leave; choose a half day and AM/PM, attach a long-named file,
   and navigate between stages. Check full-width actions above the bottom bar.
3. Open a request, review daily cards and attachments, and open Reschedule.
   Close with Escape and check that focus returns to the trigger.
4. In HR, switch between Overview, Company Pending, Finalize Requests, and
   Reports. Open detail/finalization sheets and generate a report. Check card
   labels, legible inputs, reachable actions, and no horizontal page scrolling.
5. Open More and Notifications. Check keyboard focus and sheet scrolling.
   Rotate or resize to desktop; the original desktop navigation should return.

Automated checks:

```powershell
npm test
npm run build
# Requires Playwright and an installed Microsoft Edge browser:
$env:PLAYWRIGHT_MODULE = '<path to playwright module>'
node scripts/mobile-ux-check.cjs
```

The browser harness intercepts every API request with synthetic data and blocks
service workers; it never submits data to the real backend. It checks overflow,
horizontal control bounds, touch target dimensions, input fonts, header height,
navigation, focus handling, filing stages, half-day state, report cards, and
reschedule/finalization sheets. Screenshots and metrics are in
`output/mobile-ux`. Existing source is backed up under
`D:\Projects\backups\OnlineFS-before-mobile-overhaul-20261016`.

The original application's bundle-size gate already exceeded its 800 KiB total
JavaScript limit (801.6 KiB). This implementation is approximately 806 KiB. The production
build succeeds; the existing bundle budget remains a separate failing check.
No limit was raised and no dependencies were added.

## Follow-up: approval annotations

The Pending Approvals page and the dashboard's Pending Approvals section now
use a shared `ApprovalRequestCard` below 768px. The card title, Review request
button, and non-interactive card area open the specific `/leave/:id` request.
Approve and Disapprove remain direct actions near the top of actionable cards;
Leave summary, Conversation, and Extend SL are under More actions. Requests
waiting on employees retain View/Conversation actions without decision buttons.
The existing desktop tables and their action handlers remain in place.

The dashboard's recent-request and overview tables also use mobile cards so
they cannot introduce another horizontal swipe below the annotated section.

Follow-up verification: 78 unit tests passed and 26 browser scenarios passed
across 320, 390, **718**, 767, 768, 1024, and 1440px. The 718px runs use the
annotated viewport height of 884px. Checks include exact-request navigation,
decision dialogs, nested button event handling, paused waiting requests,
touch targets, and controls remaining within the viewport. Synthetic API data
was used throughout. Five additional dark-theme scenarios passed at 718×884.
Screenshots are in `output/mobile-approvals` and its `dark` subdirectory.

```powershell
node scripts/mobile-ux-check.cjs --approval-pages
```

## Follow-up: clipped notification preview

The bell preview previously shared `.notification-row` and `.notification-list`
with the notification center. Opening that lazy route loaded a five-column
inbox grid which remained active after navigating away, squeezing preview text
into a 34px column. The preview now uses independent `notification-preview-*`
classes. The inbox and the desktop preview retain their existing layouts.

On mobile, complete titles and messages wrap without ellipses or line clamps;
line breaks and long references remain readable. The creation timestamp shows
both date and time. Only the list scrolls, keeping Close, Mark all as read, and
View Notification Center reachable within the dynamic viewport and safe area.

Verification: 81 unit tests and production build passed. The browser regression
visits the notification center, navigates away through the real client router,
then opens the bell with ten long messages. All 14 light/dark cases passed at
320, 390, **718×884**, 767, 768, 1024, and 1440px. Desktop preview screenshots
remain pixel-identical at 1440px in both themes. Keyboard activation and marking
the selected item as read are tested against intercepted API calls, without
writing to the real backend. Screenshots and metrics are in
`output/notification-preview`.

```powershell
node scripts/notification-preview-check.cjs
```

## Follow-up: Employee Hub employee list

The annotated `/hr/employment-status` section retained a wide desktop table;
its fixed-width status selector pushed the balance actions out of view. Below
768px, each employee now appears in a labeled card with their name and ID,
department and position, a full-width employment status selector, and visible
View/Edit Leave Balances buttons. Search and department filters stack vertically.
The same rows and handlers power both layouts, preserving filtering, optimistic
status changes, failure rollback, loading states, and balance saving.

Balance dialogs use the mobile sheet layout, wrap long employee names, and keep
their close control accessible. The leave ledger also renders labeled mobile
cards instead of requiring another horizontal swipe. Numeric balance fields
request a decimal keyboard; balance breakdowns support Enter and Space.
All added layout rules remain inside the existing `<768px` media query.

Verification: all 81 unit tests and the production build passed. The synthetic
browser regression passed 38 scenarios across light/dark themes at 320, 390,
**718×884**, 767, 768, 1024, and 1440px. It checks overflow, touch targets,
input fonts, combined filtering, successful status updates, failed-update
rollback, balance saving, both detail tabs, and Escape dismissal. At desktop
widths, the table, rows, and column headers retain their table layout; before
and after screenshots were also visually reviewed. Screenshots and metrics
are in `output/employee-hub-mobile`. All API writes were intercepted, leaving
real employee records untouched.

```powershell
node scripts/employee-hub-mobile-check.cjs
```
