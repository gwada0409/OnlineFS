export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  target: string;
}

const nav = (label: string) => `#primary-navigation button[aria-label="${label}"]`;

export function getTutorialSteps(capabilities: readonly string[]): TutorialStep[] {
  const has = (capability: string) => capabilities.includes(capability);
  const steps: TutorialStep[] = [{
    id: 'welcome', title: 'Welcome to OnlineFS', target: '.main-header',
    description: 'OnlineFS organizes your work into workspaces based on your account access. This tour highlights the navigation available to you. Use Next and Back to explore, or Skip tutorial at any time.'
  }];
  if (has('PersonalLeave')) steps.push(
    { id: 'personal', title: 'My Dashboard', target: nav('My Dashboard'), description: 'View your leave calendar, current balances, and recent requests. Select a request to see its details and supporting attachments.' },
    { id: 'file-leave', title: 'File Leave', target: nav('File Leave'), description: 'Choose a leave type and dates, provide a reason, and add supporting files when needed. Review the details before submitting your request for approval.' },
    { id: 'requests', title: 'My Requests', target: nav('My Requests'), description: 'Track the status of your filed requests. Open a request to review its approval progress, attachments, and conversation. Available actions depend on the request status.' }
  );
  if (has('Approvals')) steps.push({ id: 'approvals', title: 'Pending Approvals', target: nav('Pending Approvals'), description: 'Review requests currently assigned to you, including delegated approvals. Read the employee leave summary and conversation before making a decision. Requests waiting for an employee reply may have approval actions paused.' });
  if (has('HROperations')) steps.push(
    { id: 'hr', title: 'HR Dashboard', target: nav('HR Dashboard'), description: 'Review leave requests and reports, monitor low balances, and finalize approved requests. Manage employee balances in Employee Hub.' },
    { id: 'employment', title: 'Employee Hub', target: nav('Employee Hub'), description: 'Search employees, open printable leave summaries, and manage leave balances and employment status.' },
    { id: 'departments', title: 'Departments and routing', target: nav('Departments'), description: 'Find approval categories and leave routing departments, and review their configured approvers. These settings determine how the organization routes leave requests.' },
    { id: 'delegation', title: 'Delegation Management', target: nav('Delegation Management'), description: 'Review approval delegation arrangements used when another approver covers a request. The screen limits management actions according to your permissions.' }
  );
  if (has('HROperations') && has('HRManagement')) steps.push({ id: 'policies', title: 'Leave Policies & Calendar', target: nav('Leave Policies & Calendar'), description: 'Manage leave policy rules, holidays, and work calendars that determine how requests are calculated and validated.' });
  if (has('SystemOperations')) steps.push({ id: 'system', title: 'System Operations', target: nav('System Operations'), description: 'Review application alerts and aggregate leave activity. Backup & Restore on this page saves the database and managed files, including photos, signatures, attachments, and templates. A restore requires validation and confirmation.' });
  // These links are nested under System Operations in the current navigation.
  if (has('SystemOperations') && has('UserRoleManagement')) steps.push(
    { id: 'health', title: 'Health & Repair', target: nav('Health & Repair'), description: 'Review system diagnostics and run the repair operations offered on the screen. Read each operation’s description before applying it.' },
    { id: 'roles', title: 'Role Management', target: nav('Role Management'), description: 'Manage user roles and account access. A role determines which workspaces and actions a user can access.' }
  );
  steps.push(
    { id: 'notifications', title: 'Your notifications', target: '.main-header button[aria-label^="Notifications:"]', description: 'Open the notification bell to see alerts addressed to you. Workspace notification links in the sidebar open the corresponding inbox when available.' },
    { id: 'theme', title: 'Choose a color theme', target: '#theme-preference', description: 'Choose light mode, dark mode, or follow your device’s theme. This preference changes the appearance of OnlineFS.' },
    { id: 'restart', title: 'You’re ready to get started', target: '[data-tutorial="launcher"]', description: 'Finish this tour, then open a workspace from the navigation. You can restart the complete walkthrough any time using Get Started in the header.' }
  );
  return steps;
}

export const tutorialStorageKey = (userId: number, capabilities: readonly string[]) =>
  `onlinefs-tutorial-v1:${userId}:${[...capabilities].sort().join(',')}`;

