import { Router } from 'express';
import multer from 'multer';
import Groq from 'groq-sdk';

import { supabaseAdmin } from '../lib/supabase.js';
import { uploadToSupabaseStorage } from '../lib/storage.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 2,
    fileSize: 10 * 1024 * 1024,
  },
});

const MANNEQUIN_PROFILES = {
  'male-1': { label: 'Male', bodyType: 'athletic male mannequin, standing straight, neutral pose' },
  'female-1': { label: 'Female', bodyType: 'female mannequin, standing straight, neutral pose' },
  'neutral-1': { label: 'Neutral', bodyType: 'gender-neutral mannequin, standing straight, neutral pose' },
  'male-2': { label: 'Casual Male', bodyType: 'casual male figure, relaxed standing pose' },
  'female-2': { label: 'Casual Female', bodyType: 'casual female figure, relaxed standing pose' },
};

function toDataUri(file) {
  const mime = file.mimetype || 'application/octet-stream';
  const base64 = file.buffer.toString('base64');
  return `data:${mime};base64,${base64}`;
}

function getGroqApiKeys() {
  const keys = [];
  if (typeof process.env.GROQ_API_KEYS === 'string' && process.env.GROQ_API_KEYS.trim().length > 0) {
    keys.push(...process.env.GROQ_API_KEYS.split(',').map((v) => v.trim()).filter(Boolean));
  }
  if (typeof process.env.GROQ_API_KEY === 'string' && process.env.GROQ_API_KEY.trim().length > 0) {
    keys.push(process.env.GROQ_API_KEY.trim());
  }
  return [...new Set(keys)];
}

function isGroqLimitError(error) {
  const status = error?.status || error?.response?.status || error?.code;
  const message = String(error?.message || '').toLowerCase();
  return (
    status === 429 ||
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('quota') ||
    message.includes('exceeded')
  );
}

async function callGroqWithRetry({ groqKeys, model, messages, temperature }) {
  let lastError = null;
  for (const apiKey of groqKeys) {
    const groq = new Groq({ apiKey });
    try {
      return await groq.chat.completions.create({ model, messages, temperature });
    } catch (error) {
      lastError = error;
      if (!isGroqLimitError(error)) throw error;
    }
  }
  const err = new Error(lastError?.message || 'All Groq API keys exhausted.');
  err.statusCode = 429;
  err.publicMessage = 'All configured Groq API keys are currently rate-limited.';
  throw err;
}

function extractAssistantText(completion) {
  const content = completion?.choices?.[0]?.message?.content;
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.filter((p) => p?.type === 'text' && typeof p.text === 'string').map((p) => p.text).join('\n').trim();
  }
  return '';
}

/**
 * POST /api/try-on
 *
 * Accepts one or two garment images (top + bottom) and a mannequinId.
 * Uses Groq Vision to analyze the outfit and return structured scores.
 *
 * Fields (multipart/form-data):
 *   - topGarment    (File) : shirt / jacket / blouse image
 *   - bottomGarment (File) : pants / skirt / shorts image
 *   - garment       (File) : single garment (legacy, treated as top)
 *   - mannequinId   (string)
 */
