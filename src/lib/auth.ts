// Client-side token storage. The backend only accepts bearer tokens (CORS has no
// credentials), so the JWT lives in localStorage.

const TOKEN_KEY = "rag.token";
const USER_KEY = "rag.user";

export interface StoredUser {
  first_name: string;
  last_name: string;
  email: string;
}

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  return storage()?.getItem(TOKEN_KEY) ?? null;
}

export function setToken(token: string) {
  storage()?.setItem(TOKEN_KEY, token);
}

export function getUser(): StoredUser | null {
  const raw = storage()?.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export function setUser(user: StoredUser) {
  storage()?.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  storage()?.removeItem(TOKEN_KEY);
  storage()?.removeItem(USER_KEY);
}

/** Clear credentials and send the browser to /login, remembering where we were. */
export function redirectToLogin() {
  clearAuth();
  if (typeof window === "undefined") return;
  if (window.location.pathname.startsWith("/login")) return;
  const next = window.location.pathname + window.location.search;
  // Intentional hard navigation: called outside React (from fetch helpers) and resets all in-memory state.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = `/login?next=${encodeURIComponent(next)}`;
}

/** Only allow same-origin relative redirects. */
export function safeNext(next: string | null): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/chat";
}
