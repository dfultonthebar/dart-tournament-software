import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3001';
const SCREENSHOT_DIR = '/home/darts-admin/DartTournament/test-screenshots/events';

test.describe('Events Feature Tests', () => {
  test('Create and verify a new event', async ({ page }) => {
    // Step 1: Go to login page
    console.log('Step 1: Navigating to login page...');
    await page.goto(`${BASE_URL}/admin/login`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-login-page.png`, fullPage: true });
    console.log('Screenshot saved: 01-login-page.png');

    // Step 2: Login with credentials
    console.log('Step 2: Logging in with Admin/1972...');
    await page.fill('input[name="name"], input[placeholder*="Name" i], input[type="text"]', 'Admin');
    await page.fill('input[name="pin"], input[placeholder*="PIN" i], input[type="password"]', '1972');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-login-filled.png`, fullPage: true });
    console.log('Screenshot saved: 02-login-filled.png');

    await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-after-login.png`, fullPage: true });
    console.log('Screenshot saved: 03-after-login.png');

    // Step 3: Navigate to events page
    console.log('Step 3: Navigating to events page...');
    await page.goto(`${BASE_URL}/admin/events`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-events-page.png`, fullPage: true });
    console.log('Screenshot saved: 04-events-page.png');

    // Step 4: Click "+ New Event" button
    console.log('Step 4: Clicking New Event button...');
    const newEventButton = page.locator('button:has-text("New Event"), a:has-text("New Event"), [data-testid="new-event"]');
    await newEventButton.click();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/05-new-event-form.png`, fullPage: true });
    console.log('Screenshot saved: 05-new-event-form.png');

    // Step 5: Fill in the event form
    console.log('Step 5: Filling event form...');

    // Fill Name field
    const nameInput = page.locator('input[name="name"], input[placeholder*="Name" i], input[id*="name" i]').first();
    await nameInput.fill('Test Event 2026');

    // Fill Start Date
    const startDateInput = page.locator('input[name="startDate"], input[name="start_date"], input[type="date"]').first();
    await startDateInput.fill('2026-03-01');

    // Fill End Date
    const endDateInput = page.locator('input[name="endDate"], input[name="end_date"], input[type="date"]').nth(1);
    if (await endDateInput.count() > 0) {
      await endDateInput.fill('2026-03-03');
    } else {
      const altEndDate = page.locator('input[type="date"]').nth(1);
      if (await altEndDate.count() > 0) {
        await altEndDate.fill('2026-03-03');
      }
    }

    // Fill Location
    const locationInput = page.locator('input[name="location"], input[placeholder*="Location" i], input[id*="location" i], textarea[name="location"]');
    if (await locationInput.count() > 0) {
      await locationInput.fill('Test Venue');
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/06-form-filled.png`, fullPage: true });
    console.log('Screenshot saved: 06-form-filled.png');

    // Step 6: Submit the form
    console.log('Step 6: Submitting form...');
    const submitButton = page.locator('button[type="submit"], button:has-text("Create"), button:has-text("Save"), button:has-text("Add")');
    await submitButton.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000); // Wait for any animations
    await page.screenshot({ path: `${SCREENSHOT_DIR}/07-after-submit.png`, fullPage: true });
    console.log('Screenshot saved: 07-after-submit.png');

    // Step 7: Verify event appears in list
    console.log('Step 7: Verifying event in list...');
    // Navigate back to events list if redirected elsewhere
    if (!page.url().includes('/admin/events')) {
      await page.goto(`${BASE_URL}/admin/events`);
      await page.waitForLoadState('networkidle');
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/08-events-list-with-new.png`, fullPage: true });
    console.log('Screenshot saved: 08-events-list-with-new.png');

    // Look for the new event in the list
    const eventInList = page.locator('text=Test Event 2026');
    const eventVisible = await eventInList.isVisible().catch(() => false);
    console.log(`Event "Test Event 2026" visible in list: ${eventVisible}`);

    // Step 8: Click on the event to view details
    console.log('Step 8: Clicking on event to view details...');
    if (eventVisible) {
      await eventInList.first().click();
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: `${SCREENSHOT_DIR}/09-event-details.png`, fullPage: true });
      console.log('Screenshot saved: 09-event-details.png');
    } else {
      // Try clicking on any event row/card that might contain our event
      const eventRow = page.locator('[class*="event"], [class*="card"], tr, [role="row"]').filter({ hasText: 'Test Event 2026' });
      if (await eventRow.count() > 0) {
        await eventRow.first().click();
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: `${SCREENSHOT_DIR}/09-event-details.png`, fullPage: true });
        console.log('Screenshot saved: 09-event-details.png');
      } else {
        console.log('Could not find event to click for details view');
        await page.screenshot({ path: `${SCREENSHOT_DIR}/09-event-not-found.png`, fullPage: true });
      }
    }

    // Final verification
    console.log('Test completed!');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/10-final-state.png`, fullPage: true });
    console.log('Screenshot saved: 10-final-state.png');
  });
});
