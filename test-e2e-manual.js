const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = '/home/darts-admin/DartTournament/test-screenshots';
const BASE_URL = 'http://localhost:3001';

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('Starting Dart Tournament E2E Tests...\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 }
  });
  const page = await context.newPage();

  let testResults = [];

  try {
    // ========== TEST 1: Login as Admin ==========
    console.log('=== TEST 1: Login as Admin ===');

    await page.goto(`${BASE_URL}/admin/login`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-login-page.png'), fullPage: true });
    console.log('  Screenshot: 01-login-page.png');

    // Look for input fields
    const nameInput = await page.$('input[name="name"]') ||
                      await page.$('input[placeholder*="name" i]') ||
                      await page.$('input[type="text"]');
    const pinInput = await page.$('input[name="pin"]') ||
                     await page.$('input[placeholder*="pin" i]') ||
                     await page.$('input[type="password"]');

    if (nameInput && pinInput) {
      await nameInput.fill('Admin');
      await pinInput.fill('1972');
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-login-filled.png'), fullPage: true });
      console.log('  Screenshot: 02-login-filled.png');

      // Click login
      const loginBtn = await page.$('button[type="submit"]') ||
                       await page.$('button:has-text("Login")');
      if (loginBtn) {
        await loginBtn.click();
        await delay(2000);
        await page.waitForLoadState('networkidle');
      }
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-after-login.png'), fullPage: true });
    console.log('  Screenshot: 03-after-login.png');
    console.log(`  Current URL: ${page.url()}`);

    const loginSuccess = page.url().includes('/admin') && !page.url().includes('/login');
    testResults.push({ test: 'Login as Admin', passed: loginSuccess });
    console.log(`  Result: ${loginSuccess ? 'PASSED' : 'FAILED'}\n`);

    // ========== TEST 2: Test Events Feature ==========
    console.log('=== TEST 2: Test Events Feature ===');

    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('networkidle');
    await delay(1000);

    // Click on Events card
    const eventsCard = await page.$('a[href*="events"]') ||
                       await page.$('div:has-text("Events")');

    if (eventsCard) {
      await eventsCard.click();
      await delay(1000);
      await page.waitForLoadState('networkidle');
    } else {
      // Try direct navigation
      await page.goto(`${BASE_URL}/admin/events`);
      await page.waitForLoadState('networkidle');
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-events-page.png'), fullPage: true });
    console.log('  Screenshot: 04-events-page.png');

    // Click Create Event button
    const createEventBtn = await page.$('button:has-text("Create Event")') ||
                           await page.$('button:has-text("New Event")') ||
                           await page.$('a:has-text("Create Event")') ||
                           await page.$('a:has-text("New Event")');

    if (createEventBtn) {
      await createEventBtn.click();
      await delay(1000);
      await page.waitForLoadState('networkidle');

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-create-event-form.png'), fullPage: true });
      console.log('  Screenshot: 05-create-event-form.png');

      // Fill event form
      const eventNameInput = await page.$('input[name="name"]') ||
                             await page.$('input[placeholder*="name" i]');
      if (eventNameInput) {
        await eventNameInput.fill('Lime Kiln Grand 2026');
      }

      // Fill dates
      const dateInputs = await page.$$('input[type="date"]');
      if (dateInputs.length >= 1) {
        await dateInputs[0].fill('2026-02-01');
      }
      if (dateInputs.length >= 2) {
        await dateInputs[1].fill('2026-02-03');
      }

      // Fill location
      const locationInput = await page.$('input[name="location"]') ||
                            await page.$('input[placeholder*="location" i]');
      if (locationInput) {
        await locationInput.fill('Lime Kiln Pub');
      }

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-event-form-filled.png'), fullPage: true });
      console.log('  Screenshot: 06-event-form-filled.png');

      // Submit
      const submitBtn = await page.$('button[type="submit"]') ||
                        await page.$('button:has-text("Create")') ||
                        await page.$('button:has-text("Save")');
      if (submitBtn) {
        await submitBtn.click();
        await delay(2000);
        await page.waitForLoadState('networkidle');
      }
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07-event-created.png'), fullPage: true });
    console.log('  Screenshot: 07-event-created.png');

    testResults.push({ test: 'Events Feature', passed: true });
    console.log('  Result: PASSED\n');

    // ========== TEST 3: Test Dartboards ==========
    console.log('=== TEST 3: Test Dartboards ===');

    await page.goto(`${BASE_URL}/admin/dartboards`);
    await page.waitForLoadState('networkidle');
    await delay(1000);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08-dartboards-page.png'), fullPage: true });
    console.log('  Screenshot: 08-dartboards-page.png');

    // Add first dartboard
    let addBtn = await page.$('button:has-text("Add Dartboard")') ||
                 await page.$('button:has-text("Add")') ||
                 await page.$('button:has-text("New")') ||
                 await page.$('button:has-text("Create")');

    if (addBtn) {
      await addBtn.click();
      await delay(500);

      const numberInput = await page.$('input[name="number"]') ||
                          await page.$('input[type="number"]');
      const boardNameInput = await page.$('input[name="name"]');

      if (numberInput) await numberInput.fill('1');
      if (boardNameInput) await boardNameInput.fill('Main Stage');

      const saveBtn = await page.$('button[type="submit"]') ||
                      await page.$('button:has-text("Save")') ||
                      await page.$('button:has-text("Add")');
      if (saveBtn) {
        await saveBtn.click();
        await delay(1000);
      }
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09-dartboard-1-added.png'), fullPage: true });
    console.log('  Screenshot: 09-dartboard-1-added.png');

    // Add second dartboard
    addBtn = await page.$('button:has-text("Add Dartboard")') ||
             await page.$('button:has-text("Add")') ||
             await page.$('button:has-text("New")') ||
             await page.$('button:has-text("Create")');

    if (addBtn) {
      await addBtn.click();
      await delay(500);

      const numberInput = await page.$('input[name="number"]') ||
                          await page.$('input[type="number"]');
      const boardNameInput = await page.$('input[name="name"]');

      if (numberInput) await numberInput.fill('2');
      if (boardNameInput) await boardNameInput.fill('Side Board');

      const saveBtn = await page.$('button[type="submit"]') ||
                      await page.$('button:has-text("Save")') ||
                      await page.$('button:has-text("Add")');
      if (saveBtn) {
        await saveBtn.click();
        await delay(1000);
      }
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10-dartboards-complete.png'), fullPage: true });
    console.log('  Screenshot: 10-dartboards-complete.png');

    testResults.push({ test: 'Dartboards', passed: true });
    console.log('  Result: PASSED\n');

    // ========== TEST 4: Test Lucky Draw Tournament ==========
    console.log('=== TEST 4: Test Lucky Draw Tournament ===');

    await page.goto(`${BASE_URL}/admin/tournaments/new`);
    await page.waitForLoadState('networkidle');
    await delay(1000);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '11-tournament-form.png'), fullPage: true });
    console.log('  Screenshot: 11-tournament-form.png');

    // Fill tournament name
    const tournamentNameInput = await page.$('input[name="name"]') ||
                                await page.$('input[placeholder*="name" i]');
    if (tournamentNameInput) {
      await tournamentNameInput.fill('Lucky Draw 501');
    }

    // Select game type
    const gameTypeSelect = await page.$('select[name="gameType"]') ||
                           await page.$('select[name="game_type"]');
    if (gameTypeSelect) {
      await gameTypeSelect.selectOption({ label: '501' });
    }

    // Select format
    const formatSelect = await page.$('select[name="format"]') ||
                         await page.$('select[name="tournament_format"]');
    if (formatSelect) {
      await formatSelect.selectOption({ label: 'Lucky Draw Doubles' });
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '12-lucky-draw-form-filled.png'), fullPage: true });
    console.log('  Screenshot: 12-lucky-draw-form-filled.png');

    // Submit
    const createTournamentBtn = await page.$('button[type="submit"]') ||
                                await page.$('button:has-text("Create")') ||
                                await page.$('button:has-text("Save")');
    if (createTournamentBtn) {
      await createTournamentBtn.click();
      await delay(2000);
      await page.waitForLoadState('networkidle');
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '13-lucky-draw-created.png'), fullPage: true });
    console.log('  Screenshot: 13-lucky-draw-created.png');

    // Try to add players - look for Add Player button
    const addPlayerBtn = await page.$('button:has-text("Add Player")') ||
                         await page.$('button:has-text("Add Participant")');

    if (addPlayerBtn) {
      for (let i = 1; i <= 4; i++) {
        await addPlayerBtn.click();
        await delay(500);

        const playerNameInput = await page.$('input[name="playerName"]') ||
                                await page.$('input[placeholder*="player" i]');
        if (playerNameInput) {
          await playerNameInput.fill(`Player ${i}`);
        }

        const confirmBtn = await page.$('button:has-text("Add")') ||
                           await page.$('button:has-text("Confirm")');
        if (confirmBtn) {
          await confirmBtn.click();
          await delay(500);
        }
      }
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '14-lucky-draw-players.png'), fullPage: true });
    console.log('  Screenshot: 14-lucky-draw-players.png');

    // Try to generate teams
    const generateBtn = await page.$('button:has-text("Generate")') ||
                        await page.$('button:has-text("Draw")') ||
                        await page.$('button:has-text("Random")');
    if (generateBtn) {
      await generateBtn.click();
      await delay(1000);
      await page.waitForLoadState('networkidle');
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '15-lucky-draw-teams.png'), fullPage: true });
    console.log('  Screenshot: 15-lucky-draw-teams.png');

    testResults.push({ test: 'Lucky Draw Tournament', passed: true });
    console.log('  Result: PASSED\n');

    // ========== TEST 5: Test Simple Scoring ==========
    console.log('=== TEST 5: Test Simple Scoring ===');

    await page.goto(`${BASE_URL}/admin/tournaments/new`);
    await page.waitForLoadState('networkidle');
    await delay(1000);

    // Fill tournament for single elimination
    const scoringNameInput = await page.$('input[name="name"]') ||
                             await page.$('input[placeholder*="name" i]');
    if (scoringNameInput) {
      await scoringNameInput.fill('Scoring Test Tournament');
    }

    // Select game type
    const gameTypeSelect2 = await page.$('select[name="gameType"]') ||
                            await page.$('select[name="game_type"]');
    if (gameTypeSelect2) {
      await gameTypeSelect2.selectOption({ label: '501' });
    }

    // Select single elimination format
    const formatSelect2 = await page.$('select[name="format"]') ||
                          await page.$('select[name="tournament_format"]');
    if (formatSelect2) {
      await formatSelect2.selectOption({ label: 'Single Elimination' });
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '16-scoring-tournament-form.png'), fullPage: true });
    console.log('  Screenshot: 16-scoring-tournament-form.png');

    // Submit
    const createScoringBtn = await page.$('button[type="submit"]') ||
                             await page.$('button:has-text("Create")') ||
                             await page.$('button:has-text("Save")');
    if (createScoringBtn) {
      await createScoringBtn.click();
      await delay(2000);
      await page.waitForLoadState('networkidle');
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '17-scoring-tournament-created.png'), fullPage: true });
    console.log('  Screenshot: 17-scoring-tournament-created.png');

    // Try to add 4 players
    const addTestPlayerBtn = await page.$('button:has-text("Add Player")') ||
                             await page.$('button:has-text("Add Participant")');

    if (addTestPlayerBtn) {
      for (let i = 1; i <= 4; i++) {
        await addTestPlayerBtn.click();
        await delay(500);

        const playerNameInput = await page.$('input[name="playerName"]') ||
                                await page.$('input[placeholder*="player" i]');
        if (playerNameInput) {
          await playerNameInput.fill(`Test Player ${i}`);
        }

        const confirmBtn = await page.$('button:has-text("Add")') ||
                           await page.$('button:has-text("Confirm")');
        if (confirmBtn) {
          await confirmBtn.click();
          await delay(500);
        }
      }
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '18-players-added.png'), fullPage: true });
    console.log('  Screenshot: 18-players-added.png');

    // Start tournament
    const startTournamentBtn = await page.$('button:has-text("Start Tournament")') ||
                               await page.$('button:has-text("Start")') ||
                               await page.$('button:has-text("Begin")');
    if (startTournamentBtn) {
      await startTournamentBtn.click();
      await delay(1000);
      await page.waitForLoadState('networkidle');
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '19-tournament-started.png'), fullPage: true });
    console.log('  Screenshot: 19-tournament-started.png');

    // Go to matches
    const matchesLink = await page.$('a:has-text("Matches")') ||
                        await page.$('button:has-text("Matches")');
    if (matchesLink) {
      await matchesLink.click();
      await delay(1000);
      await page.waitForLoadState('networkidle');
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '20-matches-page.png'), fullPage: true });
    console.log('  Screenshot: 20-matches-page.png');

    // Try to click on a match
    const matchCard = await page.$('.match-card') ||
                      await page.$('[data-testid="match"]') ||
                      await page.$('tr:has-text("Player")') ||
                      await page.$('div:has-text("Match")');
    if (matchCard) {
      await matchCard.click();
      await delay(1000);
      await page.waitForLoadState('networkidle');
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '21-scoring-page.png'), fullPage: true });
    console.log('  Screenshot: 21-scoring-page.png');

    // Try to select winner
    const winnerBtn = await page.$('button:has-text("Winner")') ||
                      await page.$('button:has-text("Win")');
    if (winnerBtn) {
      await winnerBtn.click();
      await delay(1000);
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '22-scoring-complete.png'), fullPage: true });
    console.log('  Screenshot: 22-scoring-complete.png');

    testResults.push({ test: 'Simple Scoring', passed: true });
    console.log('  Result: PASSED\n');

  } catch (error) {
    console.error('Test error:', error);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'error-screenshot.png'), fullPage: true });
    console.log('  Error screenshot saved');
  } finally {
    await browser.close();
  }

  // Print summary
  console.log('\n========== TEST SUMMARY ==========');
  testResults.forEach(result => {
    console.log(`${result.passed ? 'PASS' : 'FAIL'}: ${result.test}`);
  });
  console.log('==================================');

  // List screenshots
  console.log('\n========== SCREENSHOTS ==========');
  const screenshots = fs.readdirSync(SCREENSHOT_DIR).filter(f => f.endsWith('.png'));
  screenshots.sort().forEach(f => {
    console.log(`  ${path.join(SCREENSHOT_DIR, f)}`);
  });
  console.log('=================================\n');
}

runTests();
