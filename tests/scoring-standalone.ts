import { chromium, Browser, Page } from 'playwright';

const BASE_URL = 'http://localhost:3001';
const SCREENSHOT_DIR = '/home/darts-admin/DartTournament/test-screenshots/scoring';

async function runScoringTest() {
  console.log('Starting Simple Scoring Feature Test...\n');
  console.log('=' .repeat(60));

  let browser: Browser | null = null;
  let page: Page | null = null;
  let tournamentId: string | null = null;

  try {
    // Launch browser
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    page = await context.newPage();

    // Step 1: Go to admin login page
    console.log('\nStep 1: Navigating to admin login page...');
    await page.goto(`${BASE_URL}/admin/login`);

    // Wait for the page to fully load - wait for "Admin Login" heading
    await page.waitForSelector('h1:has-text("Admin Login")', { timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-login-page.png`, fullPage: true });
    console.log('  Screenshot: 01-login-page.png');
    console.log('  SUCCESS: Login page loaded');

    // Step 2: Login with Admin credentials
    console.log('\nStep 2: Logging in as Admin...');

    // Fill the Name input
    const nameInput = page.locator('input[type="text"]').first();
    await nameInput.fill('Admin');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-name-entered.png`, fullPage: true });
    console.log('  Entered name: Admin');

    // Fill the PIN input (single input with inputmode="numeric")
    const pinInput = page.locator('input[inputmode="numeric"]').first();
    await pinInput.fill('1972');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-credentials-entered.png`, fullPage: true });
    console.log('  Entered PIN: 1972');

    // Click the Login button
    const loginButton = page.locator('button[type="submit"]:has-text("Login")');
    await loginButton.click();

    // Wait for navigation to admin page
    await page.waitForURL('**/admin', { timeout: 10000 });
    await page.waitForSelector('h1', { timeout: 5000 });
    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-after-login.png`, fullPage: true });
    console.log('  Screenshot: 04-after-login.png');
    console.log(`  SUCCESS: Logged in, now at: ${page.url()}`);

    // Step 3: Go to create new tournament page
    console.log('\nStep 3: Navigating to create tournament page...');
    await page.goto(`${BASE_URL}/admin/tournaments/new`);

    // Wait for the Create Tournament heading
    await page.waitForSelector('h1:has-text("Create Tournament")', { timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOT_DIR}/05-new-tournament-page.png`, fullPage: true });
    console.log('  Screenshot: 05-new-tournament-page.png');
    console.log('  SUCCESS: Create Tournament page loaded');

    // Step 4: Create tournament with specified settings
    console.log('\nStep 4: Creating tournament...');

    // Fill tournament name
    const tournamentNameInput = page.locator('input[type="text"]').first();
    await tournamentNameInput.fill('Scoring Test Tournament');
    console.log('  Filled tournament name: Scoring Test Tournament');

    // Game Type select - first select element
    const gameTypeSelect = page.locator('select').first();
    await gameTypeSelect.selectOption('501');
    console.log('  Selected game type: 501');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/06-game-type-selected.png`, fullPage: true });

    // Format select - second select element
    const formatSelect = page.locator('select').nth(1);
    await formatSelect.selectOption('single_elimination');
    console.log('  Selected format: Single Elimination');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/07-form-filled.png`, fullPage: true });

    // Submit tournament creation
    const createButton = page.locator('button[type="submit"]:has-text("Create Tournament")');
    await createButton.click();

    // Wait for redirect to tournament detail page
    await page.waitForURL('**/admin/tournaments/**', { timeout: 10000 });
    await page.waitForTimeout(2000);

    // Get tournament ID from URL
    const currentUrl = page.url();
    const urlMatch = currentUrl.match(/tournaments\/([a-f0-9-]+)/);
    tournamentId = urlMatch ? urlMatch[1] : null;

    await page.screenshot({ path: `${SCREENSHOT_DIR}/08-tournament-created.png`, fullPage: true });
    console.log('  Screenshot: 08-tournament-created.png');
    console.log(`  SUCCESS: Tournament created, ID: ${tournamentId}`);
    console.log(`  Current URL: ${currentUrl}`);

    // Step 5: Add 4 players to the tournament
    console.log('\nStep 5: Adding 4 players to the tournament...');

    // Wait for the player section to be visible
    await page.waitForSelector('h2:has-text("Players")', { timeout: 10000 });

    // Check if there's a player dropdown
    const playerSelect = page.locator('select:has(option:has-text("Select a player"))').first();

    for (let i = 1; i <= 4; i++) {
      console.log(`  Adding player ${i}...`);

      await page.waitForTimeout(500);
      await playerSelect.waitFor({ state: 'visible', timeout: 5000 });
      const options = await playerSelect.locator('option').allTextContents();
      console.log(`    Available players: ${options.slice(1).join(', ')}`);

      if (options.length > 1) {
        await playerSelect.selectOption({ index: 1 });
        console.log(`    Selected: ${options[1]}`);

        const addButton = page.locator('button:has-text("Add")').first();
        await addButton.click();
        await page.waitForTimeout(1000);
      } else {
        console.log(`    No more available players`);
        break;
      }
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/09-players-added.png`, fullPage: true });
    console.log('  Screenshot: 09-players-added.png');

    // Step 6: Mark all players as paid
    console.log('\nStep 6: Marking all players as paid...');

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    let unpaidCheckboxes = page.locator('input[type="checkbox"]:not(:checked)');
    let unpaidCount = await unpaidCheckboxes.count();
    console.log(`  Found ${unpaidCount} unpaid players`);

    for (let i = 0; i < unpaidCount; i++) {
      await unpaidCheckboxes.nth(0).click();
      await page.waitForTimeout(500);
      unpaidCheckboxes = page.locator('input[type="checkbox"]:not(:checked)');
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/10-players-paid.png`, fullPage: true });
    console.log('  Screenshot: 10-players-paid.png');
    console.log('  SUCCESS: All players marked as paid');

    // Step 7a: Open Registration
    console.log('\nStep 7a: Opening registration...');

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const openRegButton = page.locator('button:has-text("Open Registration")');
    if (await openRegButton.isVisible()) {
      await openRegButton.click();
      await page.waitForTimeout(3000);
      console.log('  Clicked Open Registration button');
      await page.screenshot({ path: `${SCREENSHOT_DIR}/11a-registration-opened.png`, fullPage: true });
    } else {
      console.log('  Open Registration button not visible (may already be open)');
    }

    // Step 7b: Start the tournament
    console.log('\nStep 7b: Starting the tournament...');

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const startButton = page.locator('button:has-text("Start Tournament")');
    if (await startButton.isVisible()) {
      console.log('  Start Tournament button found');
      await startButton.click();
      await page.waitForTimeout(5000);
      console.log('  Clicked Start Tournament button');
    } else {
      console.log('  Start button not visible');
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/11-tournament-started.png`, fullPage: true });
    console.log('  Screenshot: 11-tournament-started.png');

    // Check if tournament is now IN_PROGRESS
    const statusBadge = await page.locator('span:has-text("IN_PROGRESS")').count();
    console.log(`  Tournament IN_PROGRESS: ${statusBadge > 0 ? 'YES' : 'NO'}`);

    // Step 8: Go to matches page via "Go to Scoring" link
    console.log('\nStep 8: Navigating to matches page...');

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Wait for and click the "Go to Scoring" link
    const scoringLink = page.locator('a:has-text("Go to Scoring")');

    // Wait for the link to be visible with explicit wait
    try {
      await scoringLink.waitFor({ state: 'visible', timeout: 10000 });
      console.log('  Found "Go to Scoring" link');
      await page.screenshot({ path: `${SCREENSHOT_DIR}/12-before-scoring-click.png`, fullPage: true });

      await scoringLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      console.log('  Clicked "Go to Scoring" link');
    } catch (e) {
      console.log('  "Go to Scoring" link not found or not visible');
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/12-matches-page.png`, fullPage: true });
    console.log('  Screenshot: 12-matches-page.png');
    console.log(`  Current URL: ${page.url()}`);

    // Step 9: Find an active match
    console.log('\nStep 9: Finding an active match...');

    await page.waitForTimeout(2000);

    // Wait for matches grid to load
    await page.waitForSelector('.grid', { timeout: 5000 }).catch(() => {
      console.log('  No grid found');
    });

    // Count actual match cards (those with score buttons)
    const scoreButtons = page.locator('a:has-text("Start Scoring"), a:has-text("Continue Scoring")');
    const matchCount = await scoreButtons.count();
    console.log(`  Found ${matchCount} matches with scoring buttons`);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/13-match-found.png`, fullPage: true });
    console.log('  Screenshot: 13-match-found.png');

    // Step 10: Click to score the match
    console.log('\nStep 10: Clicking to score the match...');

    if (matchCount > 0) {
      await scoreButtons.first().click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      console.log('  Clicked first scoring button');
    } else {
      console.log('  No scoring buttons found');
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/14-score-page.png`, fullPage: true });
    console.log('  Screenshot: 14-score-page.png');
    console.log(`  Current URL: ${page.url()}`);

    // Step 11: On the score page, click on one player to select them as winner
    console.log('\nStep 11: Selecting a winner...');

    await page.waitForTimeout(2000);

    // Wait for score page to load - look for the instruction text
    const instructionText = page.locator('h2:has-text("Tap the winner")');
    const hasInstructions = await instructionText.isVisible().catch(() => false);
    console.log(`  Score page instruction visible: ${hasInstructions}`);

    // Find player selection buttons on score page
    const playerButtons = page.locator('button').filter({
      has: page.locator('div:has-text("Tap to select as winner")')
    });
    let playerButtonCount = await playerButtons.count();
    console.log(`  Found ${playerButtonCount} player selection buttons`);

    if (playerButtonCount > 0) {
      const firstPlayerButton = playerButtons.first();
      const playerName = await firstPlayerButton.locator('div.text-3xl, div.text-4xl').first().textContent();
      console.log(`  Selecting player: ${playerName}`);
      await firstPlayerButton.click();
      await page.waitForTimeout(1000);
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/15-winner-selected.png`, fullPage: true });
    console.log('  Screenshot: 15-winner-selected.png');

    // Step 12: Confirm the selection
    console.log('\nStep 12: Confirming the selection...');

    await page.waitForTimeout(1000);

    // Look for confirmation modal
    const confirmModal = page.locator('div.fixed.inset-0.bg-black');
    const modalVisible = await confirmModal.isVisible().catch(() => false);
    console.log(`  Confirmation modal visible: ${modalVisible}`);

    if (modalVisible) {
      const winnerName = await page.locator('div.text-3xl.font-bold.text-green-400').textContent().catch(() => 'Unknown');
      console.log(`  Confirming winner: ${winnerName}`);

      const confirmButton = page.locator('button:has-text("Confirm")');
      await confirmButton.click();
      await page.waitForTimeout(3000);
      console.log('  Winner confirmed!');
    } else {
      console.log('  No confirmation modal found');
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/16-winner-confirmed.png`, fullPage: true });
    console.log('  Screenshot: 16-winner-confirmed.png');
    console.log(`  Current URL: ${page.url()}`);

    // Step 13: Verify the winner advances
    console.log('\nStep 13: Verifying winner advances...');

    await page.waitForTimeout(2000);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/17-matches-after-score.png`, fullPage: true });
    console.log('  Screenshot: 17-matches-after-score.png');

    // Check for completed matches
    const completedBadge = page.locator('span:has-text("COMPLETED")');
    const completedCount = await completedBadge.count();
    console.log(`  Completed matches: ${completedCount}`);

    // Go back to tournament detail
    if (tournamentId) {
      await page.goto(`${BASE_URL}/admin/tournaments/${tournamentId}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/18-tournament-bracket.png`, fullPage: true });
      console.log('  Screenshot: 18-tournament-bracket.png');
    }

    // Final screenshot
    await page.screenshot({ path: `${SCREENSHOT_DIR}/19-final-state.png`, fullPage: true });
    console.log('  Screenshot: 19-final-state.png');

    console.log('\n' + '=' .repeat(60));
    console.log('SIMPLE SCORING FEATURE TEST COMPLETED!');
    console.log('=' .repeat(60));
    console.log(`\nAll screenshots saved to: ${SCREENSHOT_DIR}`);

    // Summary
    console.log('\nTest Summary:');
    console.log(`  - Tournament ID: ${tournamentId}`);
    console.log(`  - Tournament Started: ${statusBadge > 0 ? 'YES' : 'NO'}`);
    console.log(`  - Matches with scoring: ${matchCount}`);
    console.log(`  - Completed matches: ${completedCount}`);
    console.log(`  - Winner selection modal shown: ${modalVisible ? 'YES' : 'NO'}`);

  } catch (error) {
    console.error('\n' + '=' .repeat(60));
    console.error('TEST FAILED WITH ERROR:');
    console.error('=' .repeat(60));
    console.error(error);

    if (page) {
      await page.screenshot({ path: `${SCREENSHOT_DIR}/error-state.png`, fullPage: true });
      console.log('\nError screenshot saved: error-state.png');
      console.log(`Current URL at error: ${page.url()}`);
    }

    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

runScoringTest();
