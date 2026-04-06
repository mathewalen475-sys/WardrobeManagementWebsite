import { supabaseAdmin } from '../lib/supabase.js';

/**
 * Express middleware that verifies the Supabase JWT.
 *
 * Token lookup order:
 *   1. `auth_token` cookie  (set by our login/register routes)
 *   2. `Authorization: Bearer <token>` header  (for API / Postman testing)
 *
 * On success → attaches `req.user` (Supabase user object) and calls next().
 * On failure → returns 401 JSON.
 */
export async function requireAuth(req, res, next) {
  const token =
    req.cookies?.auth_token ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null);

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
    }

    req.user = data.user;
    return next();
  } catch {
    return res.status(401).json({ error: 'Authentication failed.' });
  }
}
