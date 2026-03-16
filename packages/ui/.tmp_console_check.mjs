import { chromium } from 'playwright';
const routes = ['http://127.0.0.1:13000/','http://127.0.0.1:13000/admin','http://127.0.0.1:13000/admin/jobs','http://127.0.0.1:13000/login'];
const browser = await chromium.launch({headless:true});
for (const url of routes) {
  const page = await browser.newPage();
  const logs=[];
  page.on('console', msg => logs.push(`[console:${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => logs.push(`[pageerror] ${err.stack || err.message}`));
  page.on('requestfailed', req => logs.push(`[requestfailed] ${req.url()} ${req.failure()?.errorText || ''}`));
  try {
    await page.goto(url, {waitUntil:'networkidle', timeout:15000});
  } catch (e) {
    logs.push(`[goto-error] ${e.message}`);
  }
  console.log('URL', url);
  console.log(logs.join('\n') || 'NO_ERRORS');
  console.log('---');
  await page.close();
}
await browser.close();
