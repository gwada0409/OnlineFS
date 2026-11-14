// Browser regression checks use synthetic API data and never write to AutoID.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = path.resolve(process.env.MOBILE_QA_OUTPUT || 'output/mobile-ux');
const baseline = process.argv.includes('--baseline');
const approvalPages = process.argv.includes('--approval-pages');
const baseUrl = process.env.MOBILE_QA_URL || 'http://localhost:5173';
const theme = process.env.MOBILE_QA_THEME === 'dark' ? 'dark' : 'light';
const capabilities = ['PersonalLeave', 'Approvals', 'HROperations', 'HRManagement'];
const user = { id: 9001, username: 'Mobile Preview', role: 'HRManager', capabilities };
const leaveType = { id: 1, code: 'VL', description: 'Vacation Leave', deductsFromBalance: true, isHoursBased: false, requiresAttachment: false, allowBackdatedFiling: true, minimumDaysPerRequest: 0, eligibleEmploymentStatuses: 'Regular' };
const request = {
  id: 9001, leaveRequestId: 9001, employeeName: 'Alexandra Morgan — Manufacturing Operations', employeeID: 'PREVIEW-9001', department: 'Manufacturing Operations',
  employee: { id: 9001, fullName: 'Alexandra Morgan — Manufacturing Operations', employeeID: 'PREVIEW-9001', position: 'Production specialist', department: 'Manufacturing Operations' },
  leaveType, leaveTypeCode: 'VL', leaveTypeDescription: 'Vacation Leave', dateFiled: '2026-10-14T09:00:00', dateFrom: '2026-11-02T00:00:00', dateTo: '2026-11-03T00:00:00',
  totalDays: 2, totalHours: 0, status: 'Approved', requestKind: 'Leave', reason: 'A planned family commitment with supporting information and a deliberately long reference: PREVIEW-ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.',
  days: [{ date: '2026-11-02', hours: 8, isPaid: true }, { date: '2026-11-03', hours: 4, halfDayTime: 'AM', isPaid: false }],
  attachments: [{ id: 1, fileName: 'supporting-document-with-a-very-long-filename-for-mobile-testing.pdf', fileSize: 123456 }],
  approvalSteps: [{ id: 1, stepOrder: 1, stepLabel: 'Noted by', approverName: 'Department line leader', action: 'Approved', actionDate: '2026-10-15T10:00:00' }],
  auditTrails: [], conversationAccess: { isEmployeeOwner: true, canComment: false },
};
const balance = { id: 1, leaveTypeId: 1, leaveTypeCode: 'VL', leaveTypeDescription: 'Vacation Leave', year: 2026, totalCredits: 15, carryOver: 0, used: 2, pending: 0, available: 13 };
const summary = { totalPending: 3, employeesOnLeave: 2, employeesLowBalance: 1, approvedThisMonth: 7, rejectedThisMonth: 1, departmentSummary: [{ department: 'Manufacturing Operations', approvedLeaves: 12 }, { department: 'Finance and Administration', approvedLeaves: 4 }] };

const pendingApproval = { ...request, approvalStepId: 77, stepLabel: 'Manager', stepOrder: 1, stageKind: 'APPROVER', status: 'Pending Approver' };

async function prepare(browser, width) {
  const context = await browser.newContext({ viewport: { width, height: approvalPages ? 884 : 900 }, reducedMotion: 'reduce', serviceWorkers: 'block', locale: 'en-US', timezoneId: 'Asia/Manila' });
  await context.addInitScript(({ user, capabilities, theme }) => {
    sessionStorage.setItem('user', JSON.stringify(user)); sessionStorage.setItem('token', 'synthetic-preview');
    localStorage.setItem('onlinefs-theme', theme);
    localStorage.setItem(`onlinefs-tutorial-v1:${user.id}:${[...capabilities].sort().join(',')}`, 'finished');
  }, { user, capabilities, theme });
  await context.route('**/api/**', async route => {
    const url = new URL(route.request().url()); const p = url.pathname.replace('/api', '');
    let data = [];
    if (p === '/auth/access') data = { capabilities };
    else if (p === '/notifications/unread-count') data = { count: 1 };
    else if (p === '/notifications') data = { items: [{ id: 1, title: 'Your request was approved', message: 'Open your workspace for details.', severity: 'Success', type: 'LeaveApproved', createdAt: '2026-10-16T09:00:00', isRead: false, actionUrl: '/leave/9001' }], total: 1, page: 1, pageSize: 10 };
    else if (p === '/leave/types') data = [leaveType, { ...leaveType, id: 2, code: 'UT', description: 'Undertime', isHoursBased: true, deductsFromBalance: false }];
    else if (p.startsWith('/leave/balance')) data = [balance];
    else if (p === '/leave/line-leader-options') data = { requiresSelection: false, lineLeaders: [] };
    else if (p === '/calendar-policy/calendar') data = { workCalendar: { workingDays: '1,2,3,4,5' }, holidays: [] };
    else if (p === '/leave/9001') data = request;
    else if (p === '/approval/pending') data = [pendingApproval];
    else if (p === '/approval/waiting-on-employees') data = [{ ...pendingApproval, leaveRequestId: 9002, approvalStepId: 78, employeeName: 'Taylor — Facilities and Maintenance', waitingForEmployee: true }];
    else if (p === '/leave/dashboard-stats') data = { pendingRequests: 0, approvedThisYear: 2 };
    else if (p === '/leave/my-requests') data = [request];
    else if (p === '/leave/my-profile') data = { ...request.employee, id: 9001, section: 'Operations', employmentStatus: 'Regular', dateHired: '2020-01-01' };
    else if (p === '/hr/reports/summary') data = summary;
    else if (p === '/hr/finalization-pending' || p === '/approval/all-pending') data = [{ ...request, status: 'Pending Approver' }];
    else if (p === '/hr/reports/designer/options') data = { employees: [], departments: [], leaveTypes: ['VL'], statuses: ['Approved'] };
    else if (p === '/hr/reports/designer') data = { totalRecords: 1, totalLeaveDays: 2, totalTimeHours: 0, pendingRecords: 0, isTruncated: false, results: [{ ...request, employee: request.employeeName, leaveType: 'VL', approvalStatus: 'Approved' }] };
    else if (p === '/hr/employee-balances') data = [{ ...request.employee, balances: [{ ...balance, available: 1 }] }];
    return route.fulfill({ json: data });
  });
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date('2026-10-16T03:00:00Z'));
  return { context, page };
}

