import { Router } from 'express';

import { supabaseAdmin, supabaseAuth } from '../lib/supabase.js';

const router = Router();
const cookieName = 'auth_token';
const cookieSecure = String(process.env.COOKIE_SECURE ?? 'true') !== 'false';

function normalizeUsername(username) {
  return username.trim().toLowerCase();
}

function normalizeName(name) {
  if (typeof name !== 'string') {
    return '';
  }

  return name.trim();
}

function isValidCredentialInput(username, password) {
  return typeof username === 'string' && typeof password === 'string' && username.trim().length > 0 && password.length > 0;
}

async function findUserByUsername(username) {
  const normalizedUsername = normalizeUsername(username);
  const { data, error } = await supabaseAdmin.auth.admin.listUsers();

  if (error) {
    throw error;
  }

  return data.users.find((user) => normalizeUsername(user.user_metadata?.username ?? '') === normalizedUsername) ?? null;
}

function setAuthCookie(res, token) {
  res.cookie(cookieName, token, {
    httpOnly: true, // Prevents client-side JavaScript from reading the cookie.
    secure: cookieSecure, // Sends the cookie only over HTTPS connections when enabled.
    sameSite: 'strict', // Reduces CSRF risk by blocking cross-site cookie sending.
    maxAge: 60 * 60 * 1000,
  });
}

router.post('/register', async (req, res) => {
  const { username, password, name } = req.body ?? {};

  if (!isValidCredentialInput(username, password)) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const normalizedUsername = normalizeUsername(username);
  const normalizedName = normalizeName(name);
  const syntheticEmail = `${normalizedUsername}@local.invalid`;

  const { error } = await supabaseAdmin.auth.admin.createUser({
    email: syntheticEmail,
    password,
    email_confirm: true,
    user_metadata: {
      username: normalizedUsername,
      name: normalizedName,
    },
  });

  if (error) {
    return res.status(401).json({ message: error.message });
  }

  const signInResult = await supabaseAuth.auth.signInWithPassword({
    email: syntheticEmail,
    password,
  });

  if (signInResult.error || !signInResult.data.session?.access_token) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  setAuthCookie(res, signInResult.data.session.access_token);

  return res.status(200).json({ message: 'Registration successful' });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body ?? {};

  if (!isValidCredentialInput(username, password)) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  try {
    const user = await findUserByUsername(username);

    if (!user?.email) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const { data, error } = await supabaseAuth.auth.signInWithPassword({
      email: user.email,
      password,
    });

    if (error || !data.session?.access_token) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    setAuthCookie(res, data.session.access_token);

    return res.status(200).json({ message: 'Login successful' });
  } catch {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
});

export default router;