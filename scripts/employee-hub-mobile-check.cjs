// Synthetic employee data only. API writes are intercepted and checked locally.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const baseline = process.argv.includes('--baseline');
const output = path.resolve('output/employee-hub-mobile');
const employees = [
  { id: 901, employeeID: 'PREVIEW-901', fullName: 'Alexandra Morgan — Production Control', department: 'Production Control', position: 'Senior manufacturing operations specialist', employmentStatus: 'REGULAR' },
  { id: 902, employeeID: 'PREVIEW-902', fullName: 'Taylor Rivera — Facilities and Maintenance', department: 'Facilities and Maintenance', position: 'Maintenance specialist', employmentStatus: 'NON-REGULAR' },
  { id: 903, employeeID: 'PREVIEW-903', fullName: 'Sam Lee', department: 'Production Control', position: 'Operator', employmentStatus: 'REGULAR' },
];
const balance = { id: 1, leaveTypeId: 3, leaveTypeCode: 'SL', leaveTypeDescription: 'Sick Leave', year: 2026, totalCredits: 15, carryOver: 2, used: 3, pending: 0, available: 14, hrRemarks: '' };
const capabilities = ['HROperations', 'HRManagement', 'SystemOperations', 'UserRoleManagement'];
const user = { id: 9900, username: 'Employee Preview', role: 'SystemAdmin', capabilities };

