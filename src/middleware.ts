// Auth middleware is intentionally minimal.
// Supabase JS v2 (browser) stores sessions in localStorage, not HTTP cookies,
// so server-side session verification requires @supabase/ssr which is not yet
// configured. Route protection is handled client-side in each layout instead.
export function middleware() {
  // pass-through — no redirects
}

export const config = {
  matcher: [], // disabled
};
