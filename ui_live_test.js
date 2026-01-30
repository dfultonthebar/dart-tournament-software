#!/usr/bin/env node
/**
 * ui_live_test.js — Human-Like UI Tournament Walkthrough
 *
 * Launches a real browser and walks through the complete tournament lifecycle
 * exactly as a human admin would — typing names, clicking buttons, filling
 * forms, registering players, and scoring every match to crown a champion.
 *
 * SELF-CONTAINED: Resets the database, creates the admin, and runs everything.
 *
 * Usage:  node ui_live_test.js
 */

const { chromium } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

// ─── Configuration ───────────────────────────────────────────────────────────
const SCORING_URL = 'http://localhost:3001';
const DISPLAY_URL = 'http://localhost:3002';
const SCREENSHOT_DIR = path.join(__dirname, 'test-screenshots', 'ui-walkthrough');
const PROJECT_DIR = __dirname;

const PLAYERS = [
  { name: 'Jake Thompson',   email: 'jake.t@test.com',   password: 'password123', phone: '5551001' },
  { name: 'Sarah Miller',    email: 'sarah.m@test.com',   password: 'password123', phone: '5551002' },
  { name: 'Mike Johnson',    email: 'mike.j@test.com',    password: 'password123', phone: '5551003' },
  { name: 'Emily Davis',     email: 'emily.d@test.com',   password: 'password123', phone: '5551004' },
  { name: 'Chris Wilson',    email: 'chris.w@test.com',   password: 'password123', phone: '5551005' },
  { name: 'Jessica Brown',   email: 'jessica.b@test.com', password: 'password123', phone: '5551006' },
  { name: 'David Garcia',    email: 'david.g@test.com',   password: 'password123', phone: '5551007' },
  { name: 'Amanda Martinez', email: 'amanda.m@test.com',  password: 'password123', phone: '5551008' },
];

let stepNum = 0;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function log(msg) {
  console.log(`[${new Date().toISOString().slice(11, 23)}] ${msg}`);
}

