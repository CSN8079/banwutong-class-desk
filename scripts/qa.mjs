import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';

const baseUrl = process.env.APP_URL ?? 'http://127.0.0.1:4173/';
const chromePath = process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outputDir = path.resolve('docs/screenshots');
const iconPath = path.resolve('public/icons/icon-192.png');
await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ executablePath: chromePath, headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
const page = await context.newPage();
page.on('dialog', (dialog) => dialog.accept());
const consoleErrors = [];
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', (error) => consoleErrors.push(error.message));

async function shot(name) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(420);
  await page.screenshot({ path: path.join(outputDir, name), fullPage: false });
}

async function assertNoHorizontalOverflow(label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 1) throw new Error(`${label} overflows horizontally by ${overflow}px`);
}

await page.goto(baseUrl, { waitUntil: 'networkidle' });
await page.getByRole('heading', { name: /把班级事务/ }).waitFor();
await shot('dashboard-desktop.png');

await page.goto(`${baseUrl}#attendance`, { waitUntil: 'networkidle' });
await page.getByRole('heading', { name: '课堂点名', exact: true }).waitFor();
await page.getByRole('button', { name: /随机点名/ }).click();
await page.locator('.modal').getByText(/当前范围有 \d+ 名学生/).waitFor();
await page.locator('.random-scope-options').getByRole('button', { name: /全部学生/ }).click();
await page.locator('.modal').getByRole('button', { name: '开始抽取' }).click();
await page.locator('.modal .random-picker h3').waitFor();
if (await page.locator('.random-status-actions button').count() !== 4) throw new Error('Random picker status options missing');
await page.locator('.random-status-actions').getByRole('button', { name: '迟到' }).click();
if (!(await page.locator('.modal').isVisible())) throw new Error('Random picker closed after marking a status');
await page.locator('.modal-footer').getByRole('button', { name: '关闭', exact: true }).click();

const firstCard = page.locator('.attendance-card').first();
await firstCard.locator('.choice-leave').click();
await firstCard.locator('.note-button').click();
await page.locator('.modal').getByRole('button', { name: '请假', exact: true }).click();
await page.locator('.modal input[type=file]').setInputFiles(iconPath);
await page.locator('.modal .attendance-image-thumb').waitFor();
await page.locator('.modal').getByRole('button', { name: '保存备注' }).click();
await page.getByText('备注已保存').waitFor();
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('heading', { name: '课堂点名', exact: true }).waitFor();
await shot('attendance-desktop.png');
const attendanceHtmlPromise = page.waitForEvent('download');
await page.getByRole('button', { name: /^HTML$/ }).click();
const attendanceHtml = await attendanceHtmlPromise;
if (!attendanceHtml.suggestedFilename().endsWith('.html')) throw new Error('Attendance HTML filename invalid');

await page.getByRole('button', { name: '完成点名', exact: true }).click();
await page.locator('.session-history-button').click();
await page.locator('.modal .history-accordion').first().waitFor();
await page.locator('.modal .history-accordion summary').first().click();
await page.locator('.modal').getByRole('button', { name: '重新启动', exact: true }).click();
await page.waitForTimeout(250);
await page.locator('.session-command-actions').getByRole('button', { name: /新建点名/ }).click();
await page.locator('.modal input').fill('第二节课点名');
await page.getByRole('button', { name: '创建并开始点名' }).click();
await page.locator('.session-command-title-line h2').getByText('第二节课点名').waitFor();

await page.goto(`${baseUrl}#tasks`, { waitUntil: 'networkidle' });
await page.getByRole('heading', { name: '任务收集', exact: true }).waitFor();
const firstSubmission = page.locator('.submission-row').first();
const fileChooserPromise = page.waitForEvent('filechooser');
await firstSubmission.locator('.upload-attachment').click();
await (await fileChooserPromise).setFiles(iconPath);
await firstSubmission.locator('.attachment-thumb').waitFor();
await firstSubmission.locator('.attachment-thumb').click();
await page.locator('.modal .image-preview img').waitFor();
if (await page.getByRole('button', { name: /删除图片/ }).count() !== 1) throw new Error('Image preview delete action missing');
await page.locator('.modal-footer').getByRole('button', { name: '关闭', exact: true }).click();

await page.locator('.submission-row').nth(1).locator('.selection-check').click();
await page.locator('.submission-row').nth(2).locator('.selection-check').click();
if ((await page.locator('.bulk-selected-count').innerText()).includes('2') === false) throw new Error('Bulk selection count incorrect');
await page.getByRole('button', { name: /标为已完成/ }).click();

const xlsxDownloadPromise = page.waitForEvent('download');
await page.getByRole('button', { name: /XLSX/ }).click();
const xlsxDownload = await xlsxDownloadPromise;
if (!xlsxDownload.suggestedFilename().endsWith('.xlsx')) throw new Error('XLSX filename invalid');
const htmlDownloadPromise = page.waitForEvent('download');
await page.getByRole('button', { name: /图文报告/ }).click();
const htmlDownload = await htmlDownloadPromise;
const htmlPath = await htmlDownload.path();
const html = htmlPath ? await fs.readFile(htmlPath, 'utf8') : '';
if (!html.includes('lightbox') || !html.includes('zoomable') || !html.includes('evidence-grid') || !html.includes('table-scroll')) throw new Error('HTML report zoom/evidence/responsive markup missing');
const reportPath = path.join(os.tmpdir(), 'banwutong-qa-report.html');
await htmlDownload.saveAs(reportPath);
const reportPage = await context.newPage();
await reportPage.setViewportSize({ width: 390, height: 844 });
await reportPage.goto(pathToFileURL(reportPath).href, { waitUntil: 'load' });
const reportOverflow = await reportPage.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
if (reportOverflow > 1) throw new Error(`HTML report overflows mobile viewport by ${reportOverflow}px`);
await reportPage.close();
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('heading', { name: '任务收集', exact: true }).waitFor();
await page.locator('.attachment-thumb').first().waitFor();
await shot('tasks-desktop.png');

