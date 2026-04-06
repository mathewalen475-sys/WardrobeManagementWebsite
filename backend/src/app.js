import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';

import authRouter from './routes/auth.routes.js';
import wardrobeRouter from './routes/wardrobe.routes.js';
import uploadRouter from './routes/upload.routes.js';
import { requireAuth } from './middleware/auth.middleware.js';

dotenv.config();

const app = express();

/* ── Core middleware ─────────────────────────────────── */

app.set('trust proxy', 1);

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(cookieParser());
app.use(express.json());
app.use('/uploads', express.static(path.resolve(process.cwd(), 'public', 'uploads')));

/* ── Health check ────────────────────────────────────── */

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

/* ── Public routes (auth) ────────────────────────────── */

app.use('/api', authRouter);
app.use('/api', uploadRouter);

/* ── Logout ──────────────────────────────────────────── */

app.post('/api/logout', (_req, res) => {
  res.clearCookie('auth_token', {
    httpOnly: true,
    secure: String(process.env.COOKIE_SECURE ?? 'true') !== 'false',
    sameSite: 'strict',
  });
  return res.status(200).json({ message: 'Logged out successfully' });
});

/* ── Protected routes (require login) ────────────────── */

app.use('/api', requireAuth, wardrobeRouter);

export default app;