export type MeDto = { role?: string; isApproved?: boolean | null };

export function decideHome(me: MeDto) {
  const role = String(me?.role || '').toLowerCase();
  const approved = Boolean(me?.isApproved);

  if (role === 'admin' || role === 'reviewer') return '/review';
  if (!approved) return '/register';
  return '/panel';
}
