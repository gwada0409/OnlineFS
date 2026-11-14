// All data is synthetic and every API call is intercepted.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = path.resolve('output/leave-summary-mobile');
const employee = { id: 9001, employeeID: 'TEST-9001', fullName: 'SAMPLE EMPLOYEE WITH A LONG NAME FOR MOBILE PREVIEW', department: 'INFORMATION TECHNOLOGY AND GENERAL ADMINISTRATIVE SERVICES', section: '', leaveDepartmentId: 47, leaveDepartmentName: 'ADMIN-ASSIGNED SECTION / TEAM', position: 'Staff', orgRole: 'Employee', employmentStatus: 'REGULAR', dateHired: '2020-01-15' };
const balances = ['SL', 'VL'].map((code, i) => ({ id: i + 1, leaveTypeId: i + 1, leaveTypeCode: code, leaveTypeDescription: code === 'SL' ? 'Sick Leave' : 'Vacation Leave', totalCredits: 10, carryOver: 0, used: 1, pending: 1, available: 8 }));
const requests = Array.from({ length: 24 }, (_, i) => ({ id: i + 1, dateFiled: '2026-10-01', leaveTypeCode: i % 2 ? 'VL' : 'SL', leaveTypeDescription: i % 2 ? 'Vacation Leave' : 'Sick Leave', dateFrom: '2026-10-14', dateTo: '2026-10-14', totalHours: 0, totalDays: 1, reason: i === 0 ? 'Medical appointment with supporting documentation. REFERENCEABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' : 'Synthetic leave record for responsive preview', status: i === 0 ? 'Approved' : 'Pending Recommending', requestKind: 'Leave', hrRemarks: 'Reviewed supporting document', leaveBalanceAtFile: { SL: 9, VL: 10 }, approvalSteps: [{ id: i + 1, stepOrder: 0, stageKind: 'RECOMMENDING', stepLabel: 'Recommending', action: i === 0 ? 'Approved' : 'Pending', approverName: 'SAMPLE SUPERVISOR WITH A LONG NAME', approverPosition: 'Supervisor', remarks: 'Supporting document reviewed. Continue with the usual approval route.' }] }));
const capabilities = ['PersonalLeave'];
const user = { id: 9001, username: 'Synthetic Preview', role: 'Employee', capabilities };

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const results = [];
  try {
    for (const theme of ['dark', 'light']) for (const width of [320, 390, 718, 767, 768, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 884 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
      const writes = [], errors = [];
      await context.addInitScript(({ user, theme }) => {
        sessionStorage.setItem('token', 'synthetic-preview');
        sessionStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('onlinefs-theme', theme);
        localStorage.setItem(`onlinefs-tutorial-v1:${user.id}:${[...user.capabilities].sort().join(',')}`, 'finished');
        window.__printCalls = 0;
        const descriptor = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
        Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', { configurable: true, get() {
          const win = descriptor.get.call(this);
          if (win && this.title === 'Leave summary print document') { win.print = () => window.__printCalls++; win.focus = () => {}; }
          return win;
        }});
      }, { user, theme });
      await context.route('**/api/**', async route => {
        const p = new URL(route.request().url()).pathname.replace('/api', '');
        if (route.request().method() !== 'GET') writes.push(p);
        const data = p === '/auth/access' ? { capabilities }
          : p === '/leave/my-profile' ? employee : p === '/leave/balance' ? balances : p === '/leave/my-requests' ? requests
          : p === '/leave/dashboard-stats' ? { pendingRequests: 23, approvedThisYear: 1, balances }
          : p === '/notifications' ? { items: [], total: 0, page: 1, pageSize: 10 }
          : p === '/notifications/unread-count' ? { count: 0 } : [];
        await route.fulfill({ json: data });
      });
      await context.route('**/hubs/**', route => route.fulfill({ status: 503, body: '' }));
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto((process.env.PREVIEW_URL || 'http://127.0.0.1:5173') + '/personal');
      const opener = page.getByRole('button', { name: 'View Leave Summary' });
      await opener.click();
      const dialog = page.getByRole('dialog', { name: 'Leave of absence and undertime application form' });
      await dialog.waitFor();
      const mobile = width < 768;
      await page.waitForFunction(mobile => getComputedStyle(document.querySelector('.loa-mobile-summary')).display === (mobile ? 'grid' : 'none'), mobile);
      assert.equal(await page.locator('.loa-mobile-summary').isVisible(), mobile);
      assert.equal(await page.locator('.loa-desktop-preview').isVisible(), !mobile);
      if (mobile) {
        await page.locator('.loa-mobile-profile summary').click();
        assert.equal(await page.locator('.loa-mobile-profile dd').filter({ hasText: employee.leaveDepartmentName }).count(), 1);
        await page.locator('.loa-mobile-record').first().locator('summary').click();
        const dimensions = await dialog.evaluate(el => ({
          overflow: el.scrollWidth > el.clientWidth + 1,
          pageOverflow: document.documentElement.scrollWidth > innerWidth,
          cards: el.querySelectorAll('.loa-mobile-record').length,
          smallControls: [...el.querySelectorAll('button, summary')].filter(control => {
            const r = control.getBoundingClientRect(); return r.width < 44 || r.height < 44;
          }).length,
        }));
        assert.equal(dimensions.overflow, false, `${width} dialog overflow`);
        assert.equal(dimensions.pageOverflow, false, `${width} page overflow`);
        assert.equal(dimensions.cards, 24);
        assert.equal(dimensions.smallControls, 0, `${width} small touch targets`);
        await dialog.evaluate(el => el.scrollTop = el.scrollHeight);
        const buttons = await dialog.locator('.loa-actions button').evaluateAll(els => els.map(el => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; }));
        assert.ok(buttons.every(r => r.top >= 0 && r.bottom <= 884 && r.left >= 0 && r.right <= width), `${width} sticky toolbar`);
        await dialog.evaluate(el => el.scrollTop = 0);
      } else {
        assert.equal(await page.locator('.loa-desktop-preview .loa-form').count(), 2);
        assert.ok(await page.locator('.loa-desktop-preview .loa-form').first().evaluate(el => el.getBoundingClientRect().width) >= 1180);
      }
      await page.screenshot({ path: path.join(output, `summary-${theme}-${width}.png`) });
      await dialog.getByRole('button', { name: 'Print', exact: true }).click();
      await page.waitForFunction(() => window.__printCalls === 1);
      const print = page.frameLocator('iframe[title="Leave summary print document"]');
      assert.equal(await print.locator('.loa-form').count(), 2);
      assert.equal(await print.locator('tbody tr').count(), 40);
      assert.equal(await print.locator('.loa-mobile-summary').count(), 0);
      assert.ok((await print.locator('.loa-line').nth(1).textContent()).includes(employee.leaveDepartmentName), 'print uses Admin assignment');
      if (width === 390 && theme === 'dark') {
        const html = await page.locator('iframe[title="Leave summary print document"]').evaluate(el => el.contentDocument.documentElement.outerHTML);
        const pdf = await context.newPage();
        await pdf.setContent(html);
        await pdf.pdf({ path: path.join(output, 'leave-summary-a4.pdf'), preferCSSPageSize: true });
        await pdf.close();
      }
      await dialog.getByRole('button', { name: 'Close', exact: true }).click();
      assert.equal(await dialog.count(), 0);
      assert.equal(await opener.evaluate(el => el === document.activeElement), true, 'restores opener focus');
      assert.deepEqual(writes, []);
      assert.deepEqual(errors, []);
      results.push({ width, theme, mobile, cards: mobile ? 24 : undefined, printRows: 40, errors });
      await context.close();
    }
    fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify(results, null, 2));
    console.log(`Passed ${results.length} mobile/desktop summary checks with light/dark themes, printing and no API writes.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
