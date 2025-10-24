export type Role = 'user' | 'admin' | 'reviewer';

export function getStoredUser(): any | null {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getStoredToken(): string {
  return localStorage.getItem('token') || '';
}

export function normalizeRole(role: any): Role {
  const r = String(role || '').trim().toLowerCase();
  if (r === 'admin' || r === 'administrator') return 'admin';
  if (r === 'review' || r === 'reviewer' || r === 'revisor') return 'reviewer';
  return 'user';
}

export function getCurrentRole(): Role {
  const u = getStoredUser();
  return normalizeRole(u?.role);
}

export function isLoggedIn(): boolean {
  return !!getStoredToken();
}

export function logoutAndGoHome() {
  localStorage.clear();
  window.location.href = '/';
}
