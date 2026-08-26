// Shared API base URL - reads from VITE_API_URL env var or defaults to empty string for seamless Vite proxying across mobile/tunnels.
export const API_BASE = import.meta.env.VITE_API_URL || '';
