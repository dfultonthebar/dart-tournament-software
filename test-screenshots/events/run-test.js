const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:3001';
const SCREENSHOT_DIR = '/home/darts-admin/DartTournament/test-screenshots/events';

async function runTest() {
  console.log('Starting Events Feature Test...\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();

  // Track API responses
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('/api/')) {
      const status = response.status();
      console.log(`  [API ${response.request().method()} ${status}]: ${url.split('/api/')[1]}`);
    }
  });

  let errors = [];

  try {
    // Step 1: Go to login page
    console.log('Step 1: Navigating to login page...');
    await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-login-page.png`, fullPage: true });
    console.log('  Screenshot saved: 01-login-page.png');

    // Step 2: Login with credentials
    console.log('\nStep 2: Logging in with Admin/1972...');

    const textInputs = page.locator('input[type="text"]');
    await textInputs.first().fill('Admin');
    await textInputs.nth(1).fill('1972');

    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-login-filled.png`, fullPage: true });
    console.log('  Screenshot saved: 02-login-filled.png');

    const loginButton = page.locator('button[type="submit"]');
    await loginButton.click();
    await page.waitForTimeout(3000);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-after-login.png`, fullPage: true });
    console.log('  Screenshot saved: 03-after-login.png');
    console.log(`  Current URL: ${page.url()}`);

    if (page.url().includes('/admin') && !page.url().includes('/login')) {
      console.log('  Login successful!');
    } else {
      errors.push('Login failed');
    }

    // Step 3: Navigate to events page
    console.log('\nStep 3: Navigating to events page...');
    await page.goto(`${BASE_URL}/admin/events`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-events-page.png`, fullPage: true });
    console.log('  Screenshot saved: 04-events-page.png');

    const initialCount = await page.locator('text=/Total:.*events?/').textContent().catch(() => 'N/A');
    console.log(`  ${initialCount}`);

    // Step 4: Click New Event link
    console.log('\nStep 4: Clicking New Event button...');
    const newEventLink = page.locator('a:has-text("New Event")');
    await newEventLink.click();
    await page.waitForTimeout(2000);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/05-new-event-form.png`, fullPage: true });
    console.log('  Screenshot saved: 05-new-event-form.png');
    console.log(`  Current URL: ${page.url()}`);

    // Step 5: Fill in the event form
    console.log('\nStep 5: Filling event form...');

    // Fill Event Name
    const nameInput = page.locator('input[type="text"]').first();
    await nameInput.fill('Test Event 2026');
    console.log('  Filled: Event Name = "Test Event 2026"');

    // Fill Location
    const allTextInputs = page.locator('input[type="text"]');
    if (await allTextInputs.count() > 1) {
      await allTextInputs.nth(1).fill('Test Venue');
      console.log('  Filled: Location = "Test Venue"');
    }

    // Fill Start Date
    const startDateInput = page.locator('input[type="date"]').first();
    await startDateInput.fill('2026-03-01');
    console.log('  Filled: Start Date = "2026-03-01"');

    // Fill End Date
    const endDateInput = page.locator('input[type="date"]').nth(1);
    await endDateInput.fill('2026-03-03');
    console.log('  Filled: End Date = "2026-03-03"');

    await page.screenshot({ path: `${SCREENSHOT_DIR}/06-form-filled.png`, fullPage: true });
    console.log('  Screenshot saved: 06-form-filled.png');

    // Step 6: Submit the form
    console.log('\nStep 6: Submitting form...');

    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    console.log('  Clicked Create Event button');

    await page.waitForTimeout(3000);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/07-after-submit.png`, fullPage: true });
    console.log('  Screenshot saved: 07-after-submit.png');
    console.log(`  Current URL: ${page.url()}`);

    // Check if navigated to event details page
    if (page.url().includes('/events/') && !page.url().includes('/new')) {
      console.log('  Event creation successful - navigated to event details page');
    } else {
      const formError = await page.locator('.bg-red-600').textContent().catch(() => null);
      if (formError) {
        console.log(`  Form Error: ${formError}`);
        errors.push(`Form error: ${formError}`);
      }
    }

    // Step 7: Verify event appears in list
    console.log('\nStep 7: Verifying event in list...');

    await page.goto(`${BASE_URL}/admin/events`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/08-events-list-with-new.png`, fullPage: true });
    console.log('  Screenshot saved: 08-events-list-with-new.png');

    const finalCount = await page.locator('text=/Total:.*events?/').textContent().catch(() => 'N/A');
    console.log(`  ${finalCount}`);

    const pageText = await page.textContent('body');
    if (pageText.includes('Test Event 2026')) {
      console.log('  SUCCESS: Event "Test Event 2026" found in list!');
    } else {
      console.log('  WARNING: Event "Test Event 2026" NOT found in list');
      errors.push('Event not found in list after creation');
    }

    // Step 8: Click on event to view details
    console.log('\nStep 8: Viewing event details...');

    // Find manage link for an event (use first() to avoid strict mode violation)
    const manageLinks = page.locator('a:has-text("Manage")');
    if (await manageLinks.count() > 0) {
      await manageLinks.first().click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/09-event-details.png`, fullPage: true });
      console.log('  Screenshot saved: 09-event-details.png');
      console.log(`  Current URL: ${page.url()}`);
    } else {
      console.log('  No events available to view');
      errors.push('No events available to click');
    }

    // Final state
    await page.screenshot({ path: `${SCREENSHOT_DIR}/10-final-state.png`, fullPage: true });
    console.log('\nStep 9: Final screenshot saved: 10-final-state.png');

  } catch (error) {
    console.error('\nERROR during test:', error.message);
    errors.push(error.message);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/error-screenshot.png`, fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));

  if (errors.length === 0) {
    console.log('Status: SUCCESS');
    console.log('All test steps completed successfully!');
  } else {
    console.log('Status: COMPLETED WITH ISSUES');
    console.log('\nIssues encountered:');
    errors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
  }

  console.log('\nScreenshots saved to:', SCREENSHOT_DIR);

  const fs = require('fs');
  const screenshots = fs.readdirSync(SCREENSHOT_DIR).filter(f => f.endsWith('.png')).sort();
  console.log('\nScreenshots:');
  screenshots.forEach(s => console.log(`  - ${s}`));

  console.log('='.repeat(60));

  return errors.length === 0;
}

runTest().catch(console.error);
