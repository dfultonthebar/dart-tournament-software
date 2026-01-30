#!/usr/bin/env node
/**
 * watch_stress_test.js - Live Browser Watcher for Stress Test
 *
 * Opens two headed Chromium windows side by side:
 *   - Window 1 (left): Scoring Terminal (localhost:3001) - admin dashboard
 *   - Window 2 (right): Display Terminal (localhost:3002) - live brackets
 *
 * Auto-refreshes both pages every 5 seconds while the stress test runs.
 * Takes final screenshots when signaled to stop.
 *
 * Usage:
 *   node watch_stress_test.js
 *   # Send SIGUSR1 to trigger final screenshots and exit:
 *   kill -USR1 <pid>
 *   # Or just Ctrl+C / kill to stop
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCORING_URL = 'http://localhost:3001';
const DISPLAY_URL = 'http://localhost:3002';
const ADMIN_LOGIN_URL = `${SCORING_URL}/admin/login`;
const ADMIN_NAME = 'Admin';
const ADMIN_PIN = '1972';
const REFRESH_INTERVAL_MS = 5000;
const SCREENSHOT_DIR = path.join(__dirname, 'test-screenshots', 'stress-test');

// Signal file: stress test creates this when done
const SIGNAL_FILE = path.join(__dirname, '.stress-test-done');

let stopping = false;

function log(msg) {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`[${ts}] [BROWSER] ${msg}`);
}

async function ensureScreenshotDir() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function loginAsAdmin(page) {
  // Get a JWT token by calling the backend API directly
  log('Obtaining admin JWT token via API...');
  const http = require('http');

  const token = await new Promise((resolve, reject) => {
    const postData = JSON.stringify({ name: ADMIN_NAME, pin: ADMIN_PIN });
    const req = http.request({
      hostname: 'localhost',
      port: 8000,
      path: '/api/auth/admin-login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': postData.length },
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          resolve(data.access_token || null);
        } catch { resolve(null); }
      });
    });
    req.on('error', (e) => { log(`API login error: ${e.message}`); resolve(null); });
    req.write(postData);
    req.end();
  });

  if (!token) {
    log('Failed to get admin token from API', 'ERROR');
    return;
  }
  log('Got admin JWT token');

  // Navigate to scoring terminal and inject the token into localStorage
  await page.goto(SCORING_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.evaluate((t) => {
    localStorage.setItem('admin_token', t);
  }, token);
  log('Injected admin_token into localStorage');

  // Navigate to the admin darts events page to see tournaments
  await page.goto(`${SCORING_URL}/admin/darts`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);
  log(`Admin logged in, showing: ${page.url()}`);
}

async function takeScreenshots(scoringPage, displayPage, prefix) {
  await ensureScreenshotDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  try {
    await scoringPage.screenshot({
      path: path.join(SCREENSHOT_DIR, `${prefix}-scoring-${timestamp}.png`),
      fullPage: true,
    });
    log(`Screenshot saved: ${prefix}-scoring-${timestamp}.png`);
  } catch (e) {
    log(`Failed to screenshot scoring page: ${e.message}`);
  }

  try {
    await displayPage.screenshot({
      path: path.join(SCREENSHOT_DIR, `${prefix}-display-${timestamp}.png`),
      fullPage: true,
    });
    log(`Screenshot saved: ${prefix}-display-${timestamp}.png`);
  } catch (e) {
    log(`Failed to screenshot display page: ${e.message}`);
  }
}

async function main() {
  await ensureScreenshotDir();

  // Clean up old signal file
  try { fs.unlinkSync(SIGNAL_FILE); } catch {}

  log('Launching headed Chromium browser...');

  // Detect display - set up X11/XWayland environment
  if (!process.env.DISPLAY) {
    if (fs.existsSync('/tmp/.X11-unix/X0')) {
      process.env.DISPLAY = ':0';
      log('Set DISPLAY=:0');
    } else if (fs.existsSync('/tmp/.X11-unix/X1')) {
      process.env.DISPLAY = ':1';
      log('Set DISPLAY=:1');
    }
  }

  // Find Mutter XWayland auth cookie for GNOME/Wayland sessions
  if (!process.env.XAUTHORITY) {
    const xauthFiles = fs.readdirSync('/run/user/1000').filter(f => f.startsWith('.mutter-Xwaylandauth'));
    if (xauthFiles.length > 0) {
      process.env.XAUTHORITY = `/run/user/1000/${xauthFiles[0]}`;
      log(`Set XAUTHORITY=${process.env.XAUTHORITY}`);
    }
  }

  log(`DISPLAY=${process.env.DISPLAY}, XAUTHORITY=${process.env.XAUTHORITY || 'not set'}`);

  const browser = await chromium.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
  });

  // Create two separate browser contexts (windows)
  log('Opening two browser windows...');

  // Window 1: Scoring Terminal (left side of screen)
  const scoringContext = await browser.newContext({
    viewport: { width: 960, height: 1080 },
  });
  const scoringPage = await scoringContext.newPage();

  // Window 2: Display Terminal (right side of screen)
  const displayContext = await browser.newContext({
    viewport: { width: 960, height: 1080 },
  });
  const displayPage = await displayContext.newPage();

  // Navigate to display terminal first (no login needed)
  log('Opening Display Terminal...');
  try {
    await displayPage.goto(DISPLAY_URL, { waitUntil: 'networkidle', timeout: 15000 });
    log(`Display Terminal loaded: ${displayPage.url()}`);
  } catch (e) {
    log(`Display Terminal load issue: ${e.message}`);
    await displayPage.goto(DISPLAY_URL, { waitUntil: 'domcontentloaded', timeout: 10000 });
  }

  // Login to scoring terminal
  log('Opening Scoring Terminal and logging in as Admin...');
  try {
    await loginAsAdmin(scoringPage);
  } catch (e) {
    log(`Admin login issue: ${e.message}`);
    try {
      await scoringPage.goto(SCORING_URL, { waitUntil: 'domcontentloaded', timeout: 10000 });
    } catch {}
  }

  // Track which scoring page to cycle through
  const scoringPages = [
    `${SCORING_URL}/admin/darts`,
    `${SCORING_URL}/matches`,
    `${SCORING_URL}`,
  ];
  let scoringPageIdx = 0;

  // Take initial screenshots
  await takeScreenshots(scoringPage, displayPage, 'initial');
  log('Initial screenshots taken');

  // Write PID file so the stress test runner can signal us
  const pidFile = path.join(__dirname, '.browser-watcher.pid');
  fs.writeFileSync(pidFile, process.pid.toString());
  log(`PID ${process.pid} written to ${pidFile}`);

  // Set up signal handler for graceful shutdown
  let finalScreenshotsTaken = false;

  async function doFinalScreenshots() {
    if (finalScreenshotsTaken) return;
    finalScreenshotsTaken = true;
    stopping = true;

    log('Taking final screenshots...');
    // Refresh one more time to get the latest state
    try {
      await scoringPage.reload({ waitUntil: 'networkidle', timeout: 10000 });
    } catch {}
    try {
      await displayPage.reload({ waitUntil: 'networkidle', timeout: 10000 });
    } catch {}
    await new Promise(r => setTimeout(r, 2000));

    await takeScreenshots(scoringPage, displayPage, 'final');
    log('Final screenshots saved!');

    // Close browser
    log('Closing browser...');
    await browser.close();

    // Cleanup PID file
    try { fs.unlinkSync(pidFile); } catch {}
    try { fs.unlinkSync(SIGNAL_FILE); } catch {}

    log('Browser watcher finished.');
    process.exit(0);
  }

  process.on('SIGUSR1', doFinalScreenshots);
  process.on('SIGTERM', doFinalScreenshots);
  process.on('SIGINT', doFinalScreenshots);

  // Auto-refresh loop
  log(`Starting auto-refresh loop (every ${REFRESH_INTERVAL_MS / 1000}s)...`);
  log('Watching for stress test completion...');

  let refreshCount = 0;
  while (!stopping) {
    await new Promise(r => setTimeout(r, REFRESH_INTERVAL_MS));

    if (stopping) break;

    refreshCount++;

    // Check if stress test is done (signal file exists)
    if (fs.existsSync(SIGNAL_FILE)) {
      log('Stress test completion signal detected!');
      await doFinalScreenshots();
      break;
    }

    // Refresh scoring page - cycle through different views every 3 refreshes
    try {
      if (refreshCount % 3 === 0) {
        scoringPageIdx = (scoringPageIdx + 1) % scoringPages.length;
        await scoringPage.goto(scoringPages[scoringPageIdx], { waitUntil: 'networkidle', timeout: 10000 });
      } else {
        await scoringPage.reload({ waitUntil: 'networkidle', timeout: 10000 });
      }
    } catch (e) {
      // networkidle timeout is ok, page still refreshed
    }

    // Refresh display terminal
    try {
      await displayPage.reload({ waitUntil: 'networkidle', timeout: 10000 });
    } catch (e) {
      // same
    }

    if (refreshCount % 6 === 0) {
      // Every 30 seconds, take a progress screenshot
      await takeScreenshots(scoringPage, displayPage, `progress-${String(refreshCount).padStart(4, '0')}`);
      log(`Progress screenshot #${refreshCount / 6} taken (refresh #${refreshCount})`);
    } else {
      log(`Refresh #${refreshCount} complete`);
    }
  }
}

main().catch((err) => {
  console.error('Browser watcher error:', err);
  process.exit(1);
});
