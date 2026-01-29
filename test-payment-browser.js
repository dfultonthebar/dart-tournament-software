const { chromium } = require('playwright');

async function testPaymentTracking() {
  console.log('Starting payment tracking browser test...\n');

  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Get tournament ID from API
    console.log('1. Getting tournament ID from API...');
    const response = await fetch('http://localhost:8000/api/tournaments');
    const tournaments = await response.json();
    const paymentTournament = tournaments.find(t => t.name.includes('Payment') && t.status === 'draft');

    if (!paymentTournament) {
      console.log('   No Payment Test Tournament found in DRAFT status');
      console.log('   Available tournaments:', tournaments.map(t => `${t.name} (${t.status})`).join(', '));
      return;
    }

    const tournamentId = paymentTournament.id;
    console.log(`   Found: ${paymentTournament.name} (ID: ${tournamentId})`);

    // Login as admin
    console.log('2. Logging in as admin...');
    await page.goto('http://localhost:3001/admin/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'TheBar#1');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    console.log('   Logged in');

    // Navigate directly to tournament detail page
    console.log('3. Navigating to tournament detail page...');
    await page.goto(`http://localhost:3001/admin/tournaments/${tournamentId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/tmp/payment-1-detail-page.png', fullPage: true });

    // Check if we need to open registration
    console.log('4. Checking tournament status...');
    const openRegButton = page.locator('button:has-text("Open Registration")');
    if (await openRegButton.count() > 0) {
      console.log('   Clicking "Open Registration"...');
      await openRegButton.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: '/tmp/payment-2-registration-opened.png', fullPage: true });
    }

    // Add players
    console.log('5. Adding players...');
    for (let i = 0; i < 3; i++) {
      const playerSelect = page.locator('select').first();
      if (await playerSelect.count() > 0) {
        const optionCount = await playerSelect.locator('option').count();
        if (optionCount > 1) {
          await playerSelect.selectOption({ index: 1 });
          const addButton = page.locator('button:has-text("Add")');
          if (await addButton.count() > 0) {
            await addButton.click();
            await page.waitForTimeout(1500);
            console.log(`   Added player ${i + 1}`);
          }
        }
      }
    }

    await page.screenshot({ path: '/tmp/payment-3-with-players.png', fullPage: true });

    // Check for payment checkboxes
    console.log('6. Checking payment checkboxes...');
    const checkboxes = await page.locator('input[type="checkbox"]').all();
    console.log(`   Found ${checkboxes.length} checkboxes`);

    // Check page content for Paid/Unpaid text
    const pageText = await page.textContent('body');
    const hasPaid = pageText.includes('Paid');
    const hasUnpaid = pageText.includes('Unpaid');
    console.log(`   Page has "Paid" text: ${hasPaid}`);
    console.log(`   Page has "Unpaid" text: ${hasUnpaid}`);

    // Toggle first checkbox
    if (checkboxes.length > 0) {
      console.log('7. Toggling first payment checkbox...');
      const firstCb = checkboxes[0];
      const wasChecked = await firstCb.isChecked();
      console.log(`   Before: ${wasChecked ? 'Paid' : 'Unpaid'}`);

      await firstCb.click();
      await page.waitForTimeout(2000);

      const isChecked = await firstCb.isChecked();
      console.log(`   After: ${isChecked ? 'Paid' : 'Unpaid'}`);

      await page.screenshot({ path: '/tmp/payment-4-toggled.png', fullPage: true });
    }

    // Check Start Tournament button
    console.log('8. Checking Start Tournament button...');
    const startButton = page.locator('button:has-text("Start Tournament")');
    if (await startButton.count() > 0) {
      const isDisabled = await startButton.isDisabled();
      console.log(`   Start Tournament disabled: ${isDisabled}`);

      // Mark all as paid
      console.log('9. Marking all players as paid...');
      const allCbs = await page.locator('input[type="checkbox"]').all();
      for (const cb of allCbs) {
        if (!(await cb.isChecked())) {
          await cb.click();
          await page.waitForTimeout(1000);
        }
      }

      await page.waitForTimeout(1000);
      await page.screenshot({ path: '/tmp/payment-5-all-paid.png', fullPage: true });

      // Check button again
      const nowDisabled = await startButton.isDisabled();
      console.log(`   Start Tournament disabled after all paid: ${nowDisabled}`);

      if (!nowDisabled) {
        console.log('   ✓ SUCCESS: Start Tournament button is now ENABLED!');
      }
    } else {
      console.log('   Start Tournament button not visible (need 2+ players)');
    }

    console.log('\n✓ Payment tracking test completed!');

  } catch (error) {
    console.error('Error during test:', error.message);
    console.error(error.stack);
    await page.screenshot({ path: '/tmp/payment-error.png' });
  }

  console.log('\nScreenshots saved to /tmp/payment-*.png');
  console.log('Keeping browser open for 15 seconds...');
  await page.waitForTimeout(15000);

  await browser.close();
}

testPaymentTracking();
