// API configuration - automatically uses the correct host
export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    // Server-side rendering - use localhost
    return 'http://localhost:8000/api'
  }

  // Client-side - use the same hostname as the current page
  const hostname = window.location.hostname
  return `http://${hostname}:8000/api`
}

export const API_BASE_URL = typeof window !== 'undefined'
  ? `http://${window.location.hostname}:8000/api`
  : 'http://localhost:8000/api'
