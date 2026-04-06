import { Router } from 'express';

import { supabaseAdmin } from '../lib/supabase.js';

const router = Router();

/**
 * GET /api/my-clothes
 *
 * Returns all clothing image uploads saved by the currently logged-in user.
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
      .from('image_uploads')
      .select('id, image_urls, created_at')
      .eq('uploaded_by', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({
        error: 'Failed to fetch your clothes from the database.',
        details: error.message,
      });
    }

    return res.status(200).json({
      total: data.length,
      clothes: data,
    });
  } catch {
    return res.status(500).json({ error: 'Unexpected error while fetching your clothes.' });
  }
});

export default router;
