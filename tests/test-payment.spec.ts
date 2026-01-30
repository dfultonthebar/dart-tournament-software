import { test, expect } from '@playwright/test';

test.describe('Payment Tracking', () => {
  test('admin can mark players as paid before starting tournament', async ({ page }) => {
    // Go to admin login
    await page.goto('http://localhost:3001/admin/login');

    // Login as admin with PIN
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await page.getByPlaceholder('Admin').fill('Admin');
    await page.getByPlaceholder('••••').fill('1972');
    await page.click('button[type="submit"]');

    // Wait for redirect to admin sport selection
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Click on Darts sport to get to darts admin
    const dartsLink = page.locator('a[href*="darts"]').first();
    if (await dartsLink.isVisible()) {
      await dartsLink.click();
      await page.waitForLoadState('networkidle');
    }

    // Navigate to tournaments page
    await page.goto('http://localhost:3001/admin/tournaments');
    await page.waitForLoadState('networkidle');

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