/** Section tours refer only to controls already rendered; the host filters conditional steps. */
export function getSectionTutorialSteps(capabilities: readonly string[], pathname: string): TutorialStep[] {
  const steps: TutorialStep[] = [];
  const add = (id: string, title: string, target: string, description: string) => steps.push({ id, title, target, description });
  if (pathname === '/file-leave' && capabilities.includes('PersonalLeave')) {
    add('filing', 'File Leave', '.page-container .page-header', 'Complete the application in three stages: leave details, supporting documents, and review. Sick Leave goes to HR first for a fit-to-work review before the organizational signatories. This tour explains the stage currently displayed without changing your form.');
    add('filing-stages', 'Application stages', '[data-tutorial="filing-stages"]', 'The stage indicator shows your progress. Complete the required details before continuing to Attachments, then review the request before submitting. You can return to completed stages to edit them.');
    add('leave-type', 'Choose the leave type', '#leave-type', 'Select the appropriate leave type. The form displays applicable balance, date, time, and supporting-document requirements. Some types require a separate balance deduction choice.');
    add('leave-dates', 'Requested dates', '#date-from', 'Set Date From and Date To. The form calculates the request duration using the applicable calendar and policy. For hourly leave, also complete the time fields shown.');
    add('leave-reason', 'Explain your request', '#leave-reason', 'Enter the reason for your absence or undertime. This field is required and accepts up to 500 characters.');
    add('leave-attachments', 'Supporting documents', '[data-tutorial="filing-attachments"]', 'Click the upload area or drag supporting files onto it. Follow the file limits and attachment policy shown for your selected leave type. Review queued files before continuing.');
    add('leave-review', 'Review before submitting', '[data-tutorial="filing-review"]', 'Check the leave type, dates, duration, reason, and supporting documents. Use Edit Attachments or Back to correct details before submitting.');
    add('leave-actions', 'Continue or submit', '[data-tutorial="filing-actions"]', 'Next validates the current stage before continuing. Submit Leave Request on the final stage sends your application to the assigned approvers. This tour does not submit anything.');
  } else if (pathname === '/my-requests' && capabilities.includes('PersonalLeave')) {
    add('requests-intro', 'My Requests', '.page-container .page-header', 'Track your leave applications and their current approval status here.');
    add('requests-filter', 'Filter by status', '[data-tutorial="requests-filter"]', 'Select All Statuses or a specific approval status to narrow the list. An empty list means no requests match that filter.');
    add('requests-list', 'Request history and actions', '[data-tutorial="requests-list"]', 'Each row shows the leave type, dates, duration, and status. Open the request using its view action for approval progress and conversation. Delete, reschedule, or cancellation actions appear only when the request is eligible.');
  } else if (pathname === '/notifications') {
    add('inbox-intro', 'Notifications', '.notification-page-header', 'This inbox shows updates addressed to you in the selected workspace. Only workspaces allowed for your account are available.');
    add('inbox-workspaces', 'Notification workspace', '.notification-workspaces:has(button, select)', 'Switch between your available workspace inboxes. System users can also filter alert categories offered by their permissions.');
    add('inbox-filters', 'Find relevant updates', '.notification-filters', 'Use All, Unread, or Action required to narrow the inbox. Additional filters depend on the current workspace.');
    add('inbox-read', 'Mark all as read', '[data-tutorial="notifications-read"]', 'Mark the notifications in the current workspace and category as read. The button is disabled while loading or when there are no unread items.');
    add('inbox-list', 'Read and open updates', '.notification-groups', 'Notifications are grouped by date. Open actionable updates to visit the related request or screen. An empty inbox or loading message is shown when appropriate.');
    add('inbox-preferences', 'Notification preferences', '.notification-preferences', 'Open Preferences to manage the notification options offered to your account.');
  } else if ((pathname === '/' || pathname === '/personal') && capabilities.includes('PersonalLeave')) {
    add('dashboard-intro', 'My Dashboard', '.page-container .page-header', 'Your dashboard summarizes leave activity. Use the sidebar at any point to switch to another section and its tutorial.');
    add('dashboard-stats', 'Leave overview', '.stat-grid', 'See pending requests, approved leave days, and total available days. Select a summary card after the tour to review its details.');
    add('dashboard-balances', 'Leave balances', '.balance-grid', 'Review available balances and used or pending days for each leave type. Availability depends on your employee record and configured policies.');
    add('dashboard-recent', 'Recent requests', '[data-tutorial="dashboard-recent"]', 'Review recent applications and their status. View All opens My Requests, where you can filter your complete request history.');
  } else return getTutorialSteps(capabilities);
  add('section-navigation', 'Explore another section', '#primary-navigation .sidebar-nav', 'Choose any available section in the sidebar to switch pages and start its tutorial. Finish or Skip closes the tour. Get Started always restarts the walkthrough for the current section.');
  return steps;
}
