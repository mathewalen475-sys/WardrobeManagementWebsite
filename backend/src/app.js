import express from 'express';
import dotenv from 'dotenv';

import authRouter from './routes/auth.routes.js';
import wardrobeRouter from './routes/wardrobe.routes.js';

dotenv.config();

const app = express();

app.set('trust proxy', 1);
app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api', authRouter);
app.use('/api', wardrobeRouter);

export default app;