async function inspect(page, label, width) {
  const metrics = await page.evaluate(() => {
    const visible = el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
    const scope = document.querySelector('.modal-overlay:last-of-type [role="dialog"]') || document;
    const controls = [...scope.querySelectorAll('button,input:not([type=hidden]),select,textarea,a[href]')].filter(visible);
    const target = el => el.matches('input[type=checkbox]') ? el.closest('label') || el : el;
    const employeeTable = document.querySelector('.employee-hub-table') || document.querySelector('main table.data-table');
    return {
      pageOverflow: document.documentElement.scrollWidth > innerWidth,
      clippedControls: controls.filter(el => { const r = el.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1; }).map(el => el.getAttribute('aria-label') || el.textContent),
      smallTargets: controls.filter(el => { const r = target(el).getBoundingClientRect(); return r.width < 43.5 || r.height < 43.5; }).map(el => el.getAttribute('aria-label') || el.textContent),
      smallFonts: controls.filter(el => /INPUT|SELECT|TEXTAREA/.test(el.tagName) && !el.matches('[type=checkbox]') && parseFloat(getComputedStyle(el).fontSize) < 16).length,
      employeeRows: employeeTable.querySelectorAll('tbody tr').length,
      tableDisplay: getComputedStyle(employeeTable).display,
      rowDisplay: getComputedStyle(employeeTable.querySelector('tbody tr')).display,
      headerHeight: employeeTable.querySelector('thead').getBoundingClientRect().height,
    };
  });
  if (!baseline && width < 768) {
    assert.equal(metrics.pageOverflow, false, label + ': page overflow');
    assert.deepEqual(metrics.clippedControls, [], label + ': controls outside viewport');
    assert.deepEqual(metrics.smallTargets, [], label + ': small targets');
    assert.equal(metrics.smallFonts, 0, label + ': small input text');
  }
  if (!baseline && width >= 768) {
    assert.equal(metrics.tableDisplay, 'table', label + ': desktop table preserved');
    assert.equal(metrics.rowDisplay, 'table-row', label + ': desktop rows preserved');
    assert.ok(metrics.headerHeight > 1, label + ': desktop column headers visible');
  }
  return { label, width, ...metrics };
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const results = [];
  try {
    for (const theme of ['light', 'dark']) for (const width of (baseline ? [718, 768, 1024, 1440] : [320, 390, 718, 767, 768, 1024, 1440])) {
      const context = await browser.newContext({ viewport: { width, height: 884 }, reducedMotion: 'reduce', serviceWorkers: 'block', locale: 'en-US', timezoneId: 'Asia/Manila' });
      const writes = []; let statusFailed = false;
      await context.addInitScript(({ user, theme }) => {
        sessionStorage.setItem('token', 'synthetic-preview'); sessionStorage.setItem('user', JSON.stringify(user)); localStorage.setItem('onlinefs-theme', theme);
        localStorage.setItem(`onlinefs-tutorial-v1:${user.id}:${[...user.capabilities].sort().join(',')}`, 'finished');
      }, { user, theme });
      await context.route('**/api/**', async route => {
        const p = new URL(route.request().url()).pathname.replace('/api', '');
        if (route.request().method() !== 'GET') {
          writes.push({ path: p, body: route.request().postDataJSON() });
          if (p === '/hr/employment-statuses/902') { statusFailed = true; return route.fulfill({ status: 500, json: { message: 'Synthetic failed status update' } }); }
          return route.fulfill({ json: {} });
        }
        const data = p === '/auth/access' ? { capabilities } : p === '/hr/employment-statuses' ? employees
          : p === '/hr/employee-balances' ? employees.map(employee => ({ ...employee, balances: [balance] }))
          : p === '/leave/types' ? [{ id: 3, code: 'SL', description: 'Sick Leave' }]
          : p === '/notifications' ? { items: [], total: 0, page: 1, pageSize: 10 }
          : p === '/notifications/unread-count' ? { count: 0 }
          : p.startsWith('/hr/employees/') ? { employee: { ...employees.find(employee => p.includes('/' + employee.id + '/')), section: 'Operations', dateHired: '2020-01-01' }, balances: [balance], requests: [] }
          : p.startsWith('/hr/leave-ledger/') ? [{ id: 1, transactionDate: '2026-10-16', leaveTypeCode: 'SL', transactionType: 'Credit', remarks: 'Annual leave allocation', days: 15, balanceAfterTransaction: 15 }]
          : [];
        await route.fulfill({ json: data });
      });
      const page = await context.newPage();
      await page.goto('http://localhost:5173/hr/employment-status');
      await page.getByRole('button', { name: 'Edit leave balances for ' + employees[0].fullName }).waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important;caret-color:transparent!important}' });
      await page.screenshot({ path: path.join(output, `${baseline ? 'before' : 'after'}-${theme}-${width}.png`), fullPage: true });
      results.push({ theme, ...await inspect(page, 'employee-list', width) });
      if (!baseline && width < 768) {
        await page.getByLabel('Filter by department').selectOption('Facilities and Maintenance');
        await page.getByLabel('Search employees').fill('PREVIEW-902');
        assert.equal(await page.locator('.employee-hub-table tbody tr').count(), 1, 'Search and department filtering combine');
        const status = page.getByLabel('Employment status for ' + employees[1].fullName);
        await status.selectOption('REGULAR');
        await page.getByText('Synthetic failed status update').waitFor();
        assert.equal(statusFailed, true); assert.equal(await status.inputValue(), 'NON-REGULAR', 'Failed updates roll back');
        await page.getByLabel('Filter by department').selectOption(''); await page.getByLabel('Search employees').fill('');
        await page.getByLabel('Employment status for ' + employees[0].fullName).selectOption('NON-REGULAR');
        await page.getByText(employees[0].fullName + ' is now NON-REGULAR.').waitFor();
        assert.ok(writes.some(w => w.path === '/hr/employment-statuses/901' && w.body.employmentStatus === 'NON-REGULAR'));
        await page.getByRole('button', { name: 'Edit leave balances for ' + employees[0].fullName }).click();
        await page.getByRole('dialog').waitFor();
        results.push({ theme, ...await inspect(page, 'edit-balances', width) });
        if (width === 718) await page.screenshot({ path: path.join(output, `edit-balances-${theme}-718.png`) });
        await page.getByLabel('Total Credits', { exact: true }).fill('20');
        await page.getByRole('button', { name: 'Save Changes' }).click();
        await page.getByRole('dialog').waitFor({ state: 'hidden' });
        assert.ok(writes.some(w => w.path === '/hr/balance/901' && w.body.totalCredits === 20));
        await page.getByRole('button', { name: 'View leave balances for ' + employees[0].fullName }).click();
        await page.getByRole('dialog').waitFor();
        results.push({ theme, ...await inspect(page, 'view-balances', width) });
        if (width === 718) await page.screenshot({ path: path.join(output, `view-balances-${theme}-718.png`) });
        await page.getByRole('button', { name: 'Leave Ledger', exact: true }).click();
        await page.getByText('Annual leave allocation').waitFor();
        results.push({ theme, ...await inspect(page, 'view-ledger', width) });
        if (width === 718) await page.screenshot({ path: path.join(output, `view-ledger-${theme}-718.png`) });
        await page.keyboard.press('Escape');
      }
      await context.close();
    }
    fs.writeFileSync(path.join(output, `${baseline ? 'before' : 'after'}-metrics.json`), JSON.stringify(results, null, 2));
    console.log(JSON.stringify({ mode: baseline ? 'baseline' : 'verification', scenarios: results.length, output }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