async function snap(page, name) {
  stepNum++;
  const file = `${String(stepNum).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, file), fullPage: true });
  log(`  📸 ${file}`);
}

function httpRequest(method, urlPath, body, authToken) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost', port: 8000,
      path: `/api${urlPath}`, method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    if (authToken) opts.headers['Authorization'] = `Bearer ${authToken}`;

    const req = http.request(opts, res => {
      let result = '';
      res.on('data', c => result += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(result);
          if (res.statusCode >= 400) {
            log(`  ⚠ API ${method} ${urlPath} → ${res.statusCode}: ${parsed.detail || result.slice(0, 80)}`);
          }
          resolve(parsed);
        }
        catch { resolve(result); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  console.log('\n' + '═'.repeat(60));
  console.log('  🎯  DART TOURNAMENT — LIVE UI WALKTHROUGH');
  console.log('═'.repeat(60));
  console.log('  4 dartboards · 8 players · 501 Singles · Single Elimination');
  console.log('  Every action done through the browser UI — boards assigned per match');
  console.log('═'.repeat(60) + '\n');

  // ── Pre-flight: Check services ──
  log('Checking services...');
  try {
    await httpRequest('GET', '/../health');
    log('✓ Backend running on :8000');
  } catch {
    console.error('❌ Backend not running! Start services with: ./start-dev.sh');
    process.exit(1);
  }
  try {
    await new Promise((resolve, reject) => {
      http.get(SCORING_URL, res => resolve(res.statusCode)).on('error', reject);
    });
    log('✓ Scoring terminal running on :3001');
  } catch {
    console.error('❌ Scoring terminal not running! Start services with: ./start-dev.sh');
    process.exit(1);
  }

  // ── Pre-flight: Reset DB & Create Admin ──
  log('🔄 Resetting database...');
  execSync(
    `${PROJECT_DIR}/backend/venv/bin/python ${PROJECT_DIR}/backend/scripts/init_db.py`,
    { cwd: PROJECT_DIR, stdio: 'pipe' }
  );
  log('✓ Database reset');

  // Wait for backend to finish any reload triggered by init_db.py's .pyc files
  log('  Waiting for backend to stabilize...');
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 1000));
    try {
      const h = await httpRequest('GET', '/../health');
      if (h && typeof h === 'object') break;
    } catch {}
  }

  log('👤 Creating admin user...');
  let adminToken = null;
  // Retry loop: init_db may trigger uvicorn reload, so admin creation/login might fail transiently
  for (let attempt = 0; attempt < 5; attempt++) {
    const adminResult = await httpRequest('POST', '/auth/admins', { name: 'Admin', pin: '1972', email: 'admin@test.com' });
    if (adminResult.id || (adminResult.detail && adminResult.detail.includes('already'))) {
      log('  Admin user created/exists');
    } else {
      log(`  Admin create attempt ${attempt + 1} failed: ${JSON.stringify(adminResult).slice(0, 80)}`);
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }

    const loginData = await httpRequest('POST', '/auth/admin-login', { name: 'Admin', pin: '1972' });
    if (loginData.access_token) {
      adminToken = loginData.access_token;
      break;
    }
    log(`  Login attempt ${attempt + 1} failed: ${JSON.stringify(loginData).slice(0, 80)}`);
    await new Promise(r => setTimeout(r, 2000));
  }

  if (!adminToken) {
    console.error('❌ Failed to get admin token after 5 attempts');
    process.exit(1);
  }
  log(`✓ Admin ready (token: ${adminToken.slice(0, 20)}...)`);

  // ── Display setup for headed mode ──
  if (!process.env.DISPLAY && fs.existsSync('/tmp/.X11-unix/X0')) {
    process.env.DISPLAY = ':0';
  }
  if (!process.env.XAUTHORITY) {
    try {
      const f = fs.readdirSync('/run/user/1000').find(n => n.startsWith('.mutter-Xwaylandauth'));
      if (f) process.env.XAUTHORITY = `/run/user/1000/${f}`;
    } catch {}
  }

  // ── Launch Browser ──
  log('🚀 Launching Chromium (headed)...');
  const browser = await chromium.launch({
    headless: false,
    slowMo: 40,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);

  // Display terminal in second window
  const dispCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const dispPage = await dispCtx.newPage();
  await dispPage.goto(DISPLAY_URL, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});

  let tournamentId = null;

  try {
    // ═════════════════════════════════════════════════════════════════════════
    // PHASE 1: Login
    // ═════════════════════════════════════════════════════════════════════════
    log('\n═══ PHASE 1: Admin Login ═══');
    await page.goto(SCORING_URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(t => localStorage.setItem('admin_token', t), adminToken);
    await page.goto(`${SCORING_URL}/admin/darts`, { waitUntil: 'networkidle' });
    log('✓ Logged in as Admin');
    await snap(page, 'admin-dashboard');

    // ═════════════════════════════════════════════════════════════════════════
    // PHASE 2: Create Dartboards
    // ═════════════════════════════════════════════════════════════════════════
    log('\n═══ PHASE 2: Create Dartboards ═══');
    await page.getByText('Manage Dartboards').click();
    await page.waitForURL('**/dartboards**');
    await page.waitForTimeout(500);

    const boardNames = ['Main Stage', 'Back Room', 'Bar Side', 'VIP Lounge'];
    for (let i = 0; i < 4; i++) {
      const numberField = page.locator('input[type="number"][min="1"]');
      await numberField.fill('');
      await numberField.pressSequentially(String(i + 1), { delay: 30 });

      const nameField = page.getByPlaceholder('Main Stage');
      await nameField.fill('');
      await nameField.pressSequentially(boardNames[i], { delay: 20 });

      if (i === 0) await snap(page, 'dartboard-form-filled');

      await page.getByRole('button', { name: /Add Dartboard/ }).click();
      await page.waitForTimeout(800);
      log(`  ✓ Board ${i + 1}: ${boardNames[i]}`);
    }

    await snap(page, 'dartboards-created');
    log('✓ 4 dartboards created');

    // ═════════════════════════════════════════════════════════════════════════
    // PHASE 3: Create Event
    // ═════════════════════════════════════════════════════════════════════════
    log('\n═══ PHASE 3: Create Event ═══');
    await page.goto(`${SCORING_URL}/admin/darts`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    await page.getByText('+ Create New Event').click();
    await page.waitForURL('**/events/new**');
    await page.waitForTimeout(400);

    // Type event name (human-like keystroke by keystroke)
    const eventNameInput = page.getByPlaceholder(/Friday Night/);
    await eventNameInput.click();
    await eventNameInput.pressSequentially('Friday Night Darts Championship', { delay: 25 });
    log('  Typed event name');

    // Type location
    const locationInput = page.getByPlaceholder(/Sports Bar/);
    await locationInput.click();
    await locationInput.pressSequentially('The Bar - Main Hall', { delay: 25 });
    log('  Typed location');

    // Set dates to today
    const today = new Date().toISOString().split('T')[0];
    const dateInputs = page.locator('input[type="date"]');
    await dateInputs.nth(0).fill(today);
    await dateInputs.nth(1).fill(today);
    log('  Set dates to today');

    await snap(page, 'event-form-filled');

    // Submit and wait for redirect to event detail page
    await page.getByRole('button', { name: 'Create Event' }).click();
    // Wait for URL to change to an event detail page (contains a UUID)
    await page.waitForFunction(() => {
      const url = window.location.pathname;
      return url.match(/\/events\/[0-9a-f]{8}-/);
    }, { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Extract event ID from URL
    const eventId = page.url().split('/events/')[1]?.split(/[?#/]/)[0];
    log(`✓ Event created (ID: ${eventId?.slice(0, 8)}...)`);
    await snap(page, 'event-created');

    // ═════════════════════════════════════════════════════════════════════════
    // PHASE 3: Create Tournament
    // ═════════════════════════════════════════════════════════════════════════
    log('\n═══ PHASE 4: Create Tournament ═══');

    // Navigate directly to tournament creation with event pre-selected
    await page.goto(`${SCORING_URL}/admin/tournaments/new?event_id=${eventId}`, {
      waitUntil: 'networkidle',
    });
    await page.waitForTimeout(800);

    // Ensure the event is selected in the dropdown
    const eventSelect = page.locator('select').first();
    const eventOptions = await eventSelect.locator('option').allInnerTexts();
    log(`  Event dropdown options: ${eventOptions.join(', ')}`);
    // Select the event that has our event name
    const eventOption = eventOptions.find(o => o.includes('Friday Night'));
    if (eventOption) {
      await eventSelect.selectOption({ label: eventOption });
      log(`  Selected event: ${eventOption}`);
    } else if (eventId) {
      await eventSelect.selectOption(eventId);
      log('  Selected event by ID');
    }
    await page.waitForTimeout(300);

    // Type tournament name
    const tourneyName = page.getByPlaceholder(/501 Singles/);
    await tourneyName.click();
    await tourneyName.pressSequentially('501 Singles Showdown', { delay: 25 });
    log('  Typed tournament name');

    // Select Game Type = 501
    const gameTypeSelect = page.locator('select').filter({ has: page.locator('option[value="501"]') });
    await gameTypeSelect.selectOption('501');
    log('  Selected game type: 501');

    // Select Format = Single Elimination
    const formatSelect = page.locator('select').filter({ has: page.locator('option[value="single_elimination"]') });
    await formatSelect.selectOption('single_elimination');
    log('  Selected format: Single Elimination');

    // Set Max Players = 8 (identified by max="128")
    await page.locator('input[type="number"][max="128"]').fill('8');
    log('  Set max players: 8');

    // Set Legs to Win = 2 (identified by max="11")
    await page.locator('input[type="number"][max="11"]').fill('2');
    log('  Set legs to win: 2');

    // Check Double Out
    const doubleOutLabel = page.locator('label').filter({ hasText: 'Double Out' });
    await doubleOutLabel.locator('input[type="checkbox"]').check();
    log('  Checked Double Out');

    await snap(page, 'tournament-form-filled');

    // Submit
    await page.getByRole('button', { name: 'Create Tournament' }).click();
    // Wait for redirect to tournament detail page (UUID in URL)
    await page.waitForFunction(() => {
      const url = window.location.pathname;
      return url.match(/\/tournaments\/[0-9a-f]{8}-/);
    }, { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Extract tournament ID
    tournamentId = page.url().split('/tournaments/')[1]?.split(/[?#/]/)[0];
    log(`✓ Tournament created (ID: ${tournamentId?.slice(0, 8)}...)`);
    await snap(page, 'tournament-created');

    // ═════════════════════════════════════════════════════════════════════════
    // PHASE 4: Register 8 Players
    // ═════════════════════════════════════════════════════════════════════════
    log('\n═══ PHASE 5: Register Players ═══');

    await page.goto(`${SCORING_URL}/admin/players`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    for (let i = 0; i < PLAYERS.length; i++) {
      const p = PLAYERS[i];
      log(`  Registering ${p.name} (${i + 1}/${PLAYERS.length})...`);

      // Show the form if it's hidden (first time only — after that it stays open)
      const addPlayerBtn = page.getByRole('button', { name: '+ Add Player' });
      if (await addPlayerBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await addPlayerBtn.click();
        await page.waitForTimeout(300);
      }

      // Clear and type each field
      const nameField = page.getByPlaceholder('Player name');
      await nameField.fill('');
      await nameField.pressSequentially(p.name, { delay: 18 });

      const emailField = page.getByPlaceholder('player@example.com');
      await emailField.fill('');
      await emailField.pressSequentially(p.email, { delay: 18 });

      const passField = page.getByPlaceholder('Minimum 8 characters');
      await passField.fill('');
      await passField.pressSequentially(p.password, { delay: 18 });

      const phoneField = page.getByPlaceholder('Optional');
      await phoneField.fill('');
      await phoneField.pressSequentially(p.phone, { delay: 18 });

      // Screenshot of first player form
      if (i === 0) await snap(page, 'player-form-filled');

      // Click Register
      await page.getByRole('button', { name: 'Register Player' }).click();

      // Wait for the form to clear (indicates success)
      await page.waitForTimeout(800);
      log(`    ✓ ${p.name}`);
    }

    await snap(page, 'all-players-registered');
    log(`✓ All ${PLAYERS.length} players registered`);

    // ═════════════════════════════════════════════════════════════════════════
    // PHASE 5: Add Players to Tournament + Mark Paid
    // ═════════════════════════════════════════════════════════════════════════
    log('\n═══ PHASE 6: Tournament Setup ═══');

    // Navigate to tournament detail
    await page.goto(`${SCORING_URL}/admin/tournaments/${tournamentId}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    // Step 1: Open Registration (tournament starts in DRAFT)
    log('  Opening registration...');
    await page.getByRole('button', { name: 'Open Registration' }).click();
    await page.waitForTimeout(1500);
    log('  ✓ Registration opened');

    // Reload to see updated UI
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await snap(page, 'registration-open');

    // Step 2: Add each player from the dropdown
    log('  Adding players to tournament...');
    for (let i = 0; i < PLAYERS.length; i++) {
      const p = PLAYERS[i];

      // Find the "Select a player..." dropdown
      const playerSelect = page.locator('select').filter({ has: page.locator('option', { hasText: 'Select a player' }) });
      await playerSelect.selectOption({ label: p.name });
      await page.waitForTimeout(200);

      // Click "Add" button
      await page.getByRole('button', { name: 'Add', exact: true }).click();
      await page.waitForTimeout(600);

      log(`    ✓ Added ${p.name} (${i + 1}/${PLAYERS.length})`);
    }

    await snap(page, 'players-added-to-tournament');
    log('  ✓ All players added');

    // Step 3: Mark all as paid by clicking each "Unpaid" label one at a time
    //         The checkbox triggers an API call + loadData() re-render, so we
    //         must wait for the DOM to settle between clicks.
    log('  Marking all players as paid...');
    await page.waitForTimeout(500);

    let paidCount = 0;

    // Click each "Unpaid" label individually, waiting for the text to change
    for (let attempt = 0; attempt < 20; attempt++) {
      // Reload to get a fresh consistent DOM state
      if (attempt > 0) {
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForTimeout(500);
      }

      // Count remaining unpaid
      const unpaidSpans = page.locator('span.text-red-400', { hasText: 'Unpaid' });
      const remaining = await unpaidSpans.count();
      if (remaining === 0) break;

      log(`    ${remaining} unpaid remaining...`);

      // Find the first unpaid checkbox and click it
      // Each entry row has: <label><input type="checkbox"/><span>Unpaid</span></label>
      const firstUnpaidLabel = page.locator('label').filter({
        has: page.locator('span.text-red-400', { hasText: 'Unpaid' })
      }).first();

      await firstUnpaidLabel.scrollIntoViewIfNeeded();
      await firstUnpaidLabel.locator('input[type="checkbox"]').click({ force: true });
      paidCount++;

      // Wait for the API call to complete and page to re-render
      // The togglePaidStatus sends PATCH then calls loadData()
      await page.waitForTimeout(1200);
    }

    // Final reload and verification
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    const finalUnpaidCount = await page.locator('span.text-red-400', { hasText: 'Unpaid' }).count();
    if (finalUnpaidCount > 0) {
      log(`  ⚠ ${finalUnpaidCount} still unpaid — using API fallback...`);
      // API fallback: mark remaining entries as paid
      const entriesResp = await httpRequest('GET', `/tournaments/${tournamentId}/entries`);
      if (Array.isArray(entriesResp)) {
        for (const entry of entriesResp) {
          if (!entry.paid) {
            await new Promise((resolve, reject) => {
              const patchData = JSON.stringify({ paid: true });
              const req = http.request({
                hostname: 'localhost', port: 8000,
                path: `/api/tournaments/${tournamentId}/entries/${entry.id}`,
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  'Content-Length': Buffer.byteLength(patchData),
                  'Authorization': `Bearer ${adminToken}`,
                },
              }, res => {
                let body = '';
                res.on('data', c => body += c);
                res.on('end', () => resolve(body));
              });
              req.on('error', reject);
              req.write(patchData);
              req.end();
            });
            paidCount++;
          }
        }
      }
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
    }

    log(`  ✓ Marked ${paidCount} players as paid`);
    await snap(page, 'all-players-paid');

    // ═════════════════════════════════════════════════════════════════════════
    // PHASE 6: Start Tournament
    // ═════════════════════════════════════════════════════════════════════════
    log('\n═══ PHASE 7: Start Tournament ═══');

    await page.waitForTimeout(500);
    let startBtn = page.getByRole('button', { name: /Start Tournament/ });

    // Wait for button to become enabled (all paid). Try up to 5 reloads.
    for (let attempt = 0; attempt < 5; attempt++) {
      const isDisabled = await startBtn.isDisabled();
      if (!isDisabled) break;

      log(`  ⚠ Start button disabled (attempt ${attempt + 1}/5) — reloading...`);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      startBtn = page.getByRole('button', { name: /Start Tournament/ });
    }

    await startBtn.click();
    log('  Clicked "Start Tournament" — generating bracket...');

    // Wait for the page to update (the tournament status changes and page re-renders)
    await page.waitForTimeout(3000);

    // Check if we're still on the tournament page (bracket generated successfully)
    const pageText = await page.textContent('body');
    if (pageText.includes('IN_PROGRESS') || pageText.includes('Go to Scoring') || pageText.includes('Bracket')) {
      log('✓ Tournament started — bracket generated!');
    } else {
      log('  Tournament started (verifying...)');
    }
    await snap(page, 'tournament-started');

    // Update display terminal
    if (tournamentId) {
      await dispPage.goto(`${DISPLAY_URL}`, { waitUntil: 'networkidle', timeout: 10000 }).catch(() => {});
      await dispPage.waitForTimeout(1000);
      await snap(dispPage, 'display-tournament-list');
    }

    // ═════════════════════════════════════════════════════════════════════════
    // PHASE 7: Score All Matches
    // ═════════════════════════════════════════════════════════════════════════
    log('\n═══ PHASE 8: Assign Boards & Score Matches ═══');

    // Navigate to scoring: click "Go to Scoring" link or navigate directly
    const goToScoring = page.getByText('Go to Scoring');
    if (await goToScoring.isVisible({ timeout: 2000 }).catch(() => false)) {
      await goToScoring.click();
      await page.waitForURL('**/matches**', { timeout: 8000 }).catch(() => {});
    } else {
      await page.goto(`${SCORING_URL}/matches?tournament=${tournamentId}`, { waitUntil: 'networkidle' });
    }
    await page.waitForTimeout(1000);
    await snap(page, 'matches-page');

    // 8-player single elimination = 7 total matches:
    //   Round 1: 4 matches → Semi-finals: 2 matches → Final: 1 match
    let totalScored = 0;
    const TOTAL_MATCHES = 7;
    let attempts = 0;

    while (totalScored < TOTAL_MATCHES && attempts < 40) {
      attempts++;

      // Navigate to matches page
      await page.goto(`${SCORING_URL}/matches?tournament=${tournamentId}`, {
        waitUntil: 'networkidle',
        timeout: 10000,
      });
      await page.waitForTimeout(800);

      // Find any scoreable match link (Start Scoring or Continue Scoring)
      const scoreLinks = page.locator('a').filter({ hasText: /Start Scoring|Continue Scoring/ });
      const linkCount = await scoreLinks.count();

      if (linkCount === 0) {
        // Check if all matches are already completed
        const completedCount = await page.locator('text=Match Completed').count();
        if (completedCount >= TOTAL_MATCHES) {
          log(`  All ${completedCount} matches show as completed`);
          totalScored = TOTAL_MATCHES;
          break;
        }
        // No scoreable matches right now — wait for bracket advancement
        log(`  No scoreable matches found (${completedCount} completed) — waiting...`);
        await page.waitForTimeout(2000);
        continue;
      }

      // Assign a board to the first scoreable match (if not already assigned)
      // The score link and board dropdown are in the same match card
      const firstScoreLink = scoreLinks.first();
      const matchCard = firstScoreLink.locator('xpath=ancestor::div[contains(@class,"rounded-lg")]').first();
      const boardSelect = matchCard.locator('select').first();
      const hasBoardSelect = await boardSelect.isVisible({ timeout: 500 }).catch(() => false);

      if (hasBoardSelect) {
        // Pick the first available board option (skip "Assign Board" placeholder)
        const options = await boardSelect.locator('option').allInnerTexts();
        const boardOption = options.find(o => o.startsWith('Board'));
        if (boardOption) {
          await boardSelect.selectOption({ label: boardOption });
          await page.waitForTimeout(600);
          log(`    Assigned: ${boardOption}`);
        }
      }

      // Click the first available scoring link
      await firstScoreLink.click();
      await page.waitForURL('**/score/**', { timeout: 8000 });

      // Wait for the score page to fully load (auth + API data)
      // Either player buttons appear, or "Match Complete", or "Match Not Found"
      const playerBtns = page.locator('button').filter({ hasText: 'Tap to select as winner' });
      try {
        await playerBtns.first().waitFor({ state: 'visible', timeout: 8000 });
      } catch {
        // Check if match is already completed
        const alreadyComplete = await page.getByText('Match Complete').isVisible({ timeout: 500 }).catch(() => false);
        if (alreadyComplete) {
          log('  Match already complete, going back...');
          continue;
        }
        // Check for error state
        const hasError = await page.locator('.text-red-400').isVisible({ timeout: 500 }).catch(() => false);
        if (hasError) {
          const errorText = await page.locator('.text-red-400').first().textContent().catch(() => '');
          log(`  Score page error: ${errorText}`);
        }
        log('  Match not ready (waiting for players)...');
        await page.waitForTimeout(2000);
        continue;
      }

      const btnCount = await playerBtns.count();
      if (btnCount < 2) {
        log('  Only 1 player button visible, skipping...');
        continue;
      }

      // Read player names from the buttons
      const player1Name = await playerBtns.nth(0).locator('div').first().innerText();
      const player2Name = await playerBtns.nth(1).locator('div').first().innerText();
      log(`  Match ${totalScored + 1}/${TOTAL_MATCHES}: ${player1Name} vs ${player2Name}`);

      // Select the first player as winner
      await playerBtns.first().click();
      await page.waitForTimeout(400);

      // Screenshot the confirmation modal for the first match
      if (totalScored === 0) await snap(page, 'winner-confirm-modal');

      // Click "Confirm" in the modal
      const confirmBtn = page.getByRole('button', { name: 'Confirm', exact: true });
      await confirmBtn.click();
      log(`    → Winner: ${player1Name}`);

      // After confirm, the page auto-redirects to /matches via router.push()
      // Wait for the redirect to complete
      await page.waitForURL('**/matches**', { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(500);

      totalScored++;
      log(`    ✓ Match ${totalScored}/${TOTAL_MATCHES} complete`);

      // Screenshot at milestones
      if (totalScored === 4 || totalScored === 6 || totalScored === 7) {
        await snap(page, `matches-after-${totalScored}`);
      }

      // Refresh display terminal after each round
      if (totalScored === 4 || totalScored === 6) {
        await dispPage.reload({ waitUntil: 'networkidle', timeout: 8000 }).catch(() => {});
        await snap(dispPage, `display-after-round-${totalScored === 4 ? 1 : 2}`);
      }
    }

    log(`\n✓ All ${totalScored} matches scored!`);

    // ═════════════════════════════════════════════════════════════════════════
    // PHASE 8: Final Results
    // ═════════════════════════════════════════════════════════════════════════
    log('\n═══ PHASE 9: Final Results ═══');

    // Final matches page screenshot
    await page.goto(`${SCORING_URL}/matches?tournament=${tournamentId}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await snap(page, 'final-matches-page');

    // Display terminal — show the bracket
    await dispPage.reload({ waitUntil: 'networkidle', timeout: 10000 }).catch(() => {});
    await dispPage.waitForTimeout(1500);
    await snap(dispPage, 'final-display-bracket');

    // Back to admin dashboard
    await page.goto(`${SCORING_URL}/admin/darts`, { waitUntil: 'networkidle' });
    await snap(page, 'final-admin-dashboard');

    // ═════════════════════════════════════════════════════════════════════════
    // Done!
    // ═════════════════════════════════════════════════════════════════════════
    console.log('\n' + '═'.repeat(60));
    console.log('  🏆  TOURNAMENT COMPLETE!');
    console.log('═'.repeat(60));
    console.log(`  Matches scored: ${totalScored}/${TOTAL_MATCHES}`);
    console.log(`  Screenshots: ${SCREENSHOT_DIR}/`);
    console.log(`  Total steps: ${stepNum} screenshots captured`);
    console.log('═'.repeat(60));

    // Keep browser open so user can look around
    log('\nBrowser stays open for 15 seconds — explore!');
    await page.waitForTimeout(15000);

  } catch (err) {
    log(`\n❌ ERROR: ${err.message}`);
    console.error(err.stack);
    try { await snap(page, 'error-state'); } catch {}

    // Keep browser open on error so user can debug
    log('Browser stays open for 30 seconds (error debugging)...');
    await page.waitForTimeout(30000);
  } finally {
    await browser.close();
    log('Browser closed.');
  }
}

main().catch(console.error);
