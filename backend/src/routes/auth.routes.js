import { Router } from 'express';

import { supabaseAdmin, supabaseAuth } from '../lib/supabase.js';

const router = Router();
const cookieName = 'auth_token';
const cookieSecure = String(process.env.COOKIE_SECURE ?? 'true') !== 'false';

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function normalizeName(name) {
  if (typeof name !== 'string') {
    return '';
  }

  return name.trim();
}

function isValidRegistrationInput(username, password, name) {
  return (
    isValidEmail(username) &&
    typeof password === 'string' &&
    password.length >= 6 &&
    typeof name === 'string' &&
    name.trim().length > 0
  );
}

function isValidLoginInput(username, password) {
  return (
    typeof username === 'string' &&
    username.trim().length > 0 &&
    typeof password === 'string' &&
    password.length > 0
  );
}

async function findUserByIdentifier(identifier) {
  const normalizedIdentifier = identifier.trim().toLowerCase();
  const { data, error } = await supabaseAdmin.auth.admin.listUsers();

  if (error) {
    throw error;
  }

  return (
    data.users.find((user) => user.email?.toLowerCase() === normalizedIdentifier) ??
    data.users.find((user) => (user.user_metadata?.username ?? '').toLowerCase() === normalizedIdentifier) ??
    null
  );
}

function setAuthCookie(res, token) {
  res.cookie(cookieName, token, {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: 'strict',
    maxAge: 60 * 60 * 1000,
  });
}

router.post('/register', async (req, res) => {
  const { username, password, name } = req.body ?? {};

  if (!isValidRegistrationInput(username, password, name)) {
    return res.status(400).json({
      message: 'Invalid input. Provide a valid email as username, a password (min 6 chars), and a name.',
    });
  }

  const email = username.trim().toLowerCase();
  const trimmedName = normalizeName(name);

  try {
    const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        username: email,
        name: trimmedName,
      },
    });

    if (createError) {
      return res.status(400).json({ message: createError.message });
    }

    return res.status(201).json({
      message: 'Registration successful. Please log in.',
      user: {
        id: createData.user.id,
        email: createData.user.email,
        name: trimmedName,
      },
    });
  } catch {
    return res.status(500).json({ message: 'Registration failed. Please try again.' });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body ?? {};

  if (!isValidLoginInput(username, password)) {
    return res.status(400).json({ message: 'Invalid input. Provide a valid email and password.' });
  }

  const identifier = username.trim();
  const normalizedIdentifier = identifier.toLowerCase();

  try {
    let signInResult = null;

    if (isValidEmail(identifier)) {
      signInResult = await supabaseAuth.auth.signInWithPassword({
        email: normalizedIdentifier,
        password,
      });
    }

    if (!signInResult || signInResult.error || !signInResult.data.session?.access_token) {
      const user = await findUserByIdentifier(identifier);

      if (!user?.email) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      signInResult = await supabaseAuth.auth.signInWithPassword({
        email: user.email,
        password,
      });
    }

    const { data, error } = signInResult;

    if (error || !data.session?.access_token) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    setAuthCookie(res, data.session.access_token);

    return res.status(200).json({
      message: 'Login successful',
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name || null,
      },
    });
  } catch {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
});

export default router;