await page.goto(`${baseUrl}#students`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /添加学生/ }).click();
await page.getByPlaceholder('请输入学生姓名').fill('测试同学');
await page.getByPlaceholder('例如 20230001').fill('20239999');
await page.getByRole('button', { name: '取学号末 4 位' }).click();
await page.locator('.modal').getByRole('button', { name: '添加学生', exact: true }).click();
await page.getByText('学生已加入班级名单').waitFor();
await page.getByPlaceholder('搜索姓名、短学号、学号、宿舍或床位').fill('测试同学');
if (await page.locator('.roster-row').count() !== 1) throw new Error('Student search did not return exactly one row');
if (await page.locator('.roster-row .phone-action').count() !== 1) throw new Error('Phone action missing from student row');
if (!(await page.locator('.roster-row .short-no-cell').innerText()).includes('9999')) throw new Error('Short number tail fill failed');

await page.goto(`${baseUrl}#attendance`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /全部出勤/ }).click();
await page.locator('.attendance-card').first().locator('.choice-leave').click();

await page.setViewportSize({ width: 390, height: 844 });
await page.emulateMedia({ colorScheme: 'light' });
await page.goto(`${baseUrl}#dashboard`, { waitUntil: 'networkidle' });
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('heading', { name: /把班级事务/ }).waitFor();
await assertNoHorizontalOverflow('Mobile dashboard');
await shot('dashboard-mobile.png');

await page.goto(`${baseUrl}#tasks`, { waitUntil: 'networkidle' });
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('heading', { name: '任务收集', exact: true }).waitFor();
await assertNoHorizontalOverflow('Mobile tasks');
await shot('tasks-mobile.png');

await page.locator('.class-picker-compact .class-picker-trigger').click();
await page.locator('.class-picker-menu').waitFor();
const classMenuBox = await page.locator('.class-picker-menu').boundingBox();
if (!classMenuBox || classMenuBox.height > 320) throw new Error('Custom class picker takes too much space');
await page.locator('.class-picker-compact .class-picker-trigger').click();

await page.goto(`${baseUrl}#settings`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /深色/ }).click();
if (await page.evaluate(() => document.documentElement.dataset.theme) !== 'dark') throw new Error('Manual dark mode failed');
await shot('settings-mobile-dark.png');
await page.getByRole('button', { name: /跟随系统/ }).click();
if (await page.evaluate(() => document.documentElement.dataset.theme) !== 'light') throw new Error('System light mode failed');

await page.emulateMedia({ colorScheme: 'dark' });
await page.goto(`${baseUrl}#dashboard`, { waitUntil: 'networkidle' });
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('heading', { name: /把班级事务/ }).waitFor();
await assertNoHorizontalOverflow('Dark mobile dashboard');
await shot('dashboard-mobile-dark.png');

await page.emulateMedia({ colorScheme: 'light' });
await page.goto(`${baseUrl}#attendance`, { waitUntil: 'networkidle' });
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('button', { name: /逐个点名/ }).click();
await page.locator('.flash-card').waitFor();
if (await page.locator('.mobile-nav').isVisible()) throw new Error('Mobile navigation should hide in card attendance mode');
const pageScroll = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
if (pageScroll > 1) throw new Error(`Card attendance mode should not scroll, overflow=${pageScroll}px`);
const prevBox = await page.locator('.card-peek-prev').boundingBox();
const cardBox = await page.locator('.flash-card').boundingBox();
const nextBox = await page.locator('.card-peek-next').boundingBox();
if (!prevBox || !cardBox || !nextBox || prevBox.y + prevBox.height > cardBox.y + 1 || nextBox.y < cardBox.y + cardBox.height - 1) throw new Error('Card peeks are hidden by the main card');
const firstName = await page.locator('.flash-name-row h2').innerText();
await page.locator('.flash-status.choice-late').click();
await page.waitForTimeout(450);
const afterLateName = await page.locator('.flash-name-row h2').innerText();
if (afterLateName !== firstName) throw new Error('Card attendance should not auto-advance after late status');
await page.locator('.flash-status.choice-present').click();
await page.waitForTimeout(500);
const secondName = await page.locator('.flash-name-row h2').innerText();
if (firstName === secondName) throw new Error('Card attendance did not auto-advance after present status');
await assertNoHorizontalOverflow('Mobile card attendance');
await shot('attendance-card-mobile.png');

await page.getByRole('button', { name: /返回名单/ }).click();
await page.locator('.date-picker-trigger').click();
await page.locator('.calendar-panel').waitFor();
await page.locator('.modal-footer').getByRole('button', { name: '取消' }).click();

await page.setViewportSize({ width: 768, height: 1000 });
await page.goto(`${baseUrl}#dashboard`, { waitUntil: 'networkidle' });
await page.reload({ waitUntil: 'networkidle' });
await shot('dashboard-tablet.png');

await page.goto(`${baseUrl}#tasks`, { waitUntil: 'networkidle' });
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('heading', { name: '任务收集', exact: true }).waitFor();
await assertNoHorizontalOverflow('Tablet tasks');
await shot('tasks-tablet.png');

await browser.close();

if (consoleErrors.length > 0) {
  console.error('Console errors:', consoleErrors);
  process.exitCode = 1;
} else {
  console.log('QA passed: desktop, mobile, dark mode, card attendance and tablet flows are healthy.');
}
