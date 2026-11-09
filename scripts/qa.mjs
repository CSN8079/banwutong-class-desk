import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';

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
await page.locator('.modal').getByText('点击下方按钮抽取一名学生').waitFor();
await page.locator('.modal').getByRole('button', { name: '开始抽取' }).click();
await page.locator('.modal .random-picker h3').waitFor();
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

await page.getByRole('button', { name: /完成点名/ }).click();
await page.locator('.session-accordion').waitFor();
await page.locator('.page-actions').getByRole('button', { name: /新建点名/ }).click();
await page.locator('.modal input').fill('第二节课点名');
await page.getByRole('button', { name: '创建并开始点名' }).click();
await page.locator('.session-hero h2').getByText('第二节课点名').waitFor();

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
if (!html.includes('lightbox') || !html.includes('zoomable') || !html.includes('evidence-grid')) throw new Error('HTML report zoom/evidence markup missing');
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
await page.getByPlaceholder('搜索姓名、班级学号、学号、宿舍或床位').fill('测试同学');
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
await assertNoHorizontalOverflow('Mobile card attendance');
await shot('attendance-card-mobile.png');

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
