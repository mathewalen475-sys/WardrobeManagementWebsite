import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabaseAdmin } from '../lib/supabase.js';

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fallbackScheduleFile = path.resolve(__dirname, '../../public/fallback-schedules.json');

function readFallbackSchedules() {
  try {
    if (!fs.existsSync(fallbackScheduleFile)) {
      return [];
    }

    const raw = fs.readFileSync(fallbackScheduleFile, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

router.get('/user/profile', (req, res) => {
  const username = req.user?.email || req.user?.user_metadata?.username || null;
  const name = req.user?.user_metadata?.name || null;

  return res.status(200).json({
    username,
    name,
  });
});

router.get('/user/schedule', async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated.' });
    }

    const { data, error } = await supabaseAdmin
      .from('outfit_schedules')
      .select('id, scheduled_date, shirt_image_url, shirt_name, shirt_color, shirt_color_hex, pants_image_url, pants_name, score, reason, created_at')
      .eq('user_id', userId)
      .order('scheduled_date', { ascending: true });

    if (!error) {
      return res.status(200).json(data || []);
    }

    if (error?.code === '42P01' || String(error?.message || '').toLowerCase().includes('outfit_schedules')) {
      const rows = readFallbackSchedules().filter((item) => item.user_id === userId);
      return res.status(200).json(rows);
    }

    if (error) {
      return res.status(500).json({
        error: 'Failed to fetch user schedule.',
        details: error.message,
      });
    }

    return res.status(200).json(data || []);
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to fetch user schedule.',
      details: error?.message || 'Unknown error.',
    });
  }
});

export default router;
