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

function writeFallbackSchedules(rows) {
  try {
    const dir = path.dirname(fallbackScheduleFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fallbackScheduleFile, JSON.stringify(rows, null, 2), 'utf8');
    return true;
  } catch {
    return false;
  }
}

function normalizeIsoDate(input) {
  const value = String(input || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return value;
}

/**
 * GET /api/my-clothes
 *
 * Returns all wardrobe outfit pairs saved by the currently logged-in user.
 * Each pair contains a shirt image + pants image with score and reason.
 * Sorted by most recent first.
 *
 * Requires: auth (requireAuth middleware applied in app.js)
 */
router.get('/my-clothes', async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated.' });
    }

    const { data, error } = await supabaseAdmin
      .from('wardrobe_pairs')
      .select('id, rank, shirt_image_url, shirt_name, pants_image_url, pants_name, score, reason, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({
        error: 'Failed to fetch your clothes from the database.',
        details: error.message,
      });
    }

    /* ── Group pairs by analysis session (same created_at timestamp) ── */
    const sessionsMap = new Map();

    for (const pair of data) {
      const sessionKey = pair.created_at;

      if (!sessionsMap.has(sessionKey)) {
        sessionsMap.set(sessionKey, {
          analyzedAt: pair.created_at,
          pairs: [],
        });
      }

      sessionsMap.get(sessionKey).pairs.push({
        id: pair.id,
        rank: pair.rank,
        shirt: {
          imageUrl: pair.shirt_image_url,
          name: pair.shirt_name,
        },
        pants: {
          imageUrl: pair.pants_image_url,
          name: pair.pants_name,
        },
        score: pair.score,
        reason: pair.reason,
      });
    }

    /* ── Sort pairs within each session by rank ── */
    const sessions = [...sessionsMap.values()].map((session) => ({
      ...session,
      pairs: session.pairs.sort((a, b) => a.rank - b.rank),
    }));

    return res.status(200).json({
      totalPairs: data.length,
      totalSessions: sessions.length,
      sessions,
    });
  } catch {
    return res.status(500).json({ error: 'Unexpected error while fetching your clothes.' });
  }
});

router.post('/clothes/schedule', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated.' });
    }

    const selectedOutfitId = req.body?.selectedOutfitId;
    const scheduledDate = normalizeIsoDate(req.body?.scheduledDate);

    if (!selectedOutfitId || !scheduledDate) {
      return res.status(400).json({ error: 'selectedOutfitId and valid scheduledDate (YYYY-MM-DD) are required.' });
    }

    const { data: selectedOutfit, error: selectedError } = await supabaseAdmin
      .from('selected_outfits')
      .select('id, user_id, shirt_image_url, shirt_name, shirt_color, shirt_color_hex, pants_image_url, pants_name, score, reason')
      .eq('id', selectedOutfitId)
      .eq('user_id', userId)
      .single();

    let selected = selectedOutfit;
    if (selectedError || !selectedOutfit) {
      // Backward-compatible fallback if selected_outfits table does not exist.
      const { data: legacySelected, error: legacyError } = await supabaseAdmin
        .from('wardrobe_pairs')
        .select('id, user_id, shirt_image_url, shirt_name, pants_image_url, pants_name, score, reason')
        .eq('id', selectedOutfitId)
        .eq('user_id', userId)
        .single();

      if (legacyError || !legacySelected) {
        return res.status(404).json({
          error: 'Selected outfit not found for this user.',
          details: legacyError?.message || selectedError?.message || 'No selected outfit found.',
        });
      }

      selected = {
        ...legacySelected,
        shirt_color: 'unknown',
        shirt_color_hex: '#8a8a8a',
      };
    }

    const { data, error } = await supabaseAdmin
      .from('outfit_schedules')
      .upsert({
        user_id: userId,
        scheduled_date: scheduledDate,
        selected_outfit_id: selected.id,
        shirt_image_url: selected.shirt_image_url,
        shirt_name: selected.shirt_name,
        shirt_color: selected.shirt_color || 'unknown',
        shirt_color_hex: selected.shirt_color_hex || '#8a8a8a',
        pants_image_url: selected.pants_image_url,
        pants_name: selected.pants_name,
        score: selected.score,
        reason: selected.reason,
      }, {
        onConflict: 'user_id,scheduled_date',
      })
      .select('id, user_id, scheduled_date, selected_outfit_id, shirt_image_url, shirt_name, shirt_color, shirt_color_hex, pants_image_url, pants_name, score, reason, created_at')
      .single();

    if (!error && data) {
      return res.status(200).json({
        message: 'Outfit scheduled successfully.',
        schedule: data,
      });
    }

    if (error?.code === '42P01' || String(error?.message || '').toLowerCase().includes('outfit_schedules')) {
      const rows = readFallbackSchedules();
      const row = {
        id: `${userId}-${scheduledDate}`,
        user_id: userId,
        scheduled_date: scheduledDate,
        selected_outfit_id: selected.id,
        shirt_image_url: selected.shirt_image_url,
        shirt_name: selected.shirt_name,
        shirt_color: selected.shirt_color || 'unknown',
        shirt_color_hex: selected.shirt_color_hex || '#8a8a8a',
        pants_image_url: selected.pants_image_url,
        pants_name: selected.pants_name,
        score: selected.score,
        reason: selected.reason,
        created_at: new Date().toISOString(),
      };

      const filtered = rows.filter((item) => !(item.user_id === userId && item.scheduled_date === scheduledDate));
      filtered.push(row);

      if (!writeFallbackSchedules(filtered)) {
        return res.status(500).json({
          error: 'Failed to schedule outfit.',
          details: 'Fallback schedule store write failed.',
        });
      }

      return res.status(200).json({
        message: 'Outfit scheduled successfully (fallback mode).',
        schedule: row,
      });
    }

    if (error || !data) {
      return res.status(500).json({
        error: 'Failed to schedule outfit.',
        details: error?.message || 'Unknown database error.',
      });
    }

    return res.status(200).json({ message: 'Outfit scheduled successfully.', schedule: data });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to schedule outfit.',
      details: error?.message || 'Unknown error.',
    });
  }
});

router.get('/clothes/schedule', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated.' });
    }

    const { data, error } = await supabaseAdmin
      .from('outfit_schedules')
      .select('id, scheduled_date, selected_outfit_id, shirt_image_url, shirt_name, shirt_color, shirt_color_hex, pants_image_url, pants_name, score, reason, created_at')
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
        error: 'Failed to fetch scheduled outfits.',
        details: error.message,
      });
    }

    return res.status(200).json(data || []);
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to fetch scheduled outfits.',
      details: error?.message || 'Unknown error.',
    });
  }
});

export default router;
