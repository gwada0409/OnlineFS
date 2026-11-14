// Reproduce the lazy notification-center CSS remaining loaded after navigation.
// Every API request is intercepted; these checks never write to the real backend.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const baseline = process.argv.includes('--baseline');
const output = path.resolve('output/notification-preview');
const title = 'Application operation failed while updating the department approval configuration';
const message = 'An application operation failed. Review the affected department and its approval assignments before trying again. This notification includes a complete explanation with a long reference: PREVIEW-ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.\nThe final sentence must remain fully readable on mobile.';
const items = Array.from({ length: 10 }, (_, index) => ({
  id: index + 1, title: index === 0 ? title : `Department update ${index + 1}: review the complete approval information`,
  message, type: 'OperationFailed', severity: 'Warning', entityType: 'System', entityId: index + 1,
  actionUrl: `/file-leave?notification=${index + 1}`, workspace: 'HR', isRead: false, createdAt: '2026-10-05T04:00:00Z',
}));
const capabilities = ['PersonalLeave', 'Approvals', 'HROperations', 'HRManagement'];
const user = { id: 9001, username: 'Notification Preview', role: 'HRManager', capabilities };

async function openBell(page) {
  await page.getByRole('button', { name: /Notifications:.*unread/ }).click();
  await page.getByText(title, { exact: true }).waitFor({ state: baseline ? 'attached' : 'visible' });
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const results = [];
  try {
    for (const theme of ['light', 'dark']) for (const width of (baseline ? [718, 1440] : [320, 390, 718, 767, 768, 1024, 1440])) {
      const context = await browser.newContext({ viewport: { width, height: 884 }, reducedMotion: 'reduce', serviceWorkers: 'block', locale: 'en-US', timezoneId: 'Asia/Manila' });
      const reads = [];
      await context.addInitScript(({ user, theme }) => {
        sessionStorage.setItem('token', 'synthetic-preview'); sessionStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('onlinefs-theme', theme);
        localStorage.setItem(`onlinefs-tutorial-v1:${user.id}:${[...user.capabilities].sort().join(',')}`, 'finished');
      }, { user, theme });
      await context.route('**/api/**', async route => {
        const p = new URL(route.request().url()).pathname.replace('/api', '');
        if (route.request().method() !== 'GET') reads.push(p);
        const data = p === '/auth/access' ? { capabilities } : p === '/notifications' ? { items, total: items.length, page: 1, pageSize: 10 }
          : p === '/notifications/unread-count' ? { count: items.length }
          : p === '/calendar-policy/calendar' ? { workCalendar: { workingDays: '1,2,3,4,5' } } : [];
        await route.fulfill({ json: data });
      });
      const page = await context.newPage();
      await page.goto('http://localhost:5173/file-leave');
      await page.locator('.page-body').waitFor();
      await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}' });
      await openBell(page);
      if (width >= 768) await page.screenshot({ path: path.join(output, `${baseline ? 'before' : 'after'}-desktop-clean-${theme}-${width}.png`) });
      // Use the real client router, so the inbox stylesheet stays in this document.
      await page.getByRole('button', { name: /View Notification Center/ }).click();
      await page.locator('.notification-inbox .notification-row').first().waitFor();
      if (width < 768) {
        await page.getByRole('button', { name: 'More navigation' }).click();
        await page.getByRole('dialog', { name: 'Navigation and settings' }).getByRole('button', { name: 'File Leave', exact: true }).click();
      } else {
        const toggle = page.getByRole('button', { name: 'Open navigation menu' });
        if (await toggle.isVisible()) await toggle.click();
        await page.locator('.sidebar-nav button[title="File Leave"]').click();
      }
      await page.waitForURL('**/file-leave');
      await openBell(page);
      const metrics = await page.evaluate(() => {
        const rows = [...document.querySelectorAll('.notification-preview-row, .notification-row')];
        const first = rows[0], main = first.children[1];
        const text = [...first.querySelectorAll('p, .notification-preview-title')];
        const panel = first.closest('.notification-sheet') || first.parentElement.parentElement;
        const list = first.parentElement;
        const footer = panel.querySelector('.notification-preview-footer button') || [...panel.querySelectorAll('button')].find(el => el.textContent.includes('View Notification Center'));
        const rect = panel.getBoundingClientRect(), fr = footer.getBoundingClientRect();
        return {
          rowCount: rows.length, mainWidth: main.clientWidth, rowWidth: first.clientWidth,
          clippedText: text.some(el => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1),
          titleWhiteSpace: getComputedStyle(first.querySelector('.notification-preview-title') || first.querySelector('span')).whiteSpace,
          listScrollable: list.scrollHeight > list.clientHeight && getComputedStyle(list).overflowY === 'auto',
          footerVisible: fr.top >= 0 && fr.bottom <= innerHeight + 1,
          panelFits: rect.left >= -1 && rect.right <= innerWidth + 1 && rect.top >= 0 && rect.bottom <= innerHeight + 1,
          pageOverflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      await page.screenshot({ path: path.join(output, `${baseline ? 'before' : 'after'}-loaded-${theme}-${width}.png`) });
      if (!baseline) {
        assert.equal(metrics.rowCount, 10);
        assert.ok(metrics.mainWidth > metrics.rowWidth * 0.7, 'Inbox CSS must not squeeze preview text');
        if (width < 768) {
          assert.equal(metrics.clippedText, false, 'Full notification text must fit its boxes');
          assert.equal(metrics.titleWhiteSpace, 'normal');
          assert.equal(metrics.listScrollable, true, 'Long messages must scroll within the sheet');
          assert.equal(metrics.footerVisible, true, 'Notification center action must remain reachable');
          assert.equal(metrics.panelFits, true);
          assert.equal(metrics.pageOverflow, false);
        }
        const firstRow = page.locator('.notification-preview-row').first();
        await firstRow.focus(); await page.keyboard.press('Enter');
        await page.waitForURL('**/file-leave?notification=1');
        assert.ok(reads.includes('/notifications/1/read'), 'Keyboard activation must mark the selected item as read');
      }
      results.push({ theme, width, ...metrics });
      await context.close();
    }
    fs.writeFileSync(path.join(output, `${baseline ? 'before' : 'after'}-metrics.json`), JSON.stringify(results, null, 2));
    console.log(JSON.stringify({ mode: baseline ? 'baseline' : 'verification', cases: results.length, output }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
