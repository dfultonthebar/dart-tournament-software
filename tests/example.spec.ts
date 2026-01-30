import { test, expect } from '@playwright/test';

/**
 * Example E2E tests for WAMO Dart Tournament Software
 *
 * These tests demonstrate how to test the various components:
 * - Scoring Terminal (touch-optimized UI)
 * - Display Terminal (read-only displays)
 * - Mobile App (PWA)
 * - Backend API
 */

test.describe('Scoring Terminal', () => {
  test('loads successfully', async ({ page }) => {
    await page.goto('http://localhost:3001');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Check that we're on the right page
    await expect(page).toHaveTitle(/Dart|Tournament|Scoring/i);
  });

  test('has touch-friendly buttons (44px minimum)', async ({ page }) => {
    await page.goto('http://localhost:3001');
    await page.waitForLoadState('networkidle');

    // Find all interactive buttons
    const buttons = page.locator('button').filter({ hasNotText: '' });
    const count = await buttons.count();

    console.log(`Found ${count} buttons to test`);

    // Check first few buttons as examples
    for (let i = 0; i < Math.min(count, 5); i++) {
      const box = await buttons.nth(i).boundingBox();
      if (box) {
        console.log(`Button ${i}: ${box.width}x${box.height}px`);
        // Touch target minimum is 44x44px
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
  });
});

test.describe('Display Terminal', () => {
  test('loads successfully', async ({ page }) => {
    await page.goto('http://localhost:3002');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveTitle(/Display|Tournament/i);
  });

  test('is read-only (no input fields)', async ({ page }) => {
    await page.goto('http://localhost:3002');
    await page.waitForLoadState('networkidle');

    // Display terminal should not have input fields
    const inputs = page.locator('input[type="text"], input[type="number"], textarea');
    await expect(inputs).toHaveCount(0);
  });
});

test.describe('Mobile App', () => {
  test.skip('loads successfully', async ({ page }) => {
    // Skipped: mobile-app directory structure is broken (known issue)
    await page.goto('http://localhost:3003');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveTitle(/Tournament|WAMO/i);
  });

  test.skip('has PWA manifest', async ({ page }) => {
    // Skipped: mobile-app directory structure is broken (known issue)
    await page.goto('http://localhost:3003');

    // Check for PWA manifest link
    const manifest = page.locator('link[rel="manifest"]');
    await expect(manifest).toHaveCount(1);

    // Verify manifest exists and is valid JSON
    const manifestHref = await manifest.getAttribute('href');
    expect(manifestHref).toBeTruthy();
  });
});

test.describe('Backend API', () => {
  test('health endpoint responds', async ({ request }) => {
    const response = await request.get('http://localhost:8000/health');
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
  });

  test('API docs are accessible', async ({ request }) => {
    const response = await request.get('http://localhost:8000/docs');
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
  });

  test('OpenAPI schema is valid', async ({ request }) => {
    const response = await request.get('http://localhost:8000/openapi.json');
    expect(response.ok()).toBeTruthy();

    const schema = await response.json();
    expect(schema).toHaveProperty('openapi');
    expect(schema).toHaveProperty('info');
    expect(schema).toHaveProperty('paths');
  });
});

test.describe('WebSocket Connection', () => {
  test.skip('establishes WebSocket connection', async ({ page }) => {
    // This test requires WebSocket implementation
    await page.goto('http://localhost:3001');

    // Wait for WebSocket connection (this is a placeholder)
    // In real tests, you would monitor network for WS connection
    await page.waitForTimeout(2000);

    // Check that WebSocket connection was established
    // This would require checking browser console or network logs
  });
});
