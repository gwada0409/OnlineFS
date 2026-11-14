// All application API calls are intercepted. This never changes real employee data.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = path.resolve('output/absence-coverage');
const capabilities = ['HROperations', 'HRManagement', 'SystemOperations', 'UserRoleManagement'];
const user = { id: 9900, username: 'Coverage Preview', role: 'SystemAdmin', capabilities };
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
const employees = [
  { id: 2, fullName: 'Selected Line Leader', employeeID: 'PREVIEW-2', position: 'Line Leader', department: 'Production' },
  { id: 3, fullName: 'Recommending Approver', employeeID: 'PREVIEW-3', position: 'Supervisor', department: 'Production' },
  { id: 4, fullName: 'Final Approver', employeeID: 'PREVIEW-4', position: 'Manager', department: 'Production' },
  { id: 5, fullName: 'Noted By Backup', employeeID: 'PREVIEW-5', position: 'Line Leader', department: 'Production' },
  { id: 6, fullName: 'Recommending Backup', employeeID: 'PREVIEW-6', position: 'Supervisor', department: 'Production' },
  { id: 7, fullName: 'Final Backup', employeeID: 'PREVIEW-7', position: 'Manager', department: 'Production' },
];
async function inspect(page, width, label) {
  const result = await page.evaluate(() => {
    const scope = document.querySelector('[role="dialog"]') || document.querySelector('main');
    const controls = [...scope.querySelectorAll('button,select,input:not([type=hidden]),textarea,a[href]')].filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
    return {
      overflow: document.documentElement.scrollWidth > innerWidth,
      clipped: controls.filter(el => { const r = el.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1; }).map(el => el.textContent || el.id),
      small: controls.filter(el => !el.matches('input[type=checkbox],input[type=radio]') && (el.getBoundingClientRect().width < 43.5 || el.getBoundingClientRect().height < 43.5)).map(el => el.textContent || el.id),
      smallFonts: controls.filter(el => el.matches('select,textarea,input:not([type=checkbox]):not([type=radio])') && parseFloat(getComputedStyle(el).fontSize) < 16).map(el => el.id),
    };
  });
  if (width < 768) {
    assert.equal(result.overflow, false, label + ': horizontal overflow');
    assert.deepEqual(result.clipped, [], label + ': controls clipped');
    assert.deepEqual(result.small, [], label + ': small touch targets');
    assert.deepEqual(result.smallFonts, [], label + ': small input fonts');
  }
  return { width, label, ...result };
}
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const results = [];
  try {
    for (const theme of ['light', 'dark']) for (const width of [390, 718, 767, 768, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 884 }, timezoneId: 'Asia/Manila', locale: 'en-US', reducedMotion: 'reduce', serviceWorkers: 'block' });
      const writes = []; const absences = [];
      const department = { id: 10, name: 'Preview Production', categoryId: 1, categoryName: 'Preview Category', isActive: true, firstApproverId: 3, firstApproverName: employees[1].fullName, firstApproverIds: [3], notedByApproverIds: [2], sickLeaveLineLeaderId: 2, requiresOperatorLineLeader: true, secondApproverId: 4, secondApproverName: employees[2].fullName, employeeCount: 0, employees: [], backupApprovers: { notedBy: null, recommending: null, approver: null } };
      const category = { id: 1, name: 'Preview Category', isActive: true, secondApproverId: 4, secondApproverName: employees[2].fullName, departmentCount: 1, employeeCount: 0, departments: [department] };
      await context.addInitScript(({ user, theme }) => {
        sessionStorage.setItem('token', 'synthetic-preview'); sessionStorage.setItem('user', JSON.stringify(user)); localStorage.setItem('onlinefs-theme', theme);
        localStorage.setItem(`onlinefs-tutorial-v1:${user.id}:${[...user.capabilities].sort().join(',')}`, 'finished');
      }, { user, theme });
      await context.route('**/hubs/**', route => route.fulfill({ status: 404, body: '' }));
      await context.route('**/api/**', async route => {
        const p = new URL(route.request().url()).pathname.replace('/api', '');
        const method = route.request().method();
        if (method !== 'GET') {
          const body = route.request().postDataJSON(); writes.push({ p, body });
          if (p === '/department/10') Object.assign(department, body);
          if (p === '/delegation/absences' && method === 'POST') absences.push({ id: 1, ...body, employeeName: employees[0].fullName, employeeDepartment: 'Production', employeePosition: 'Line Leader', status: 'Active', isActive: true, createdBy: user.username });
          if (p === '/delegation/absences/1/revoke') Object.assign(absences[0], { status: 'Revoked', isActive: false, revocationReason: body.reason, revokedBy: user.username });
          return route.fulfill({ json: {} });
        }
        const data = p === '/auth/access' ? { capabilities } : p === '/department/hierarchy' ? [category]
          : p === '/hr/employees' ? employees : p === '/delegation/absences' ? absences : p === '/delegation' ? []
          : p === '/notifications' ? { items: [], total: 0, page: 1, pageSize: 10 } : p === '/notifications/unread-count' ? { count: 0 } : [];
        return route.fulfill({ json: data });
      });
      const page = await context.newPage();
      await page.goto('http://localhost:5173/departments');
      await page.getByRole('button', { name: 'View Details', exact: true }).click();
      await page.getByRole('button', { name: 'Configure backups' }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('Noted by / Line leader backup').selectOption('5');
      await dialog.getByLabel('Recommending backup', { exact: true }).selectOption('6');
      await dialog.getByLabel('Approver / 2nd approver backup').selectOption('7');
      results.push({ theme, ...await inspect(page, width, 'department-backup-form') });
      if (width === 718) await page.screenshot({ path: path.join(output, `department-backups-${theme}.png`) });
      await dialog.getByRole('button', { name: 'Save Department' }).click();
      await dialog.waitFor({ state: 'hidden' });
      assert.ok(writes.some(write => write.p === '/department/10' && write.body.backupApprovers.notedBy === 5 && write.body.backupApprovers.recommending === 6 && write.body.backupApprovers.approver === 7));

      await page.goto('http://localhost:5173/approval-routing');
      await page.getByRole('button', { name: 'Record Approver Leave' }).click();
      await dialog.getByLabel('Find employee').fill('PREVIEW-2');
      await dialog.getByLabel('Approver on leave *', { exact: true }).selectOption('2');
      await dialog.getByText('Noted By Backup', { exact: true }).waitFor();
      await dialog.getByLabel('Reason *', { exact: true }).fill('Synthetic annual leave coverage');
      results.push({ theme, ...await inspect(page, width, 'record-leave-form') });
      if (width === 718) await page.screenshot({ path: path.join(output, `record-leave-${theme}.png`) });
      await dialog.getByRole('button', { name: 'Record Leave', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
      assert.ok(writes.some(write => write.p === '/delegation/absences' && write.body.employeeId === 2 && write.body.startDate === today && !('delegateId' in write.body)));
      results.push({ theme, ...await inspect(page, width, 'active-leave-list') });
      await page.getByRole('button', { name: 'End leave coverage for Selected Line Leader' }).click();
      await dialog.getByLabel('Reason for ending coverage *').fill('Returned early');
      results.push({ theme, ...await inspect(page, width, 'end-coverage-form') });
      await dialog.getByRole('button', { name: 'End Coverage', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
      await page.getByRole('button', { name: 'History', exact: true }).click();
      await page.getByText('Ended by Coverage Preview: Returned early', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Manual Delegations', exact: true }).click();
      await page.getByRole('button', { name: 'New Delegation' }).waitFor();
      assert.ok(writes.some(write => write.p === '/delegation/absences/1/revoke' && write.body.reason === 'Returned early'));
      await context.close();
    }
    fs.writeFileSync(path.join(output, 'browser-metrics.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify({ passed: results.length, output }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
