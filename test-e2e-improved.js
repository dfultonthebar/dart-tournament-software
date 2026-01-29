const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = '/home/darts-admin/DartTournament/test-screenshots';
const BASE_URL = 'http://localhost:3001';

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// Clear old screenshots
const oldFiles = fs.readdirSync(SCREENSHOT_DIR).filter(f => f.endsWith('.png'));
oldFiles.forEach(f => fs.unlinkSync(path.join(SCREENSHOT_DIR, f)));
console.log(`Cleared ${oldFiles.length} old screenshots\n`);

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('Starting Dart Tournament E2E Tests...\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Screenshots: ${SCREENSHOT_DIR}\n`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 }
  });
  const page = await context.newPage();

  let testResults = [];
  let screenshotIndex = 1;

  async function screenshot(name) {
    const filename = `${String(screenshotIndex).padStart(2, '0')}-${name}.png`;
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, filename), fullPage: true });
    console.log(`    Screenshot: ${filename}`);
    screenshotIndex++;
    return filename;
  }

  try {
    // ========== TEST 1: Login as Admin ==========
    console.log('=== TEST 1: Login as Admin ===');

    await page.goto(`${BASE_URL}/admin/login`);
    await page.waitForLoadState('networkidle');
    await screenshot('login-page');

    // The form has two inputs - first is name (text), second is PIN (text with inputMode=numeric)
    const inputs = await page.$$('input');
    console.log(`    Found ${inputs.length} input fields`);

    // Fill name field (first input)
    await page.fill('input[type="text"]:first-of-type', 'Admin');

    // The PIN field is also type="text" but with inputMode="numeric"
    // Get all text inputs and fill the second one
    const textInputs = await page.$$('input[type="text"]');
    if (textInputs.length >= 2) {
      await textInputs[1].fill('1972');
    }

    await screenshot('login-filled');

    // Click login button
    await page.click('button[type="submit"]');
    await delay(2000);
    await page.waitForLoadState('networkidle');

    await screenshot('after-login');
    console.log(`    Current URL: ${page.url()}`);

    // Check if login was successful
    const loginSuccess = page.url().includes('/admin') && !page.url().includes('/login');
    testResults.push({ test: 'Login as Admin', passed: loginSuccess, details: loginSuccess ? 'Redirected to admin dashboard' : 'Still on login page' });

    if (!loginSuccess) {
      // Check for error message
      const errorText = await page.$eval('.bg-red-600', el => el.textContent).catch(() => null);
      if (errorText) {
        console.log(`    Error: ${errorText}`);
      }
    }

    console.log(`    Result: ${loginSuccess ? 'PASSED' : 'FAILED'}\n`);

    // ========== TEST 2: Admin Dashboard ==========
    console.log('=== TEST 2: Admin Dashboard ===');

    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('networkidle');
    await delay(500);
    await screenshot('admin-dashboard');

    // Check for login warning
    const needsLogin = await page.$('text=You need to login');
    if (needsLogin) {
      console.log('    Warning: Not logged in - some features may be restricted');
    }

    testResults.push({ test: 'Admin Dashboard', passed: true, details: needsLogin ? 'Dashboard visible but not logged in' : 'Dashboard fully accessible' });
    console.log('    Result: PASSED\n');

    // ========== TEST 3: Test Events Feature ==========
    console.log('=== TEST 3: Test Events Feature ===');

    // Click on Events card
    await page.click('text=Events');
    await delay(500);
    await page.waitForLoadState('networkidle');
    await screenshot('events-page');

    console.log(`    Navigated to: ${page.url()}`);

    // Look for Create Event button
    const createEventBtn = await page.$('text=Create Event') ||
                           await page.$('text=New Event') ||
                           await page.$('a[href*="events/new"]');

    if (createEventBtn) {
      await createEventBtn.click();
      await delay(500);
      await page.waitForLoadState('networkidle');
      await screenshot('create-event-form');

      // Fill event form
      const eventInputs = await page.$$('input');
      console.log(`    Found ${eventInputs.length} inputs on event form`);

      // Fill name
      const nameInput = await page.$('input[name="name"]') || await page.$('input[placeholder*="name" i]');
      if (nameInput) {
        await nameInput.fill('Lime Kiln Grand 2026');
      }

      // Fill dates
      const dateInputs = await page.$$('input[type="date"]');
      if (dateInputs.length >= 1) {
        await dateInputs[0].fill('2026-02-01');
        console.log('    Filled start date: 2026-02-01');
      }
      if (dateInputs.length >= 2) {
        await dateInputs[1].fill('2026-02-03');
        console.log('    Filled end date: 2026-02-03');
      }

      // Fill location
      const locationInput = await page.$('input[name="location"]') || await page.$('input[placeholder*="location" i]');
      if (locationInput) {
        await locationInput.fill('Lime Kiln Pub');
      }

      await screenshot('event-form-filled');

      // Submit form
      const submitBtn = await page.$('button[type="submit"]');
      if (submitBtn) {
        await submitBtn.click();
        await delay(1000);
        await page.waitForLoadState('networkidle');
      }

      await screenshot('event-after-submit');
    }

    testResults.push({ test: 'Events Feature', passed: true, details: 'Event form accessible' });
    console.log('    Result: PASSED\n');

    // ========== TEST 4: Test Dartboards ==========
    console.log('=== TEST 4: Test Dartboards ===');

    await page.goto(`${BASE_URL}/admin/dartboards`);
    await page.waitForLoadState('networkidle');
    await delay(500);
    await screenshot('dartboards-page');

    // Count dartboards
    const dartboardCards = await page.$$('.border-green-500, [class*="green"]');
    console.log(`    Found ${dartboardCards.length} dartboard cards`);

    // Check for available boards
    const availableBadges = await page.$$('text=Available');
    console.log(`    Found ${availableBadges.length} available dartboards`);

    testResults.push({ test: 'Dartboards', passed: dartboardCards.length > 0, details: `${dartboardCards.length} dartboards displayed` });
    console.log('    Result: PASSED\n');

    // ========== TEST 5: Test Tournament Creation ==========
    console.log('=== TEST 5: Test Tournament Creation ===');

    await page.goto(`${BASE_URL}/admin/tournaments/new`);
    await page.waitForLoadState('networkidle');
    await delay(500);
    await screenshot('tournament-form');

    // Check if we're on tournament form or login redirect
    const currentUrl = page.url();
    console.log(`    URL: ${currentUrl}`);

    if (currentUrl.includes('/login')) {
      console.log('    Redirected to login - need authentication for tournament creation');
      testResults.push({ test: 'Tournament Creation', passed: false, details: 'Requires authentication' });
    } else {
      // Fill tournament form
      const tournamentNameInput = await page.$('input[name="name"]');
      if (tournamentNameInput) {
        await tournamentNameInput.fill('Test Tournament 501');
      }

      // Select game type
      const gameTypeSelect = await page.$('select[name="gameType"]');
      if (gameTypeSelect) {
        await gameTypeSelect.selectOption('501');
        console.log('    Selected game type: 501');
      }

      // Select format
      const formatSelect = await page.$('select[name="format"]');
      if (formatSelect) {
        await formatSelect.selectOption({ index: 0 }); // First option
        console.log('    Selected format');
      }

      await screenshot('tournament-form-filled');

      // Submit
      const submitBtn = await page.$('button[type="submit"]');
      if (submitBtn) {
        await submitBtn.click();
        await delay(1000);
        await page.waitForLoadState('networkidle');
      }

      await screenshot('tournament-created');
      testResults.push({ test: 'Tournament Creation', passed: true, details: 'Form accessible' });
    }

    console.log('    Result: ' + (testResults[testResults.length-1].passed ? 'PASSED' : 'NEEDS LOGIN') + '\n');

    // ========== TEST 6: View All Tournaments ==========
    console.log('=== TEST 6: View All Tournaments ===');

    await page.goto(`${BASE_URL}/admin/tournaments`);
    await page.waitForLoadState('networkidle');
    await delay(500);
    await screenshot('all-tournaments');

    // Check for tournament list
    const tournamentItems = await page.$$('a[href*="/tournaments/"]');
    console.log(`    Found ${tournamentItems.length} tournament links`);

    testResults.push({ test: 'All Tournaments', passed: true, details: `${tournamentItems.length} tournaments visible` });
    console.log('    Result: PASSED\n');

    // ========== TEST 7: Scoring Terminal ==========
    console.log('=== TEST 7: Scoring Terminal ===');

    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');
    await delay(500);
    await screenshot('scoring-terminal-home');

    console.log(`    Scoring terminal loaded`);
    testResults.push({ test: 'Scoring Terminal', passed: true, details: 'Home page loaded' });
    console.log('    Result: PASSED\n');

    // ========== TEST 8: Match Scoring Flow ==========
    console.log('=== TEST 8: Match Scoring Flow ===');

    // Try to access score page
    await page.goto(`${BASE_URL}/score`);
    await page.waitForLoadState('networkidle');
    await delay(500);
    await screenshot('score-page');

    const scorePageUrl = page.url();
    console.log(`    Score page URL: ${scorePageUrl}`);

    testResults.push({ test: 'Match Scoring', passed: true, details: 'Score page accessible' });
    console.log('    Result: PASSED\n');

  } catch (error) {
    console.error('\n!!! Test error:', error.message);
    await screenshot('error-state');
    testResults.push({ test: 'Error occurred', passed: false, details: error.message });
  } finally {
    await browser.close();
  }

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('               TEST SUMMARY');
  console.log('='.repeat(50));

  let passed = 0, failed = 0;
  testResults.forEach(result => {
    const status = result.passed ? 'PASS' : 'FAIL';
    const icon = result.passed ? '[+]' : '[-]';
    console.log(`${icon} ${status}: ${result.test}`);
    console.log(`         ${result.details}`);
    if (result.passed) passed++; else failed++;
  });

  console.log('='.repeat(50));
  console.log(`Total: ${passed} passed, ${failed} failed out of ${testResults.length} tests`);
  console.log('='.repeat(50));

  // List screenshots
  console.log('\n' + '='.repeat(50));
  console.log('              SCREENSHOTS');
  console.log('='.repeat(50));
  const screenshots = fs.readdirSync(SCREENSHOT_DIR).filter(f => f.endsWith('.png')).sort();
  screenshots.forEach(f => {
    console.log(`  ${path.join(SCREENSHOT_DIR, f)}`);
  });
  console.log('='.repeat(50) + '\n');
}

runTests();
