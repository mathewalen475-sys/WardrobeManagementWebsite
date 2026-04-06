import { Router } from 'express';

import { supabaseAdmin } from '../lib/supabase.js';

const router = Router();

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

export default router;
