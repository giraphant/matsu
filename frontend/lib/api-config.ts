// API configuration for different environments
export const API_BASE_URL =
  typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:9988' // Development: call backend directly
    : ''; // Production: same origin (static files served by backend)

export function getApiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}
