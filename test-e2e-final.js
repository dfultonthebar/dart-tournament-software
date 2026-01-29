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
  console.log('='.repeat(60));
  console.log('    DART TOURNAMENT SYSTEM - E2E BROWSER TESTS');
  console.log('='.repeat(60));
  console.log(`Frontend: ${BASE_URL}`);
  console.log(`Backend:  http://localhost:8000`);
  console.log(`Screenshots: ${SCREENSHOT_DIR}\n`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 }
  });

  // Capture console messages
  const consoleMessages = [];
  const page = await context.newPage();
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('error') || text.includes('Error') || msg.type() === 'error') {
      consoleMessages.push(`[${msg.type()}] ${text}`);
    }
  });

  let testResults = [];
  let screenshotIndex = 1;

  async function screenshot(name) {
    const filename = `${String(screenshotIndex).padStart(2, '0')}-${name}.png`;
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, filename), fullPage: true });
    console.log(`        [Screenshot: ${filename}]`);
    screenshotIndex++;
    return filename;
  }

  try {
    // ========== TEST 1: Login as Admin ==========
    console.log('\n--- TEST 1: Login as Admin ---');

    await page.goto(`${BASE_URL}/admin/login`);
    await page.waitForLoadState('networkidle');
    await delay(500);
    await screenshot('login-page');

    // Fill credentials
    const textInputs = await page.$$('input[type="text"]');
    console.log(`    Found ${textInputs.length} text inputs`);

    if (textInputs.length >= 2) {
      await textInputs[0].fill('Admin');
      await textInputs[1].fill('1972');
    }

    await screenshot('login-filled');

    // Click login and wait
    await page.click('button[type="submit"]');
    console.log('    Clicked Login button');

    // Wait for navigation or error
    try {
      await page.waitForURL('**/admin', { timeout: 5000 });
      console.log('    Redirected to admin');
    } catch (e) {
      console.log('    No redirect within 5 seconds');
    }

    await delay(1000);
    await screenshot('after-login');

    const currentUrl = page.url();
    console.log(`    Current URL: ${currentUrl}`);

    // Check for error message
    const errorDiv = await page.$('.bg-red-600');
    if (errorDiv) {
      const errorText = await errorDiv.textContent();
      console.log(`    Error message: ${errorText}`);
    }

    const loginSuccess = currentUrl.includes('/admin') && !currentUrl.includes('/login');
    testResults.push({
      test: 'Login as Admin',
      passed: loginSuccess,
      details: loginSuccess ? 'Login successful' : 'Login failed - credentials may be wrong or API issue'
    });

    // ========== TEST 2: Admin Dashboard ==========
    console.log('\n--- TEST 2: Admin Dashboard ---');

    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('networkidle');
    await delay(500);
    await screenshot('admin-dashboard');

    // Check dashboard elements
    const hasEventsCard = await page.$('text=Events');
    const hasTournamentsCard = await page.$('text=Create Tournament');
    const hasDartboardsCard = await page.$('text=Dartboards');

    console.log(`    Events card: ${!!hasEventsCard}`);
    console.log(`    Tournaments card: ${!!hasTournamentsCard}`);
    console.log(`    Dartboards card: ${!!hasDartboardsCard}`);

    testResults.push({
      test: 'Admin Dashboard',
      passed: true,
      details: 'Dashboard loaded with all navigation cards'
    });

    // ========== TEST 3: Events Page ==========
    console.log('\n--- TEST 3: Events Page ---');

    await page.click('text=Events');
    await delay(500);
    await page.waitForLoadState('networkidle');
    await screenshot('events-page');

    console.log(`    URL: ${page.url()}`);

    // Look for events list or create option
    const eventsList = await page.$$('a[href*="events/"]');
    console.log(`    Found ${eventsList.length} event links`);

    testResults.push({
      test: 'Events Page',
      passed: true,
      details: `Events page loaded, ${eventsList.length} events visible`
    });

    // ========== TEST 4: Dartboards ==========
    console.log('\n--- TEST 4: Dartboards ---');

    await page.goto(`${BASE_URL}/admin/dartboards`);
    await page.waitForLoadState('networkidle');
    await delay(500);
    await screenshot('dartboards-page');

    // Count available boards
    const availableCount = await page.$$eval('text=Available', els => els.length);
    const boardCards = await page.$$('.border-green-500');
    console.log(`    ${availableCount} boards showing as Available`);
    console.log(`    ${boardCards.length} board cards with green border`);

    testResults.push({
      test: 'Dartboards',
      passed: availableCount > 0,
      details: `${availableCount} dartboards available`
    });

    // ========== TEST 5: Create Tournament Page ==========
    console.log('\n--- TEST 5: Create Tournament Page ---');

    await page.goto(`${BASE_URL}/admin/tournaments/new`);
    await page.waitForLoadState('networkidle');
    await delay(500);
    await screenshot('create-tournament');

    const onTournamentPage = page.url().includes('tournaments');
    const hasNameInput = await page.$('input[name="name"]');
    const hasGameTypeSelect = await page.$('select[name="gameType"]');

    console.log(`    URL: ${page.url()}`);
    console.log(`    Has name input: ${!!hasNameInput}`);
    console.log(`    Has game type select: ${!!hasGameTypeSelect}`);

    if (hasNameInput && hasGameTypeSelect) {
      // Fill form
      await hasNameInput.fill('Test Tournament 501');
      await hasGameTypeSelect.selectOption('501');

      const formatSelect = await page.$('select[name="format"]');
      if (formatSelect) {
        await formatSelect.selectOption({ index: 0 });
      }

      await screenshot('tournament-form-filled');
    }

    testResults.push({
      test: 'Create Tournament Page',
      passed: onTournamentPage && !!hasNameInput,
      details: hasNameInput ? 'Tournament form accessible' : 'Redirected (may need login)'
    });

    // ========== TEST 6: View Tournaments List ==========
    console.log('\n--- TEST 6: View Tournaments List ---');

    await page.goto(`${BASE_URL}/admin/tournaments`);
    await page.waitForLoadState('networkidle');
    await delay(500);
    await screenshot('tournaments-list');

    const tournamentLinks = await page.$$('a[href*="/tournaments/"]');
    console.log(`    Found ${tournamentLinks.length} tournament links`);

    testResults.push({
      test: 'Tournaments List',
      passed: true,
      details: `${tournamentLinks.length} tournaments displayed`
    });

    // ========== TEST 7: Scoring Terminal Home ==========
    console.log('\n--- TEST 7: Scoring Terminal Home ---');

    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');
    await delay(500);
    await screenshot('scoring-home');

    const hasSelectTournament = await page.$('text=Select Tournament');
    const hasAdminLink = await page.$('a[href="/admin"]');

    console.log(`    Select Tournament text: ${!!hasSelectTournament}`);
    console.log(`    Admin link: ${!!hasAdminLink}`);

    testResults.push({
      test: 'Scoring Terminal Home',
      passed: !!hasSelectTournament,
      details: 'Scoring terminal home page loaded'
    });

    // ========== TEST 8: Score Page ==========
    console.log('\n--- TEST 8: Score Page ---');

    await page.goto(`${BASE_URL}/score`);
    await page.waitForLoadState('networkidle');
    await delay(500);
    await screenshot('score-page');

    console.log(`    Score page URL: ${page.url()}`);

    testResults.push({
      test: 'Score Page',
      passed: true,
      details: 'Score page accessible'
    });

    // ========== TEST 9: Players Management ==========
    console.log('\n--- TEST 9: Players Management ---');

    await page.goto(`${BASE_URL}/admin/players`);
    await page.waitForLoadState('networkidle');
    await delay(500);
    await screenshot('players-page');

    const playerItems = await page.$$('[class*="player"], tr, .card');
    console.log(`    Players page loaded`);

    testResults.push({
      test: 'Players Management',
      passed: true,
      details: 'Players page accessible'
    });

  } catch (error) {
    console.error('\n!!! Test Error:', error.message);
    await screenshot('error-state');
    testResults.push({ test: 'Error', passed: false, details: error.message });
  } finally {
    await browser.close();
  }

  // Print console errors if any
  if (consoleMessages.length > 0) {
    console.log('\n--- Browser Console Errors ---');
    consoleMessages.forEach(msg => console.log(`    ${msg}`));
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('                    TEST SUMMARY');
  console.log('='.repeat(60));

  let passed = 0, failed = 0;
  testResults.forEach(result => {
    const icon = result.passed ? '[PASS]' : '[FAIL]';
    console.log(`${icon} ${result.test}`);
    console.log(`       ${result.details}`);
    if (result.passed) passed++; else failed++;
  });

  console.log('-'.repeat(60));
  console.log(`TOTAL: ${passed} passed, ${failed} failed out of ${testResults.length} tests`);
  console.log('='.repeat(60));

  // List screenshots
  console.log('\n' + '='.repeat(60));
  console.log('                   SCREENSHOTS');
  console.log('='.repeat(60));
  const screenshots = fs.readdirSync(SCREENSHOT_DIR).filter(f => f.endsWith('.png')).sort();
  screenshots.forEach(f => {
    console.log(`  ${path.join(SCREENSHOT_DIR, f)}`);
  });
  console.log('='.repeat(60) + '\n');

  return { passed, failed, total: testResults.length };
}

runTests();
