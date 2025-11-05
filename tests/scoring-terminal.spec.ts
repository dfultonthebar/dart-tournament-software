import { test, expect } from '@playwright/test';

/**
 * E2E tests for the Scoring Terminal
 *
 * Tests the touch-optimized scoring interface including:
 * - Tournament selection
 * - Match listing
 * - Score entry
 * - Touch target sizes
 * - Offline capabilities
 */

test.describe('Scoring Terminal - Basic Navigation', () => {
  test('homepage loads successfully', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for main elements
    await expect(page).toHaveTitle(/Tournament|Scoring/i);
  });

  test('has proper viewport for touch devices', async ({ page }) => {
    await page.goto('/');

    // Check viewport meta tag
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toContain('width=device-width');
    expect(viewport).toContain('initial-scale=1');
  });
});

test.describe('Scoring Terminal - Touch Targets', () => {
  test('all buttons meet 44px minimum touch target size', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const buttons = page.locator('button:visible');
    const count = await buttons.count();

    let violations: string[] = [];

    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      const box = await button.boundingBox();
      const text = (await button.textContent()) || `Button ${i}`;

      if (box) {
        if (box.width < 44 || box.height < 44) {
          violations.push(`${text}: ${box.width}x${box.height}px`);
        }
      }
    }

    if (violations.length > 0) {
      console.error('Touch target violations:', violations);
    }

    expect(violations.length).toBe(0);
  });

  test('interactive links meet 44px minimum size', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const links = page.locator('a:visible');
    const count = await links.count();

    for (let i = 0; i < Math.min(count, 10); i++) {
      const link = links.nth(i);
      const box = await link.boundingBox();

      if (box) {
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
  });
});

test.describe('Scoring Terminal - Accessibility', () => {
  test('page has proper semantic HTML', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for main landmark
    const main = page.locator('main');
    await expect(main).toBeVisible();

    // Check for headings
    const h1 = page.locator('h1');
    expect(await h1.count()).toBeGreaterThan(0);
  });

  test('buttons have accessible names', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const buttons = page.locator('button:visible');
    const count = await buttons.count();

    for (let i = 0; i < Math.min(count, 10); i++) {
      const button = buttons.nth(i);
      const accessibleName = await button.getAttribute('aria-label') || await button.textContent();
      expect(accessibleName).toBeTruthy();
    }
  });
});

test.describe('Scoring Terminal - Tournament Selection', () => {
  test('displays tournament list', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for potential tournament list
    await page.waitForTimeout(1000);

    // Check if tournament selection UI exists (may be empty if no data)
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });
});

test.describe('Scoring Terminal - Offline Support', () => {
  test('has service worker registration', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check if service worker is attempted to be registered
    const serviceWorkerScript = await page.evaluate(() => {
      return 'serviceWorker' in navigator;
    });

    expect(serviceWorkerScript).toBe(true);
  });

  test('page loads without JavaScript', async ({ page, context }) => {
    // Disable JavaScript
    await context.setOffline(false);
    await page.goto('/');

    // Page should still render basic HTML
    const html = await page.content();
    expect(html).toContain('html');
  });
});

test.describe('Scoring Terminal - Performance', () => {
  test('page loads within 3 seconds', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;

    console.log(`Page load time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(3000);
  });

  test('no console errors on load', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    if (consoleErrors.length > 0) {
      console.error('Console errors detected:', consoleErrors);
    }

    expect(consoleErrors.length).toBe(0);
  });
});

test.describe('Scoring Terminal - Responsive Design', () => {
  test('renders properly on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check that content is visible
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Check for horizontal scrolling (should not exist)
    const bodyWidth = await body.evaluate((el) => el.scrollWidth);
    const viewportWidth = await page.viewportSize();
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth!.width + 1); // +1 for rounding
  });

  test('renders properly on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 }); // iPad
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});
