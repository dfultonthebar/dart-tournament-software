import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3001';
const SCREENSHOT_DIR = '/home/darts-admin/DartTournament/test-screenshots/scoring';

test.describe('Simple Scoring Feature Test', () => {
  test('Complete scoring workflow', async ({ page }) => {
    // Increase timeout for this comprehensive test
    test.setTimeout(120000);

    // Step 1: Go to admin login page
    console.log('Step 1: Navigating to admin login page...');
    await page.goto(`${BASE_URL}/admin/login`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-login-page.png`, fullPage: true });
    console.log('Screenshot: 01-login-page.png');

    // Step 2: Login with Admin credentials
    console.log('Step 2: Logging in as Admin...');
    // PIN mode login: wait for auth context to finish loading and form to appear
    await page.waitForSelector('form', { timeout: 10000 });
    await page.waitForTimeout(500);  // Extra wait for React hydration

    // Fill name field — first text input in the form
    const nameInput = page.locator('form input[type="text"]').first();
    await nameInput.waitFor({ state: 'visible', timeout: 5000 });
    await nameInput.click();
    await nameInput.fill('Admin');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-name-entered.png`, fullPage: true });

    // Fill PIN field — second input in the form
    const pinInput = page.locator('form input[type="text"]').nth(1);
    await pinInput.click();
    await pinInput.fill('1972');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-credentials-entered.png`, fullPage: true });

    // Submit login
    await page.locator('button[type="submit"]').click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-after-login.png`, fullPage: true });
    console.log('Screenshot: 04-after-login.png');

    // Select Darts sport if on sport selection page
    const dartsLink = page.locator('a[href*="darts"]').first();
    if (await dartsLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dartsLink.click();
      await page.waitForLoadState('networkidle');
    }

    // Step 3: Go to create new tournament page
    console.log('Step 3: Navigating to create tournament page...');
    await page.goto(`${BASE_URL}/admin/tournaments/new`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/05-new-tournament-page.png`, fullPage: true });
    console.log('Screenshot: 05-new-tournament-page.png');

    // Step 4: Create tournament with specified settings
    console.log('Step 4: Creating tournament...');

    // Tournament form uses React controlled inputs without name/id attributes
    // First select is Event dropdown (required), then text input for name
    await page.waitForTimeout(1000);

    // Select an event first (required field — first select in the form)
    const eventSelect = page.locator('form select').first();
    if (await eventSelect.isVisible()) {
      const options = await eventSelect.locator('option').allTextContents();
      console.log('Available event options:', options);
      // Select the first non-placeholder option
      if (options.length > 1) {
        await eventSelect.selectOption({ index: 1 });
      }
    }

    // Fill tournament name — first text input in the form
    const tournamentNameInput = page.locator('form input[type="text"]').first();
    await tournamentNameInput.click();
    await tournamentNameInput.fill('Scoring Test Tournament');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/06-tournament-name.png`, fullPage: true });

    // Game Type select is the second select in the form (501 is already default)
    const gameTypeSelect = page.locator('form select').nth(1);
    if (await gameTypeSelect.isVisible()) {
      await gameTypeSelect.selectOption({ label: '501' });
    }
    await page.screenshot({ path: `${SCREENSHOT_DIR}/07-game-type-selected.png`, fullPage: true });

    // Format select is the third select in the form (Single Elimination is already default)
    const formatSelect = page.locator('form select').nth(2);
    if (await formatSelect.isVisible()) {
      await formatSelect.selectOption({ label: 'Single Elimination' });
    }
    await page.screenshot({ path: `${SCREENSHOT_DIR}/08-format-selected.png`, fullPage: true });

    // Submit tournament creation
    await page.click('button:has-text("Create Tournament"), button[type="submit"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/09-tournament-created.png`, fullPage: true });
    console.log('Screenshot: 09-tournament-created.png');

    // Get the tournament ID from URL or page content
    const currentUrl = page.url();
    console.log(`Current URL after tournament creation: ${currentUrl}`);

    // Extract tournament ID from URL
    const tournamentIdMatch = currentUrl.match(/tournaments\/(\d+)/);
    const tournamentId = tournamentIdMatch ? tournamentIdMatch[1] : null;
    console.log(`Tournament ID: ${tournamentId}`);

    // Step 5: Add 4 players to the tournament
    console.log('Step 5: Adding 4 players to the tournament...');

    // Look for add player button or section
    const addPlayerButton = page.locator('button:has-text("Add Player"), button:has-text("Add Participant"), [data-testid*="add-player"]').first();

    for (let i = 1; i <= 4; i++) {
      // Try to add a player
      if (await addPlayerButton.isVisible()) {
        await addPlayerButton.click();
        await page.waitForTimeout(500);
      }

      // Check for player selection modal/dropdown
      const playerOption = page.locator(`text=Player ${i}, [data-player-id], .player-option, .player-item`).first();
      if (await playerOption.isVisible()) {
        await playerOption.click();
      } else {
        // Try searching for player or entering player name
        const searchInput = page.locator('input[placeholder*="search" i], input[placeholder*="player" i]').first();
        if (await searchInput.isVisible()) {
          await searchInput.fill(`Player ${i}`);
          await page.waitForTimeout(500);
          await page.keyboard.press('Enter');
        }
      }

      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/10-player-${i}-added.png`, fullPage: true });
    }
    console.log('Screenshot: 10-players-added.png');

    // Step 6: Mark all players as paid
    console.log('Step 6: Marking all players as paid...');

    // Look for payment/paid checkboxes or buttons
    const paidCheckboxes = await page.locator('input[type="checkbox"][name*="paid" i], input[type="checkbox"][id*="paid" i], .paid-checkbox').all();
    for (const checkbox of paidCheckboxes) {
      if (!(await checkbox.isChecked())) {
        await checkbox.click();
      }
    }

    // Alternative: Look for "Mark Paid" buttons
    const markPaidButtons = await page.locator('button:has-text("Mark Paid"), button:has-text("Mark as Paid")').all();
    for (const button of markPaidButtons) {
      await button.click();
      await page.waitForTimeout(300);
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/11-players-paid.png`, fullPage: true });
    console.log('Screenshot: 11-players-paid.png');

    // Step 7: Start the tournament
    console.log('Step 7: Starting the tournament...');

    const startButton = page.locator('button:has-text("Start Tournament"), button:has-text("Start"), button:has-text("Begin")').first();
    if (await startButton.isVisible()) {
      await startButton.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    }
    await page.screenshot({ path: `${SCREENSHOT_DIR}/12-tournament-started.png`, fullPage: true });
    console.log('Screenshot: 12-tournament-started.png');

    // Step 8: Go to matches page
    console.log('Step 8: Navigating to matches page...');
    await page.goto(`${BASE_URL}/matches`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/13-matches-page.png`, fullPage: true });
    console.log('Screenshot: 13-matches-page.png');

    // Step 9: Find an active match
    console.log('Step 9: Finding an active match...');

    // Look for active/pending match
    const activeMatch = page.locator('.match-card:has-text("Active"), .match-card:has-text("Pending"), .match-item, [data-match-status="active"], [data-match-status="pending"], tr:has-text("Active"), tr:has-text("Pending")').first();
    await page.screenshot({ path: `${SCREENSHOT_DIR}/14-active-match-found.png`, fullPage: true });
    console.log('Screenshot: 14-active-match-found.png');

    // Step 10: Click to score the match
    console.log('Step 10: Clicking to score the match...');

    // Look for score button or click on the match
    const scoreButton = page.locator('button:has-text("Score"), button:has-text("Enter Score"), a:has-text("Score"), .score-button').first();
    if (await scoreButton.isVisible()) {
      await scoreButton.click();
    } else if (await activeMatch.isVisible()) {
      await activeMatch.click();
    }

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/15-score-page.png`, fullPage: true });
    console.log(`Screenshot: 15-score-page.png - Current URL: ${page.url()}`);

    // Step 11: On the score page, click on one player to select them as winner
    console.log('Step 11: Selecting a winner...');

    // Look for player selection buttons/cards
    const playerCard = page.locator('.player-card, .player-button, button:has-text("Player"), [data-player], .contestant').first();
    if (await playerCard.isVisible()) {
      await playerCard.click();
    } else {
      // Try clicking on a player name or winner selection
      const winnerOption = page.locator('button:has-text("Win"), .winner-select, [data-winner], input[name*="winner"]').first();
      if (await winnerOption.isVisible()) {
        await winnerOption.click();
      }
    }

    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/16-winner-selected.png`, fullPage: true });
    console.log('Screenshot: 16-winner-selected.png');

    // Step 12: Confirm the selection
    console.log('Step 12: Confirming the selection...');

    const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Submit"), button:has-text("Save"), button:has-text("OK"), button[type="submit"]').first();
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    }
    await page.screenshot({ path: `${SCREENSHOT_DIR}/17-winner-confirmed.png`, fullPage: true });
    console.log('Screenshot: 17-winner-confirmed.png');

    // Step 13: Verify the winner advances
    console.log('Step 13: Verifying winner advances...');

    // Go back to matches or tournament bracket to verify
    await page.goto(`${BASE_URL}/matches`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/18-matches-after-score.png`, fullPage: true });
    console.log('Screenshot: 18-matches-after-score.png');

    // Check tournament bracket if available
    if (tournamentId) {
      await page.goto(`${BASE_URL}/admin/tournaments/${tournamentId}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/19-tournament-bracket.png`, fullPage: true });
      console.log('Screenshot: 19-tournament-bracket.png');
    }

    // Final verification
    await page.screenshot({ path: `${SCREENSHOT_DIR}/20-final-state.png`, fullPage: true });
    console.log('Screenshot: 20-final-state.png');

    console.log('Simple Scoring Feature Test completed!');
    console.log(`All screenshots saved to: ${SCREENSHOT_DIR}`);
  });
});
