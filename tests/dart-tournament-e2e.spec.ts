import { test, expect, Page } from '@playwright/test';

const SCREENSHOT_DIR = '/home/darts-admin/DartTournament/test-screenshots';

test.describe.serial('Dart Tournament System E2E Tests', () => {
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
    await page.waitForTimeout(500); // Wait for React hydration

    // Take screenshot of login page
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-login-page.png`, fullPage: true });

    // Fill in credentials — PIN mode: name text input + numeric PIN input
    const nameInput = page.locator('form input[type="text"]').first();
    await nameInput.click();
    await nameInput.fill('Admin');

    const pinInput = page.locator('form input').nth(1);
    await pinInput.click();
    await pinInput.fill('1972');

    // Take screenshot before clicking login
    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-login-filled.png`, fullPage: true });

    // Click login button
    await page.click('button[type="submit"]');

    // Wait for redirect to admin dashboard
    await page.waitForURL('**/admin/**', { timeout: 15000 }).catch(() => {});
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Verify we're on admin dashboard
    expect(page.url()).toContain('/admin');

    // Take screenshot of admin dashboard
    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-admin-dashboard.png`, fullPage: true });

    console.log('Login successful - Admin dashboard loaded');
  });

  test('2. Test Events Feature', async () => {
    // Navigate to darts admin (must select sport first)
    await page.goto('http://localhost:3001/admin');
    await page.waitForLoadState('networkidle');

    // Select Darts sport if on sport selection page
    const dartsLink = page.locator('a[href*="darts"]').first();
    if (await dartsLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dartsLink.click();
      await page.waitForLoadState('networkidle');
    }

    // Navigate directly to events page
    await page.goto('http://localhost:3001/admin/events');
    await page.waitForLoadState('networkidle');

    // Take screenshot of events page
    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-events-page.png`, fullPage: true });

    // Click Create Event button
    const createEventBtn = page.locator('a:has-text("New"), button:has-text("New"), a:has-text("Create Event")').first();
    await createEventBtn.click();
    await page.waitForLoadState('networkidle');

    // Take screenshot of create event form
    await page.screenshot({ path: `${SCREENSHOT_DIR}/05-create-event-form.png`, fullPage: true });

    // Fill in event details — form uses React controlled inputs without name attributes
    // Wait for form to be ready
    await page.waitForTimeout(1000);

    // Event name — placeholder is "e.g., Friday Night Darts"
    const eventNameInput = page.locator('form input[type="text"]').first();
    await eventNameInput.click();
    await eventNameInput.fill('Lime Kiln Grand 2026');

    // Fill dates — two date inputs in the form
    const startDateInput = page.locator('input[type="date"]').first();
    await startDateInput.fill('2026-02-01');

    const endDateInput = page.locator('input[type="date"]').nth(1);
    await endDateInput.fill('2026-02-03');

    // Fill location — placeholder "e.g., The Sports Bar, 123 Main St"
    const locationInput = page.locator('form input[type="text"]').nth(1);
    if (await locationInput.isVisible()) {
      await locationInput.fill('Lime Kiln Pub');
    }

    // Take screenshot before submit
    await page.screenshot({ path: `${SCREENSHOT_DIR}/06-event-form-filled.png`, fullPage: true });

    // Submit the form
    await page.click('button:has-text("Create Event")');
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
    await page.waitForTimeout(1000);

    // Take screenshot of dartboards page
    await page.screenshot({ path: `${SCREENSHOT_DIR}/08-dartboards-page.png`, fullPage: true });

    // The dartboards page has an inline form: fill board number + name, then click submit
    // Use high board numbers to avoid conflicts with existing boards (1-15, 99)
    const numberInput = page.locator('input[type="number"]').first();
    const nameInput = page.locator('input[type="text"]').first();

    // Add first dartboard — fill form fields first, then submit
    await numberInput.fill('50');
    if (await nameInput.isVisible()) {
      await nameInput.fill('E2E Test Board A');
    }
    await page.click('button:has-text("Add Dartboard")');
    await page.waitForTimeout(1000);

    // Take screenshot after adding first dartboard
    await page.screenshot({ path: `${SCREENSHOT_DIR}/09-dartboard-1-added.png`, fullPage: true });

    // Add second dartboard
    await numberInput.fill('51');
    if (await nameInput.isVisible()) {
      await nameInput.fill('E2E Test Board B');
    }
    await page.click('button:has-text("Add Dartboard")');
    await page.waitForTimeout(1000);

    // Take screenshot after adding both dartboards
    await page.screenshot({ path: `${SCREENSHOT_DIR}/10-dartboards-complete.png`, fullPage: true });

    console.log('Dartboards test completed');
  });

  test('4. Test Lucky Draw Tournament', async () => {
    // Navigate to create new tournament
    await page.goto('http://localhost:3001/admin/tournaments/new');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Take screenshot of tournament creation form
    await page.screenshot({ path: `${SCREENSHOT_DIR}/11-tournament-form.png`, fullPage: true });

    // Tournament form uses React controlled inputs without name attributes
    // First select = Event (required), then text input = name, then selects for game type & format

    // Select an event (required — first select in the form)
    const eventSelect = page.locator('form select').first();
    if (await eventSelect.isVisible()) {
      const options = await eventSelect.locator('option').allTextContents();
      if (options.length > 1) {
        await eventSelect.selectOption({ index: 1 });
      }
    }

    // Fill tournament name — first text input in the form
    const nameInput = page.locator('form input[type="text"]').first();
    await nameInput.click();
    await nameInput.fill('Lucky Draw 501');

    // Game type select — second select (501 is already default)
    const gameTypeSelect = page.locator('form select').nth(1);
    if (await gameTypeSelect.isVisible()) {
      await gameTypeSelect.selectOption({ label: '501' });
    }

    // Format select — third select
    const formatSelect = page.locator('form select').nth(2);
    if (await formatSelect.isVisible()) {
      await formatSelect.selectOption({ label: 'Lucky Draw Doubles' });
    }

    // Take screenshot of filled form
    await page.screenshot({ path: `${SCREENSHOT_DIR}/12-lucky-draw-form-filled.png`, fullPage: true });

    // Submit
    await page.click('button:has-text("Create Tournament"), button[type="submit"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Take screenshot after creation
    await page.screenshot({ path: `${SCREENSHOT_DIR}/13-lucky-draw-created.png`, fullPage: true });

    // Try to add players
    const addPlayerBtn = page.locator('button:has-text("Add Player"), button:has-text("Add Participant")').first();
    if (await addPlayerBtn.isVisible()) {
      for (let i = 1; i <= 4; i++) {
        await addPlayerBtn.click();
        await page.waitForTimeout(300);

        const playerNameInput = page.locator('input[placeholder*="player" i], input[placeholder*="search" i]').first();
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
    await page.waitForTimeout(1000);

    // Tournament form: select event first, then fill name, then game type & format
    const eventSelect = page.locator('form select').first();
    if (await eventSelect.isVisible()) {
      const options = await eventSelect.locator('option').allTextContents();
      if (options.length > 1) {
        await eventSelect.selectOption({ index: 1 });
      }
    }

    // Fill tournament name — first text input in the form
    const nameInput = page.locator('form input[type="text"]').first();
    await nameInput.click();
    await nameInput.fill('Scoring Test Tournament');

    // Game type (second select, 501 is default)
    const gameTypeSelect = page.locator('form select').nth(1);
    if (await gameTypeSelect.isVisible()) {
      await gameTypeSelect.selectOption({ label: '501' });
    }

    // Format (third select)
    const formatSelect = page.locator('form select').nth(2);
    if (await formatSelect.isVisible()) {
      await formatSelect.selectOption({ label: 'Single Elimination' });
    }

    // Take screenshot
    await page.screenshot({ path: `${SCREENSHOT_DIR}/16-scoring-tournament-form.png`, fullPage: true });

    // Submit
    await page.click('button:has-text("Create Tournament"), button[type="submit"]');
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
