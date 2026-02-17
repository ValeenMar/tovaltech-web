// File: /src/utils/authHelper.js
// Helper para manejar el token de sesión (cookie + localStorage fallback)

const TOKEN_KEY = "tt_token";

export function getAuthHeaders() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function saveAuthToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

/**
 * Fetch autenticado: incluye cookie + Authorization header (Bearer token).
 * Úsalo en lugar de fetch para endpoints /api que requieren auth.
 */
export async function authFetch(url, options = {}) {
  const headers = {
    ...getAuthHeaders(),
    ...(options.headers || {}),
  };
  return fetch(url, {
    credentials: "include",
    ...options,
    headers,
  });
}