// Shared API base URL - reads from VITE_API_URL env var or defaults to localhost for development.
// Set VITE_API_URL in your .env.local or production environment.
export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
