const { chromium } = require('playwright');

async function takeScreenshot() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Login
  await page.goto('http://localhost:3001/admin/login');
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'TheBar#1');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);

  // Go to tournament
  await page.goto('http://localhost:3001/admin/tournaments/662ae97a-5aee-4564-8032-a50af4938031');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  await page.screenshot({ path: '/tmp/payment-final-all-paid.png', fullPage: true });
  console.log('Screenshot saved to /tmp/payment-final-all-paid.png');

  // Check if Start Tournament button is enabled
  const startButton = page.locator('button:has-text("Start Tournament")');
  if (await startButton.count() > 0) {
    const isDisabled = await startButton.isDisabled();
    console.log(`Start Tournament button disabled: ${isDisabled}`);
    if (!isDisabled) {
      console.log('✓ SUCCESS: Start Tournament button is ENABLED!');
    }
  }

  await page.waitForTimeout(5000);
  await browser.close();
}

takeScreenshot();
