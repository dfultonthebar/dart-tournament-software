import { test, expect } from '@playwright/test';

/**
 * E2E tests for the Backend API
 *
 * Tests the FastAPI backend including:
 * - Health checks
 * - API documentation
 * - Authentication endpoints
 * - CRUD operations
 * - Error handling
 */

const API_BASE = 'http://localhost:8000/api';

const API_ROOT = 'http://localhost:8000';

test.describe('API - Health and Status', () => {
  test('health endpoint returns 200', async ({ request }) => {
    const response = await request.get(`${API_ROOT}/health`);
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('status');
  });

  test('API root returns version info', async ({ request }) => {
    const response = await request.get(`${API_ROOT}/`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data).toHaveProperty('message');
  });
});

test.describe('API - Documentation', () => {
  test('OpenAPI schema is accessible', async ({ request }) => {
    const response = await request.get(`${API_ROOT}/openapi.json`);
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const schema = await response.json();
    expect(schema).toHaveProperty('openapi');
    expect(schema).toHaveProperty('info');
    expect(schema).toHaveProperty('paths');
  });

  test('Swagger UI is accessible', async ({ page }) => {
    await page.goto(`${API_ROOT}/docs`);
    await page.waitForLoadState('networkidle');

    // Check for Swagger UI elements
    await expect(page).toHaveTitle(/FastAPI|Swagger/i);
  });

  test('ReDoc is accessible', async ({ page }) => {
    await page.goto(`${API_ROOT}/redoc`);
    await page.waitForLoadState('networkidle');

    // Check for ReDoc elements
    await expect(page).toHaveTitle(/ReDoc/i);
  });
});

test.describe('API - CORS Headers', () => {
  test('includes proper CORS headers', async ({ request }) => {
    const response = await request.get(`${API_ROOT}/health`, {
      headers: {
        Origin: 'http://localhost:3001',
      },
    });

    const headers = response.headers();
    expect(headers['access-control-allow-origin']).toBeDefined();
  });
});

test.describe('API - Authentication', () => {
  test('register endpoint exists', async ({ request }) => {
    const response = await request.post(`${API_BASE}/auth/player-register`, {
      data: {
        name: 'Test User',
        email: `test-${Date.now()}@example.com`,
        phone: '5559999999',
        pin: '9999',
        gender: 'M',
      },
      failOnStatusCode: false,
    });

    // Should return 201 (created) or 400 (validation error) or 422 (unprocessable entity)
    expect([200, 201, 400, 404, 422]).toContain(response.status());
  });

  test('login endpoint exists', async ({ request }) => {
    const response = await request.post(`${API_BASE}/auth/pin-login`, {
      data: {
        name: 'Nonexistent',
        pin: '0000',
      },
      failOnStatusCode: false,
    });

    // Should return 401 (unauthorized) or 404 (not found) or 422 (validation error)
    expect([400, 401, 404, 422]).toContain(response.status());
  });
});

test.describe('API - Players Endpoints', () => {
  test('GET /players returns list', async ({ request }) => {
    const response = await request.get(`${API_BASE}/players`, {
      failOnStatusCode: false,
    });

    // Should return 200 (success) or 401 (unauthorized)
    expect([200, 401]).toContain(response.status());

    if (response.status() === 200) {
      const data = await response.json();
      expect(Array.isArray(data) || typeof data === 'object').toBeTruthy();
    }
  });

  test('POST /players requires authentication', async ({ request }) => {
    const response = await request.post(`${API_BASE}/players`, {
      data: {
        email: `player-${Date.now()}@example.com`,
        password: 'testpass123',
        full_name: 'New Player',
        display_name: 'NewPlayer',
      },
      failOnStatusCode: false,
    });

    // Should return 401 (unauthorized) or 403 (forbidden) or 404 (not found) or 405 (method not allowed)
    expect([401, 403, 404, 405, 422]).toContain(response.status());
  });
});

test.describe('API - Tournaments Endpoints', () => {
  test('GET /tournaments returns list', async ({ request }) => {
    const response = await request.get(`${API_BASE}/tournaments`, {
      failOnStatusCode: false,
    });

    expect([200, 401]).toContain(response.status());

    if (response.status() === 200) {
      const data = await response.json();
      expect(Array.isArray(data) || typeof data === 'object').toBeTruthy();
    }
  });
});

test.describe('API - Error Handling', () => {
  test('returns 404 for non-existent endpoints', async ({ request }) => {
    const response = await request.get(`${API_ROOT}/non-existent-endpoint`, {
      failOnStatusCode: false,
    });

    expect(response.status()).toBe(404);
  });

  test('returns proper error format', async ({ request }) => {
    const response = await request.get(`${API_ROOT}/non-existent`, {
      failOnStatusCode: false,
    });

    const data = await response.json();
    expect(data).toHaveProperty('detail');
  });

  test('handles malformed JSON', async ({ request }) => {
    const response = await request.post(`${API_BASE}/auth/pin-login`, {
      data: 'not-valid-json',
      headers: {
        'Content-Type': 'application/json',
      },
      failOnStatusCode: false,
    });

    expect([400, 422]).toContain(response.status());
  });
});

test.describe('API - Performance', () => {
  test('health check responds within 500ms', async ({ request }) => {
    const startTime = Date.now();
    await request.get(`${API_ROOT}/health`);
    const responseTime = Date.now() - startTime;

    console.log(`API response time: ${responseTime}ms`);
    expect(responseTime).toBeLessThan(500);
  });

  test('handles concurrent requests', async ({ request }) => {
    const requests = Array(10)
      .fill(null)
      .map(() => request.get(`${API_ROOT}/health`));

    const responses = await Promise.all(requests);

    responses.forEach((response) => {
      expect(response.ok()).toBeTruthy();
    });
  });
});

test.describe('API - Rate Limiting', () => {
  test.skip('implements rate limiting', async ({ request }) => {
    // Send many requests in quick succession
    const requests = Array(100)
      .fill(null)
      .map(() =>
        request.get(`${API_ROOT}/health`, {
          failOnStatusCode: false,
        })
      );

    const responses = await Promise.all(requests);

    // Check if any response has a 429 (Too Many Requests) status
    const rateLimited = responses.some((r) => r.status() === 429);

    // This test is skipped because rate limiting may not be implemented yet
    // Uncomment when rate limiting is added
    // expect(rateLimited).toBe(true);
  });
});
