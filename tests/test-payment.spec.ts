import { test, expect } from '@playwright/test';

test.describe('Payment Tracking', () => {
  test('admin can mark players as paid before starting tournament', async ({ page }) => {
    // Go to admin login
    await page.goto('http://localhost:3001/admin/login');

    // Login as admin
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'TheBar#1');
    await page.click('button[type="submit"]');

    // Wait for redirect to admin page
    await page.waitForURL('**/admin');

    // Go to tournaments list
    await page.click('text=Manage Tournaments');
    await page.waitForURL('**/admin/tournaments');

    // Click on first tournament
    await page.click('a[href*="/admin/tournaments/"]');

    // Wait for tournament detail page
    await page.waitForSelector('text=Players');

    // Take screenshot of initial state
    await page.screenshot({ path: '/tmp/payment-1-initial.png', fullPage: true });

    // Check for unpaid status
    const unpaidLabels = await page.locator('text=Unpaid').count();
    console.log(`Found ${unpaidLabels} unpaid players`);

    // Check if Start Tournament button exists and is disabled
    const startButton = page.locator('button:has-text("Start Tournament")');
    if (await startButton.count() > 0) {
      const isDisabled = await startButton.isDisabled();
      console.log(`Start button disabled: ${isDisabled}`);
    }

    // Click first payment checkbox
    const firstCheckbox = page.locator('input[type="checkbox"]').first();
    if (await firstCheckbox.count() > 0) {
      await firstCheckbox.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: '/tmp/payment-2-after-click.png', fullPage: true });
    }

    // Final screenshot
    await page.screenshot({ path: '/tmp/payment-3-final.png', fullPage: true });

    console.log('Test completed! Screenshots saved to /tmp/');
  });
});
