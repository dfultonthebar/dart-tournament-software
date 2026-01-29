const { chromium } = require('playwright');

const SCREENSHOT_DIR = '/home/darts-admin/DartTournament/test-screenshots/lucky-draw';
const BASE_URL = 'http://localhost:3001';

async function takeScreenshot(page, name, step) {
  const filename = `${SCREENSHOT_DIR}/${String(step).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: filename, fullPage: true });
  console.log(`  Screenshot saved: ${filename}`);
}

async function runTest() {
  console.log('='.repeat(60));
  console.log('Lucky Draw Tournament Test');
  console.log('='.repeat(60));
  console.log('');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 }
  });
  const page = await context.newPage();

  let step = 1;
  let tournamentId = null;

  try {
    // Step 1: Go to login page
    console.log('Step 1: Navigate to login page');
    await page.goto(`${BASE_URL}/admin/login`);
    await page.waitForLoadState('networkidle');
    await takeScreenshot(page, 'login-page', step++);

    // Step 2: Login with Admin / 1972
    console.log('Step 2: Login with Admin / 1972');

    // The login form has two text inputs - first is name, second is PIN
    const inputs = await page.locator('input[type="text"]').all();
    if (inputs.length >= 2) {
      await inputs[0].fill('Admin');
      await inputs[1].fill('1972');
    } else {
      await page.locator('input[placeholder="Admin"]').fill('Admin');
      await page.locator('input[placeholder*="••••"]').fill('1972');
    }

    await takeScreenshot(page, 'login-filled', step++);

    // Click the Login button
    await page.locator('button[type="submit"]').click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await takeScreenshot(page, 'after-login', step++);

    console.log(`  Current URL: ${page.url()}`);

    // Step 3: Go to new tournament page
    console.log('Step 3: Navigate to new tournament page');
    await page.goto(`${BASE_URL}/admin/tournaments/new`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await takeScreenshot(page, 'new-tournament-page', step++);

    // Step 4: Fill in tournament details
    console.log('Step 4: Create Lucky Draw tournament');

    // Fill tournament name
    const nameInput = await page.locator('input[placeholder*="Championship"], input[placeholder*="Friday"]').first();
    await nameInput.fill('Lucky Draw Test');

    // Select game type 501
    const gameTypeSelect = await page.locator('select').first();
    await gameTypeSelect.selectOption('501');

    // Select Lucky Draw Doubles format
    const formatSelect = await page.locator('select').nth(1);
    await formatSelect.selectOption('lucky_draw_doubles');

    await page.waitForTimeout(500);
    await takeScreenshot(page, 'tournament-form-filled', step++);

    // Step 5: Submit form
    console.log('Step 5: Submit tournament form');
    await page.locator('button[type="submit"]').click();

    // Wait for navigation to tournament detail page
    await page.waitForURL(/\/admin\/tournaments\/[a-f0-9-]+$/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await takeScreenshot(page, 'tournament-created', step++);

    // Get tournament ID from URL
    const currentUrl = page.url();
    console.log(`  Current URL: ${currentUrl}`);
    const urlMatch = currentUrl.match(/\/tournaments\/([a-f0-9-]+)/);
    if (urlMatch) {
      tournamentId = urlMatch[1];
      console.log(`  Tournament ID: ${tournamentId}`);
    }

    // Step 6: Add 4 players to the tournament
    console.log('Step 6: Add 4 players to the tournament');

    for (let i = 0; i < 4; i++) {
      // Find the player select dropdown
      const playerSelect = await page.locator('select:has(option:text("Select a player..."))').first();

      await page.waitForTimeout(500);

      // Get available player options
      const options = await playerSelect.locator('option').all();
      console.log(`  Player ${i+1}: Found ${options.length} options in dropdown`);

      if (options.length > 1) {
        const optionValue = await options[1].getAttribute('value');
        const optionText = await options[1].textContent();

        if (optionValue) {
          console.log(`  Player ${i+1}: Selecting "${optionText}"`);

          await playerSelect.selectOption(optionValue);
          await page.waitForTimeout(500);

          // Wait for Add button to be enabled and click
          const addButton = await page.locator('button:has-text("Add"):not([disabled])').first();
          await addButton.waitFor({ state: 'visible', timeout: 5000 });
          await addButton.click();

          await page.waitForTimeout(1500);
          console.log(`  Player ${i+1}: Added successfully`);
        }
      } else {
        console.log(`  Warning: Not enough players available`);
        break;
      }
    }

    await takeScreenshot(page, 'players-added', step++);

    // Step 7: Go to Lucky Draw page using the "Generate Teams" link
    console.log('Step 7: Navigate to Lucky Draw page');

    // Click the "Generate Teams" or "Manage Teams" link at the top of the page
    const teamsLink = await page.locator('a:has-text("Generate Teams"), a:has-text("Manage Teams")').first();

    if (await teamsLink.isVisible().catch(() => false)) {
      console.log('  Found "Generate Teams" link, clicking...');
      await teamsLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
    } else {
      // Navigate directly to lucky-draw page
      console.log('  Navigating directly to lucky-draw page...');
      await page.goto(`${BASE_URL}/admin/tournaments/${tournamentId}/lucky-draw`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
    }

    await takeScreenshot(page, 'lucky-draw-page', step++);

    // Step 8: Click Generate Random Teams button
    console.log('Step 8: Click Generate Random Teams');

    // Look for the button - it might say "Generate Random Teams" or just be a primary button
    let generateBtn = await page.locator('button:has-text("Generate Random Teams")').first();

    if (!(await generateBtn.isVisible().catch(() => false))) {
      // Try alternative button text
      generateBtn = await page.locator('button.btn-primary:has-text("Generate")').first();
    }

    if (await generateBtn.isVisible().catch(() => false)) {
      console.log('  Found Generate button, clicking...');
      await generateBtn.click();
      await page.waitForTimeout(3000);
      await takeScreenshot(page, 'teams-generated', step++);
    } else {
      console.log('  Generate Random Teams button not found - checking page content');
      const pageText = await page.locator('body').textContent();
      console.log('  Page contains "Generate":', pageText.includes('Generate'));
      await takeScreenshot(page, 'button-not-found', step++);
    }

    // Step 9: Verify teams created
    console.log('Step 9: Verify teams were created');

    // Check for Team 1 and Team 2 text
    const pageContent = await page.content();
    const team1Found = pageContent.includes('Team 1');
    const team2Found = pageContent.includes('Team 2');

    // Look for team cards with player names
    const teamElements = await page.locator('text=Team 1').count();
    const team2Elements = await page.locator('text=Team 2').count();

    console.log(`  Team 1 found: ${team1Found} (elements: ${teamElements})`);
    console.log(`  Team 2 found: ${team2Found} (elements: ${team2Elements})`);

    // Check for success message
    const successMessage = await page.locator('.bg-green-600').first();
    if (await successMessage.isVisible().catch(() => false)) {
      const successText = await successMessage.textContent();
      console.log(`  Success message: ${successText}`);
    }

    // Get teams count from the page
    const teamsCountText = await page.locator('text=/Generated Teams \\(\\d+\\)/').textContent().catch(() => '');
    console.log(`  Teams section: ${teamsCountText || 'Not found'}`);

    await takeScreenshot(page, 'final-verification', step++);

    console.log('');
    console.log('='.repeat(60));
    console.log('TEST RESULTS');
    console.log('='.repeat(60));
    console.log(`Tournament ID: ${tournamentId || 'Not captured'}`);
    console.log(`Teams generated: ${team1Found && team2Found ? 'YES - 2 teams created' : 'NO'}`);
    console.log(`Screenshots saved to: ${SCREENSHOT_DIR}`);
    console.log('');

    if (team1Found && team2Found) {
      console.log('TEST STATUS: SUCCESS');
      return true;
    } else {
      console.log('TEST STATUS: NEEDS REVIEW - Check screenshots');
      return false;
    }

  } catch (error) {
    console.error('');
    console.error('TEST ERROR:', error.message);
    await takeScreenshot(page, 'error-state', step);
    console.log('');
    console.log('TEST STATUS: FAILED');
    throw error;
  } finally {
    await browser.close();
  }
}

runTest().catch(err => {
  console.error(err);
  process.exit(1);
});
