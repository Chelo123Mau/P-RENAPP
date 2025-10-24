// src/api.ts
const BASE = (import.meta as any).env?.VITE_API_URL || "http://localhost:4000";

/** Merge simple de headers */
function mergeHeaders(a: HeadersInit | undefined, b: HeadersInit): HeadersInit {
  return { ...(a as any), ...(b as any) };
}

/** Fetch JSON sin token */
export async function apiJson(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: mergeHeaders(opts.headers, { "Content-Type": "application/json" }),
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* puede no ser JSON */ }
  return { ok: res.ok, status: res.status, data };
}

/** Fetch JSON con token (Authorization: Bearer ...) */
export async function authJson(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("token") || "";
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: mergeHeaders(opts.headers, {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    }),
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* puede no ser JSON */ }
  return { ok: res.ok, status: res.status, data };
}

/**
 * Fetch genérico con token que devuelve el Response crudo.
 * Útil para descargar blobs (PDF) u otros tipos no-JSON.
 */
export async function authFetch(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("token") || "";
  return fetch(`${BASE}${path}`, {
    ...opts,
    headers: mergeHeaders(opts.headers, {
      Authorization: token ? `Bearer ${token}` : "",
    }),
  });
}

/** Atajo simple: ¿hay token? */
export function isLoggedIn() {
  return Boolean(localStorage.getItem("token"));
}


