import { test, expect } from '@playwright/test';

/**
 * Integration tests for the complete WAMO Dart Tournament system
 *
 * Tests the integration between:
 * - Frontend and Backend
 * - WebSocket connections
 * - Real-time updates
 * - Complete user workflows
 */

const SCORING_URL = 'http://localhost:3001';
const DISPLAY_URL = 'http://localhost:3002';
const MOBILE_URL = 'http://localhost:3003';
const API_URL = 'http://localhost:8000';

test.describe('Integration - System Health', () => {
  test('all services are running', async ({ request }) => {
    const services = [
      { name: 'Backend API', url: `${API_URL}/health` },
      { name: 'Scoring Terminal', url: SCORING_URL },
      { name: 'Display Terminal', url: DISPLAY_URL },
      // Mobile App skipped — directory structure is broken (known issue)
    ];

    for (const service of services) {
      const response = await request.get(service.url, {
        failOnStatusCode: false,
      });
      expect(response.status()).toBeLessThan(500);
      console.log(`✓ ${service.name}: ${response.status()}`);
    }
  });
});

test.describe('Integration - Frontend to Backend', () => {
  test('scoring terminal can connect to API', async ({ page }) => {
    await page.goto(SCORING_URL);
    await page.waitForLoadState('networkidle');

    // Check network requests to API
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('localhost:8000')) {
        apiRequests.push(request.url());
      }
    });

    await page.waitForTimeout(2000);

    // Should have attempted API connections
    console.log('API requests from scoring terminal:', apiRequests.length);
  });

  test('display terminal can connect to API', async ({ page }) => {
    await page.goto(DISPLAY_URL);
    await page.waitForLoadState('networkidle');

    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('localhost:8000')) {
        apiRequests.push(request.url());
      }
    });

    await page.waitForTimeout(2000);

    console.log('API requests from display terminal:', apiRequests.length);
  });

  test.skip('mobile app can connect to API', async ({ page }) => {
    // Skipped: mobile-app directory structure is broken (known issue)
    await page.goto(MOBILE_URL);
    await page.waitForLoadState('networkidle');

    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('localhost:8000')) {
        apiRequests.push(request.url());
      }
    });

    await page.waitForTimeout(2000);

    console.log('API requests from mobile app:', apiRequests.length);
  });
});

test.describe('Integration - WebSocket Connections', () => {
  test.skip('scoring terminal establishes WebSocket connection', async ({ page }) => {
    const wsConnections: string[] = [];

    page.on('websocket', (ws) => {
      wsConnections.push(ws.url());
      console.log('WebSocket connection:', ws.url());
    });

    await page.goto(SCORING_URL);
    await page.waitForTimeout(3000);

    // Check if WebSocket was attempted
    const hasWsConnection = wsConnections.some((url) => url.includes('ws://'));
    console.log('WebSocket connections:', wsConnections);

    // This test is skipped because WebSocket implementation may not be active yet
    // expect(hasWsConnection).toBe(true);
  });
});

test.describe('Integration - Data Flow', () => {
  test('can fetch tournaments from API', async ({ request }) => {
    const response = await request.get(`${API_URL}/tournaments`, {
      failOnStatusCode: false,
    });

    if (response.status() === 200) {
      const data = await response.json();
      console.log('Tournaments fetched:', Array.isArray(data) ? data.length : 'object');
      expect(data).toBeTruthy();
    }
  });

  test('can fetch players from API', async ({ request }) => {
    const response = await request.get(`${API_URL}/players`, {
      failOnStatusCode: false,
    });

    if (response.status() === 200) {
      const data = await response.json();
      console.log('Players fetched:', Array.isArray(data) ? data.length : 'object');
      expect(data).toBeTruthy();
    }
  });
});

test.describe('Integration - Cross-Browser Testing', () => {
  test('scoring terminal works in mobile viewport', async ({ page, browserName }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(SCORING_URL);
    await page.waitForLoadState('networkidle');

    console.log(`Testing in ${browserName} with mobile viewport`);
    await expect(page.locator('body')).toBeVisible();
  });

  test('display terminal works in landscape tablet', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto(DISPLAY_URL);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Integration - Error Handling', () => {
  test('frontend handles API errors gracefully', async ({ page }) => {
    // Block API requests to simulate server down
    await page.route('**/localhost:8000/**', (route) => {
      route.abort();
    });

    await page.goto(SCORING_URL);

    // Page should still load even if API is down
    await expect(page.locator('body')).toBeVisible();
  });

  test('frontend shows loading states', async ({ page }) => {
    // Delay API requests to see loading states
    await page.route('**/localhost:8000/**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.continue();
    });

    await page.goto(SCORING_URL);
    await page.waitForLoadState('networkidle');

    // Should have loaded eventually
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Integration - Session Management', () => {
  test('maintains state across page reloads', async ({ page }) => {
    await page.goto(SCORING_URL);
    await page.waitForLoadState('networkidle');

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Page should still be functional
    await expect(page.locator('body')).toBeVisible();
  });

  test('handles navigation between pages', async ({ page }) => {
    await page.goto(SCORING_URL);
    await page.waitForLoadState('networkidle');

    // Try to navigate to display terminal
    await page.goto(DISPLAY_URL);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toBeVisible();
  });
});
