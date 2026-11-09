import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.APP_URL ?? 'http://127.0.0.1:4173/';
const chromePath = process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outputDir = path.resolve('docs/screenshots');
await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ executablePath: chromePath, headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
const page = await context.newPage();
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

await page.goto(baseUrl, { waitUntil: 'networkidle' });
await page.getByRole('heading', { name: /把班级事务/ }).waitFor();
await shot('dashboard-desktop.png');

await page.goto(`${baseUrl}#attendance`, { waitUntil: 'networkidle' });
await page.getByRole('heading', { name: '课堂点名', exact: true }).waitFor();
const firstCard = page.locator('.attendance-card').first();
await firstCard.locator('.choice-leave').click();
await firstCard.locator('.note-button').click();
await page.locator('.modal').getByRole('button', { name: '请假', exact: true }).click();
await page.getByRole('button', { name: '保存备注' }).click();
await page.getByText('备注已保存').waitFor();
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('heading', { name: '课堂点名', exact: true }).waitFor();
await shot('attendance-desktop.png');

await page.goto(`${baseUrl}#tasks`, { waitUntil: 'networkidle' });
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('heading', { name: '任务收集', exact: true }).waitFor();
const firstSubmission = page.locator('.submission-row').first();
const fileChooserPromise = page.waitForEvent('filechooser');
await firstSubmission.locator('.upload-attachment').click();
const fileChooser = await fileChooserPromise;
await fileChooser.setFiles(path.resolve('public/icons/icon-192.png'));
await firstSubmission.locator('.attachment-thumb').waitFor();
const htmlDownloadPromise = page.waitForEvent('download');
await page.getByRole('button', { name: /图文报告/ }).click();
const htmlDownload = await htmlDownloadPromise;
if (!htmlDownload.suggestedFilename().endsWith('.html')) throw new Error('HTML report filename is invalid');
await page.getByText('图文报告已生成').waitFor();
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('heading', { name: '任务收集', exact: true }).waitFor();
await page.locator('.attachment-thumb').first().waitFor();
await shot('tasks-desktop.png');

await page.goto(`${baseUrl}#students`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /添加学生/ }).click();
await page.getByPlaceholder('请输入学生姓名').fill('测试同学');
await page.getByPlaceholder('例如 20230001').fill('20239999');
await page.locator('.modal').getByRole('button', { name: '添加学生', exact: true }).click();
await page.getByText('学生已加入班级名单').waitFor();
await page.getByPlaceholder('搜索姓名、学号或宿舍').fill('测试同学');
if (await page.locator('.roster-row').count() !== 1) throw new Error('Student search did not return exactly one row');

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${baseUrl}#dashboard`, { waitUntil: 'networkidle' });
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('heading', { name: /把班级事务/ }).waitFor();
const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
if (mobileOverflow > 1) throw new Error(`Mobile dashboard overflows horizontally by ${mobileOverflow}px`);
await shot('dashboard-mobile.png');

await page.goto(`${baseUrl}#tasks`, { waitUntil: 'networkidle' });
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('heading', { name: '任务收集', exact: true }).waitFor();
const taskOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
if (taskOverflow > 1) throw new Error(`Mobile tasks overflows horizontally by ${taskOverflow}px`);
await shot('tasks-mobile.png');

await page.setViewportSize({ width: 768, height: 1000 });
await page.goto(`${baseUrl}#dashboard`, { waitUntil: 'networkidle' });
await page.reload({ waitUntil: 'networkidle' });
await shot('dashboard-tablet.png');

await browser.close();

if (consoleErrors.length > 0) {
  console.error('Console errors:', consoleErrors);
  process.exitCode = 1;
} else {
  console.log('QA passed: desktop, mobile and tablet flows rendered without console errors.');
}