router.post(
  '/try-on',
  upload.fields([
    { name: 'topGarment', maxCount: 1 },
    { name: 'bottomGarment', maxCount: 1 },
    { name: 'garment', maxCount: 1 },        // legacy single-garment field
  ]),
  async (req, res) => {
    try {
      const { mannequinId } = req.body ?? {};

      /* ── Validate mannequin ── */
      if (!mannequinId || !MANNEQUIN_PROFILES[mannequinId]) {
        return res.status(400).json({
          error: 'Invalid or missing mannequinId.',
          validIds: Object.keys(MANNEQUIN_PROFILES),
        });
      }

      /* ── Resolve garment files ── */
      const files = req.files || {};
      const topFile = files.topGarment?.[0] || files.garment?.[0] || null;
      const bottomFile = files.bottomGarment?.[0] || null;

      if (!topFile && !bottomFile) {
        return res.status(400).json({ error: 'Provide at least one garment image (topGarment or bottomGarment).' });
      }

      /* ── Upload to Supabase Storage ── */
      let topPublicUrl = null;
      let bottomPublicUrl = null;

      if (topFile) {
        try {
          const uploaded = await uploadToSupabaseStorage(topFile.buffer, topFile.originalname || 'top.jpg', topFile.mimetype, 'try-on/top');
          topPublicUrl = uploaded.publicUrl;
        } catch (err) {
          console.error('Failed to upload top garment:', err.message);
        }
      }

      if (bottomFile) {
        try {
          const uploaded = await uploadToSupabaseStorage(bottomFile.buffer, bottomFile.originalname || 'bottom.jpg', bottomFile.mimetype, 'try-on/bottom');
          bottomPublicUrl = uploaded.publicUrl;
        } catch (err) {
          console.error('Failed to upload bottom garment:', err.message);
        }
      }

      /* ── Build vision prompt ── */
      const groqKeys = getGroqApiKeys();
      if (groqKeys.length === 0) {
        return res.status(500).json({ error: 'Missing GROQ_API_KEY configuration.' });
      }

      const model = process.env.GROQ_VISION_MODEL || 'llama-3.2-90b-vision-preview';
      const mannequin = MANNEQUIN_PROFILES[mannequinId];

      const garmentDescriptions = [];
      const imageContent = [];

      if (topFile) {
        garmentDescriptions.push('Image 1 is a TOP garment (shirt, jacket, blouse, etc.).');
        imageContent.push({ type: 'image_url', image_url: { url: toDataUri(topFile) } });
      }
      if (bottomFile) {
        garmentDescriptions.push(`Image ${topFile ? '2' : '1'} is a BOTTOM garment (pants, skirt, shorts, etc.).`);
        imageContent.push({ type: 'image_url', image_url: { url: toDataUri(bottomFile) } });
      }

      const prompt = [
        'You are an expert virtual fashion stylist and clothing visualization specialist.',
        '',
        `I am sending you ${topFile && bottomFile ? 'two garment images' : 'one garment image'} to analyze as an outfit on a ${mannequin.bodyType}.`,
        garmentDescriptions.join(' '),
        '',
        'Your response MUST include the following structured sections:',
        '',
        '## GARMENT_ANALYSIS',
        topFile && bottomFile
          ? 'Describe BOTH garments: type, color, pattern, fabric, and style details for each.'
          : 'Describe the garment type, color, pattern, fabric, and style details.',
        '',
        '## FIT_DESCRIPTION',
        'Describe how the outfit would drape and fit on the mannequin body type. Include details about silhouette, length, and how each piece falls on the body.',
        '',
        '## OUTFIT_COMPATIBILITY',
        topFile && bottomFile
          ? 'Rate how well these two pieces work together. Do the colors, styles, and formality levels match? Provide specific feedback.'
          : 'Suggest which type of complementary garment (top or bottom) would pair best with this piece.',
        '',
        '## STYLING_SUGGESTIONS',
        'Suggest 3 complementary items (accessories, shoes, layers) that would complete this outfit.',
        '',
        '## OCCASIONS',
        'List 2-3 occasions or settings where this outfit would be appropriate.',
        '',
        '## OVERALL_RATING',
        'Rate the outfit on a scale of 1-10 for:',
        '- Style: <score>/10',
        '- Versatility: <score>/10',
        '- Trendiness: <score>/10',
        '- Overall: <score>/10',
        '',
        'Also output exactly one line in this format:',
        'TRYON_SCORE | style=<1-10> | versatility=<1-10> | trendiness=<1-10> | overall=<1-10> | garment_type=<type> | color=<primary color>',
      ].join('\n');

      const messages = [
        {
          role: 'system',
          content: 'You are an expert virtual try-on assistant. Provide detailed, professional garment analysis.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            ...imageContent,
          ],
        },
      ];

      const completion = await callGroqWithRetry({ groqKeys, model, messages, temperature: 0.4 });
      const analysisText = extractAssistantText(completion);

      if (!analysisText) {
        return res.status(502).json({ error: 'AI returned an empty response.' });
      }

      /* ── Parse scores ── */
      const scores = { style: null, versatility: null, trendiness: null, overall: null };
      let garmentType = null;
      let primaryColor = null;

      const scoreLine = analysisText.split('\n').find((l) => l.includes('TRYON_SCORE'));
      if (scoreLine) {
        const styleMatch = scoreLine.match(/style\s*=\s*(\d+)/i);
        const versMatch = scoreLine.match(/versatility\s*=\s*(\d+)/i);
        const trendMatch = scoreLine.match(/trendiness\s*=\s*(\d+)/i);
        const overallMatch = scoreLine.match(/overall\s*=\s*(\d+)/i);
        const typeMatch = scoreLine.match(/garment_type\s*=\s*([^|]+)/i);
        const colorMatch = scoreLine.match(/color\s*=\s*([^|]+)/i);

        if (styleMatch) scores.style = Number(styleMatch[1]);
        if (versMatch) scores.versatility = Number(versMatch[1]);
        if (trendMatch) scores.trendiness = Number(trendMatch[1]);
        if (overallMatch) scores.overall = Number(overallMatch[1]);
        if (typeMatch) garmentType = typeMatch[1].trim();
        if (colorMatch) primaryColor = colorMatch[1].trim();
      }

      /* ── Save result ── */
      const userId = req.user?.id || null;
      let savedRecord = null;

      const insertPayload = {
        user_id: userId,
        mannequin_id: mannequinId,
        garment_image_url: topPublicUrl || bottomPublicUrl,
        analysis: analysisText,
        garment_type: garmentType,
        primary_color: primaryColor,
        style_score: scores.style,
        versatility_score: scores.versatility,
        trendiness_score: scores.trendiness,
        overall_score: scores.overall,
      };

      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from('tryon_results')
        .insert(insertPayload)
        .select('id, created_at')
        .single();

      if (insertErr) {
        console.error('Failed to save try-on result:', insertErr.message);
      } else {
        savedRecord = inserted;
      }

      /* ── Respond ── */
      return res.status(200).json({
        message: 'Virtual try-on analysis complete.',
        resultImageUrl: topPublicUrl || bottomPublicUrl,
        topImageUrl: topPublicUrl,
        bottomImageUrl: bottomPublicUrl,
        mannequin: {
          id: mannequinId,
          label: mannequin.label,
        },
        analysis: analysisText,
        scores,
        garmentType,
        primaryColor,
        savedId: savedRecord?.id || null,
        createdAt: savedRecord?.created_at || null,
      });
    } catch (error) {
      if (error?.statusCode === 429) {
        return res.status(429).json({ error: error.publicMessage || error.message });
      }
      console.error('Try-on error:', error?.message);
      return res.status(500).json({ error: error?.message || 'Unexpected error during virtual try-on.' });
    }
  }
);

/**
 * GET /api/try-on/history
 */
router.get('/try-on/history', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'User not authenticated.' });

    const { data, error } = await supabaseAdmin
      .from('tryon_results')
      .select('id, mannequin_id, garment_image_url, garment_type, primary_color, style_score, versatility_score, trendiness_score, overall_score, analysis, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: 'Failed to fetch try-on history.', details: error.message });

    return res.status(200).json({
      total: data.length,
      results: data.map((row) => ({
        id: row.id,
        mannequinId: row.mannequin_id,
        garmentImageUrl: row.garment_image_url,
        garmentType: row.garment_type,
        primaryColor: row.primary_color,
        scores: {
          style: row.style_score,
          versatility: row.versatility_score,
          trendiness: row.trendiness_score,
          overall: row.overall_score,
        },
        analysis: row.analysis,
        createdAt: row.created_at,
      })),
    });
  } catch {
    return res.status(500).json({ error: 'Unexpected error fetching try-on history.' });
  }
});

export default router;
