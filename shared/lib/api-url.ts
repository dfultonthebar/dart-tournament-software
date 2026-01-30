/**
 * Shared API URL helpers.
 *
 * Uses window.location.hostname so that clients connecting from other
 * devices on the LAN (e.g. Raspberry Pi deployment) reach the correct
 * backend.  Falls back to localhost for server-side rendering.
 */

export function getApiUrl(): string {
  if (typeof window !== 'undefined') {
    return `http://${window.location.hostname}:8000/api`;
  }
  return 'http://localhost:8000/api';
}

export function getWsUrl(): string {
  if (typeof window !== 'undefined') {
    return `ws://${window.location.hostname}:8000/ws`;
  }
  return 'ws://localhost:8000/ws';
}
