const configuredApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const apiBaseUrl = import.meta.env.DEV ? '/api' : configuredApiUrl.replace(/\/$/, '');

export function resolveApiUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  if (import.meta.env.DEV) return path;
  return `${apiBaseUrl}${path.replace(/^\/api/, '')}`;
}

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  const result = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      result?.message || 'The request could not be completed. Please try again.',
      response.status,
      result?.error?.code,
    );
  }

  return result;
}
