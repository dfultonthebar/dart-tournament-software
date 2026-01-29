import { test, expect, Page } from '@playwright/test';

const SCREENSHOT_DIR = '/home/darts-admin/DartTournament/test-screenshots';

test.describe('Dart Tournament System E2E Tests', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('1. Login as Admin', async () => {
    // Navigate to admin login
    await page.goto('http://localhost:3001/admin/login');
    await page.waitForLoadState('networkidle');

    // Take screenshot of login page
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-login-page.png`, fullPage: true });

    // Fill in credentials
    await page.fill('input[name="name"], input[placeholder*="name" i], input[type="text"]', 'Admin');
    await page.fill('input[name="pin"], input[placeholder*="pin" i], input[type="password"]', '1972');

    // Take screenshot before clicking login
    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-login-filled.png`, fullPage: true });

    // Click login button
    await page.click('button[type="submit"], button:has-text("Login")');

    // Wait for redirect to admin dashboard
    await page.waitForURL('**/admin', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Verify we're on admin dashboard
    expect(page.url()).toContain('/admin');

    // Take screenshot of admin dashboard
    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-admin-dashboard.png`, fullPage: true });

    console.log('Login successful - Admin dashboard loaded');
  });

  test('2. Test Events Feature', async () => {
    // Navigate to admin if not already there
    await page.goto('http://localhost:3001/admin');
    await page.waitForLoadState('networkidle');

    // Click on Events card (orange)
    const eventsCard = page.locator('a[href*="events"], div:has-text("Events")').first();
    await eventsCard.click();
    await page.waitForLoadState('networkidle');

    // Take screenshot of events page
    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-events-page.png`, fullPage: true });

    // Click Create Event button
    const createEventBtn = page.locator('button:has-text("Create Event"), a:has-text("Create Event"), button:has-text("New Event"), a:has-text("New Event")').first();
    await createEventBtn.click();
    await page.waitForLoadState('networkidle');

    // Take screenshot of create event form
    await page.screenshot({ path: `${SCREENSHOT_DIR}/05-create-event-form.png`, fullPage: true });

    // Fill in event details
    await page.fill('input[name="name"], input[placeholder*="name" i]', 'Lime Kiln Grand 2026');

    // Fill dates - try different selectors
    const startDateInput = page.locator('input[name="startDate"], input[name="start_date"], input[type="date"]').first();
    await startDateInput.fill('2026-02-01');

    const endDateInput = page.locator('input[name="endDate"], input[name="end_date"], input[type="date"]').nth(1);
    if (await endDateInput.isVisible()) {
      await endDateInput.fill('2026-02-03');
    }

    // Fill location
    const locationInput = page.locator('input[name="location"], input[placeholder*="location" i]');
    if (await locationInput.isVisible()) {
      await locationInput.fill('Lime Kiln Pub');
    }

    // Take screenshot before submit
    await page.screenshot({ path: `${SCREENSHOT_DIR}/06-event-form-filled.png`, fullPage: true });

    // Submit the form
    await page.click('button[type="submit"], button:has-text("Create"), button:has-text("Save")');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Take screenshot after event creation
    await page.screenshot({ path: `${SCREENSHOT_DIR}/07-event-created.png`, fullPage: true });

    console.log('Event creation test completed');
  });

  test('3. Test Dartboards', async () => {
    // Navigate to dartboards page
    await page.goto('http://localhost:3001/admin/dartboards');
    await page.waitForLoadState('networkidle');

    // Take screenshot of dartboards page
    await page.screenshot({ path: `${SCREENSHOT_DIR}/08-dartboards-page.png`, fullPage: true });

    // Add first dartboard
    const addBtn = page.locator('button:has-text("Add"), button:has-text("Create"), button:has-text("New")').first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForLoadState('networkidle');

      // Fill dartboard details
      const numberInput = page.locator('input[name="number"], input[placeholder*="number" i], input[type="number"]').first();
      if (await numberInput.isVisible()) {
        await numberInput.fill('1');
      }

      const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
      if (await nameInput.isVisible()) {
        await nameInput.fill('Main Stage');
      }

      // Submit
      await page.click('button[type="submit"], button:has-text("Save"), button:has-text("Add")');
      await page.waitForTimeout(500);
    }

    // Take screenshot after adding first dartboard
    await page.screenshot({ path: `${SCREENSHOT_DIR}/09-dartboard-1-added.png`, fullPage: true });

    // Add second dartboard
    const addBtn2 = page.locator('button:has-text("Add"), button:has-text("Create"), button:has-text("New")').first();
    if (await addBtn2.isVisible()) {
      await addBtn2.click();
      await page.waitForLoadState('networkidle');

      const numberInput = page.locator('input[name="number"], input[placeholder*="number" i], input[type="number"]').first();
      if (await numberInput.isVisible()) {
        await numberInput.fill('2');
      }

      const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
      if (await nameInput.isVisible()) {
        await nameInput.fill('Side Board');
      }

      await page.click('button[type="submit"], button:has-text("Save"), button:has-text("Add")');
      await page.waitForTimeout(500);
    }

    // Take screenshot after adding both dartboards
    await page.screenshot({ path: `${SCREENSHOT_DIR}/10-dartboards-complete.png`, fullPage: true });

    console.log('Dartboards test completed');
  });

  test('4. Test Lucky Draw Tournament', async () => {
    // Navigate to create new tournament
    await page.goto('http://localhost:3001/admin/tournaments/new');
    await page.waitForLoadState('networkidle');

    // Take screenshot of tournament creation form
    await page.screenshot({ path: `${SCREENSHOT_DIR}/11-tournament-form.png`, fullPage: true });

    // Fill tournament details
    const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
    await nameInput.fill('Lucky Draw 501');

    // Select game type - 501
    const gameTypeSelect = page.locator('select[name="gameType"], select[name="game_type"]').first();
    if (await gameTypeSelect.isVisible()) {
      await gameTypeSelect.selectOption({ label: '501' });
    }

    // Select format - Lucky Draw Doubles
    const formatSelect = page.locator('select[name="format"], select[name="tournament_format"]').first();
    if (await formatSelect.isVisible()) {
      await formatSelect.selectOption({ label: 'Lucky Draw Doubles' });
    }

    // Take screenshot of filled form
    await page.screenshot({ path: `${SCREENSHOT_DIR}/12-lucky-draw-form-filled.png`, fullPage: true });

    // Submit
    await page.click('button[type="submit"], button:has-text("Create"), button:has-text("Save")');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Take screenshot after creation
    await page.screenshot({ path: `${SCREENSHOT_DIR}/13-lucky-draw-created.png`, fullPage: true });

    // Try to add players
    const addPlayerBtn = page.locator('button:has-text("Add Player"), button:has-text("Add Participant")').first();
    if (await addPlayerBtn.isVisible()) {
      // Add 4 players
      for (let i = 1; i <= 4; i++) {
        await addPlayerBtn.click();
        await page.waitForTimeout(300);

        const playerNameInput = page.locator('input[name="playerName"], input[placeholder*="player" i]').first();
        if (await playerNameInput.isVisible()) {
          await playerNameInput.fill(`Player ${i}`);
        }

        const confirmBtn = page.locator('button:has-text("Add"), button:has-text("Confirm")').first();
        if (await confirmBtn.isVisible()) {
          await confirmBtn.click();
        }
        await page.waitForTimeout(300);
      }
    }

    // Take screenshot with players
    await page.screenshot({ path: `${SCREENSHOT_DIR}/14-lucky-draw-players.png`, fullPage: true });

    // Try to generate teams
    const generateBtn = page.locator('button:has-text("Generate"), button:has-text("Draw"), button:has-text("Random")').first();
    if (await generateBtn.isVisible()) {
      await generateBtn.click();
      await page.waitForLoadState('networkidle');
    }

    // Take screenshot of teams
    await page.screenshot({ path: `${SCREENSHOT_DIR}/15-lucky-draw-teams.png`, fullPage: true });

    console.log('Lucky Draw tournament test completed');
  });

  test('5. Test Simple Scoring', async () => {
    // Navigate to create new tournament
    await page.goto('http://localhost:3001/admin/tournaments/new');
    await page.waitForLoadState('networkidle');

    // Fill tournament details for single elimination
    const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
    await nameInput.fill('Scoring Test Tournament');

    // Select game type - 501
    const gameTypeSelect = page.locator('select[name="gameType"], select[name="game_type"]').first();
    if (await gameTypeSelect.isVisible()) {
      await gameTypeSelect.selectOption({ label: '501' });
    }

    // Select format - Single Elimination
    const formatSelect = page.locator('select[name="format"], select[name="tournament_format"]').first();
    if (await formatSelect.isVisible()) {
      await formatSelect.selectOption({ label: 'Single Elimination' });
    }

    // Take screenshot
    await page.screenshot({ path: `${SCREENSHOT_DIR}/16-scoring-tournament-form.png`, fullPage: true });

    // Submit
    await page.click('button[type="submit"], button:has-text("Create"), button:has-text("Save")');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Take screenshot after creation
    await page.screenshot({ path: `${SCREENSHOT_DIR}/17-scoring-tournament-created.png`, fullPage: true });

    // Add players if possible
    const addPlayerBtn = page.locator('button:has-text("Add Player"), button:has-text("Add Participant")').first();
    if (await addPlayerBtn.isVisible()) {
      for (let i = 1; i <= 4; i++) {
        await addPlayerBtn.click();
        await page.waitForTimeout(300);

        const playerNameInput = page.locator('input[name="playerName"], input[placeholder*="player" i]').first();
        if (await playerNameInput.isVisible()) {
          await playerNameInput.fill(`Test Player ${i}`);
        }

        const confirmBtn = page.locator('button:has-text("Add"), button:has-text("Confirm")').first();
        if (await confirmBtn.isVisible()) {
          await confirmBtn.click();
        }
        await page.waitForTimeout(300);
      }
    }

    // Start tournament
    const startBtn = page.locator('button:has-text("Start"), button:has-text("Begin")').first();
    if (await startBtn.isVisible()) {
      await startBtn.click();
      await page.waitForLoadState('networkidle');
    }

    // Take screenshot
    await page.screenshot({ path: `${SCREENSHOT_DIR}/18-tournament-started.png`, fullPage: true });

    // Go to matches page
    const matchesLink = page.locator('a:has-text("Matches"), button:has-text("Matches")').first();
    if (await matchesLink.isVisible()) {
      await matchesLink.click();
      await page.waitForLoadState('networkidle');
    }

    // Take screenshot of matches
    await page.screenshot({ path: `${SCREENSHOT_DIR}/19-matches-page.png`, fullPage: true });

    // Try to assign dartboard to a match
    const assignBoardBtn = page.locator('button:has-text("Assign"), select[name="dartboard"]').first();
    if (await assignBoardBtn.isVisible()) {
      await assignBoardBtn.click();
    }

    // Take screenshot
    await page.screenshot({ path: `${SCREENSHOT_DIR}/20-dartboard-assigned.png`, fullPage: true });

    // Click on a match to score
    const matchCard = page.locator('.match-card, [data-testid="match"], tr:has-text("Player")').first();
    if (await matchCard.isVisible()) {
      await matchCard.click();
      await page.waitForLoadState('networkidle');
    }

    // Take screenshot of scoring page
    await page.screenshot({ path: `${SCREENSHOT_DIR}/21-scoring-page.png`, fullPage: true });

    // Try to select a winner
    const winnerBtn = page.locator('button:has-text("Winner"), button:has-text("Win")').first();
    if (await winnerBtn.isVisible()) {
      await winnerBtn.click();
      await page.waitForLoadState('networkidle');
    }

    // Take final screenshot
    await page.screenshot({ path: `${SCREENSHOT_DIR}/22-scoring-complete.png`, fullPage: true });

    console.log('Scoring test completed');
  });
});