async function settle(page) {
  await page.locator('.page-body').waitFor();
  await page.locator('.loading-spinner').waitFor({ state: 'hidden' });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}' });
}
async function inspect(page, label, width) {
  const metrics = await page.evaluate(() => {
    const visible = el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
    const controls = [...document.querySelectorAll('button,input:not([type=hidden]),select,textarea,a[href],[role=button]')].filter(visible);
    return {
      overflow: document.documentElement.scrollWidth > innerWidth,
      tooSmall: controls.filter(el => { const r = el.getBoundingClientRect(); return r.width < 43.5 || r.height < 43.5; }).map(el => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height, tag: el.tagName, text: (el.getAttribute('aria-label') || el.textContent || el.getAttribute('type') || '').slice(0, 70), class: el.className })),
      smallInputs: controls.filter(el => /INPUT|SELECT|TEXTAREA/.test(el.tagName) && Number.parseFloat(getComputedStyle(el).fontSize) < 16).length,
      headerHeight: document.querySelector('.main-header').getBoundingClientRect().height,
      offscreen: controls.filter(el => { const r = el.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1; }).map(el => el.textContent?.slice(0, 50)),
    };
  });
  if (!baseline && width < 768 && (metrics.tooSmall.length || metrics.overflow || metrics.offscreen.length)) await page.screenshot({ path: path.join(output, 'failure-' + label + '-' + width + '.png'), fullPage: true });
  if (!baseline && width < 768) {
    assert.equal(metrics.overflow, false, `${label}: document overflows`);
    assert.deepEqual(metrics.tooSmall, [], `${label}: undersized touch targets`);
    assert.equal(metrics.smallInputs, 0, `${label}: input text below 16px`);
    assert.ok(metrics.headerHeight <= 64, `${label}: header exceeds 64px`);
    assert.deepEqual(metrics.offscreen, [], `${label}: controls outside viewport`);
  }
  return { label, width, ...metrics };
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const results = [];
  try {
    const widths = process.env.MOBILE_QA_WIDTHS ? process.env.MOBILE_QA_WIDTHS.split(',').map(Number) : process.argv.includes('--desktop-only') ? [768, 1024, 1440] : approvalPages ? [320, 390, 718, 767, 768, 1024, 1440] : baseline ? [390, 768, 1024, 1440] : [320, 390, 767, 768, 1024, 1440];
    for (const width of widths) {
      const { context, page } = await prepare(browser, width);
      for (const [name, url] of (approvalPages ? [['approvals', '/approvals'], ['personal', '/personal']] : [['filing', '/file-leave'], ['detail', '/leave/9001'], ['hr', '/hr']])) {
        await page.goto(baseUrl + url); await settle(page);
        if (name === 'filing') {
          await page.locator('#leave-type').selectOption('1');
          await page.locator('#date-from').fill('2026-11-02'); await page.locator('#date-to').fill('2026-11-03');
          await page.locator('#leave-reason').fill('A planned family commitment.');
        }
        results.push(await inspect(page, name, width));
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
        await page.screenshot({ path: path.join(output, `${baseline ? 'before' : 'after'}-${name}-${width}.png`), fullPage: true });
        if (!baseline && width < 768 && approvalPages) {
          const firstCard = page.locator('.approval-mobile-list .approval-request-card').first();
          await firstCard.waitFor();
          if (name === 'approvals') {
            await firstCard.getByRole('button', { name: 'Approve', exact: true }).click();
            await page.getByRole('dialog', { name: 'Approve leave request' }).waitFor();
            results.push(await inspect(page, 'approval-decision-sheet', width));
            await page.keyboard.press('Escape');
            await firstCard.getByRole('button', { name: 'Disapprove', exact: true }).click();
            await page.getByRole('dialog', { name: 'Disapprove leave request' }).waitFor();
            assert.match(page.url(), /\/approvals$/, 'Decision buttons must not trigger card navigation');
            await page.keyboard.press('Escape');
            const waitingCard = page.locator('.approval-request-card[data-waiting="true"]');
            assert.equal(await waitingCard.getByRole('button', { name: /^(Approve|Disapprove)$/ }).count(), 0, 'Waiting requests keep decisions paused');
            await firstCard.getByRole('button', { name: 'Review request', exact: true }).click();
          } else {
            // Blank card space must work as well as the labeled Review button.
            await firstCard.locator('dd').first().click();
          }
          await page.waitForURL('**/leave/9001');
          assert.match(page.url(), /\/leave\/9001$/, 'Cards must open the exact request');
          results.push({ label: name + '-card-tap', width, exactRequestOpened: true });
        }
        if (!baseline && width < 768 && !approvalPages) {
          await page.getByRole('button', { name: 'More navigation' }).click();
          await page.getByRole('dialog', { name: 'Navigation and settings' }).waitFor();
          results.push(await inspect(page, 'navigation-sheet', width));
          await page.screenshot({ path: path.join(output, `navigation-sheet-${width}.png`) });
          await page.keyboard.press('Shift+Tab');
          assert.ok(await page.getByRole('dialog', { name: 'Navigation and settings' }).evaluate(el => el.contains(document.activeElement)), 'Drawer traps keyboard focus');
          await page.keyboard.press('Escape');
          assert.ok(await page.getByRole('button', { name: 'More navigation' }).evaluate(el => el === document.activeElement), 'Drawer restores focus');
          await page.getByRole('button', { name: /Notifications:.*unread/ }).click();
          await page.getByRole('dialog', { name: 'Notifications' }).waitFor();
          results.push(await inspect(page, 'notification-sheet', width));
          await page.screenshot({ path: path.join(output, `notification-sheet-${width}.png`) });
          await page.keyboard.press('Escape');
          if (name === 'filing') {
            await page.getByLabel('Leave hours for 2026-11-02').selectOption('4');
            await page.getByLabel('Half-day period for 2026-11-02').selectOption('PM');
            assert.equal(await page.getByLabel('Half-day period for 2026-11-02').inputValue(), 'PM', 'Daily controls retain state');
            await page.getByRole('button', { name: 'Next: Attachments' }).click();
            await page.locator('input[type=file]').setInputFiles({ name: 'a-very-long-supporting-document-name-for-testing.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-preview') });
            results.push(await inspect(page, 'filing-attachments', width));
            await page.getByRole('button', { name: 'Next: Review' }).click();
            results.push(await inspect(page, 'filing-review', width));
          }
          if (name === 'detail') {
            await page.getByRole('button', { name: 'Reschedule', exact: true }).click();
            await page.getByRole('dialog', { name: 'Reschedule leave' }).waitFor();
            results.push(await inspect(page, 'reschedule-sheet', width));
            await page.screenshot({ path: path.join(output, `reschedule-sheet-${width}.png`) });
            await page.keyboard.press('Escape');
          }
          if (name === 'hr') {
            await page.locator('#hr-mobile-section').selectOption('company-pending');
            await page.getByRole('button', { name: 'Notify Approver', exact: true }).waitFor();
            results.push(await inspect(page, 'hr-pending', width));
            await page.getByRole('button', { name: 'View', exact: true }).click();
            await page.getByRole('dialog', { name: 'Leave request details' }).waitFor();
            results.push(await inspect(page, 'request-sheet', width));
            await page.keyboard.press('Escape');
            await page.locator('#hr-mobile-section').selectOption('reports');
            await page.getByRole('button', { name: 'Generate results' }).click();
            await page.getByText('Records', { exact: true }).waitFor();
            results.push(await inspect(page, 'hr-reports', width));
            await page.locator('#hr-mobile-section').selectOption('ledger');
            await page.getByRole('button', { name: 'Finalize', exact: true }).click();
            await page.getByRole('dialog', { name: 'Finalize leave request' }).waitFor();
            results.push(await inspect(page, 'finalize-sheet', width));
            await page.keyboard.press('Escape');
          }
        }
      }
      await context.close();
    }
    fs.writeFileSync(path.join(output, `${baseline ? 'before' : 'after'}-metrics.json`), JSON.stringify(results, null, 2));
    console.log(JSON.stringify({ mode: baseline ? 'baseline' : 'verification', scenarios: results.length, output }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
