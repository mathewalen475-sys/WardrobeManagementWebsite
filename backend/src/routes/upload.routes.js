import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import Groq from 'groq-sdk';

import { supabaseAdmin } from '../lib/supabase.js';
import { uploadMultipleToSupabase } from '../lib/storage.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, '../../public/uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const MAX_FILES = 10;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/tiff',
  'image/svg+xml',
  'image/heic',
  'image/heif',
  'image/avif',
  'image/x-icon',
  'image/vnd.microsoft.icon',
]);

function getGroqApiKeys() {
  const keys = [];

  if (typeof process.env.GROQ_API_KEYS === 'string' && process.env.GROQ_API_KEYS.trim().length > 0) {
    keys.push(...process.env.GROQ_API_KEYS.split(',').map((value) => value.trim()).filter(Boolean));
  }

  if (typeof process.env.GROQ_API_KEY === 'string' && process.env.GROQ_API_KEY.trim().length > 0) {
    keys.push(process.env.GROQ_API_KEY.trim());
  }

  return [...new Set(keys)];
}

function inferMimeFromFilename(filename) {
  const lower = String(filename || '').toLowerCase();

  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.bmp')) return 'image/bmp';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.avif')) return 'image/avif';
  if (lower.endsWith('.heic')) return 'image/heic';
  if (lower.endsWith('.heif')) return 'image/heif';
  return 'image/jpeg';
}

function normalizeColor(raw) {
  const value = String(raw || '').trim().toLowerCase();
  const allowed = new Set([
    'black', 'white', 'gray', 'grey', 'navy', 'blue', 'brown', 'beige', 'cream', 'khaki', 'green',
    'olive', 'red', 'maroon', 'pink', 'purple', 'orange', 'yellow', 'teal', 'multicolor',
  ]);

  if (!value) return 'unknown';
  if (allowed.has(value)) return value === 'grey' ? 'gray' : value;
  return 'unknown';
}

function colorToHex(color) {
  const map = {
    black: '#1f1f1f',
    white: '#f5f5f5',
    gray: '#8a8a8a',
    navy: '#253a73',
    blue: '#3f6ad8',
    brown: '#7a5133',
    beige: '#c9b28c',
    cream: '#e8ddbe',
    khaki: '#8e8a5b',
    green: '#3f7a4d',
    olive: '#66753d',
    red: '#bf3f3f',
    maroon: '#7a2f3f',
    pink: '#d67ca8',
    purple: '#7a58b6',
    orange: '#d8873f',
    yellow: '#d8bd3f',
    teal: '#3e8d8b',
    multicolor: '#6f6f6f',
    unknown: '#8a8a8a',
  };

  return map[color] || map.unknown;
}

async function detectShirtColor({ imageUrl, filename }) {
  const groqKeys = getGroqApiKeys();
  if (groqKeys.length === 0) {
    return { color: 'unknown', colorHex: colorToHex('unknown') };
  }

  const model = process.env.GROQ_VISION_MODEL || 'llama-3.2-90b-vision-preview';
  const imageParts = [];

  const safeFilename = typeof filename === 'string' && filename.trim().length > 0
    ? path.basename(filename)
    : null;

  if (safeFilename) {
    const fullPath = path.resolve(uploadsDir, safeFilename);
    if (fs.existsSync(fullPath)) {
      const mime = inferMimeFromFilename(safeFilename);
      const buffer = fs.readFileSync(fullPath);
      imageParts.push({
        type: 'image_url',
        image_url: {
          url: `data:${mime};base64,${buffer.toString('base64')}`,
        },
      });
    }
  }

  if (imageParts.length === 0 && typeof imageUrl === 'string' && /^https?:\/\//i.test(imageUrl)) {
    imageParts.push({
      type: 'image_url',
      image_url: { url: imageUrl },
    });
  }

  if (imageParts.length === 0) {
    return { color: 'unknown', colorHex: colorToHex('unknown') };
  }

  const prompt = [
    'Identify only the dominant shirt/top color in this image.',
    'Return exactly one line in this strict format:',
    'SHIRT_COLOR | value=<black|white|gray|navy|blue|brown|beige|cream|khaki|green|olive|red|maroon|pink|purple|orange|yellow|teal|multicolor>',
    'No extra text.',
  ].join('\n');

  for (const apiKey of groqKeys) {
    try {
      const groq = new Groq({ apiKey });
      const completion = await groq.chat.completions.create({
        model,
        temperature: 0,
        messages: [{
          role: 'user',
          content: [{ type: 'text', text: prompt }, ...imageParts],
        }],
      });

      const content = completion?.choices?.[0]?.message?.content;
      const text = typeof content === 'string'
        ? content
        : Array.isArray(content)
          ? content.filter((part) => part?.type === 'text' && typeof part.text === 'string').map((part) => part.text).join('\n')
          : '';

      const rawColor = String(text || '').match(/value\s*=\s*([^|\n]+)/i)?.[1] || 'unknown';
      const color = normalizeColor(rawColor);
      return { color, colorHex: colorToHex(color) };
    } catch {
      // try next key
    }
  }

  return { color: 'unknown', colorHex: colorToHex('unknown') };
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: MAX_FILES,
    fileSize: MAX_FILE_SIZE_BYTES,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      const error = new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname);
      error.message = 'Only image files are allowed (jpeg, png, webp, gif, bmp, tiff, svg, heic, heif, avif, ico).';
      cb(error);
      return;
    }

    cb(null, true);
  },
});

const localUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const base = path.basename(file.originalname || 'image', ext)
        .replace(/[^a-zA-Z0-9-_]/g, '-')
        .slice(0, 60);
      const safeExt = ext || '.jpg';
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${base}${safeExt}`);
    },
  }),
  limits: {
    files: MAX_FILES,
    fileSize: MAX_FILE_SIZE_BYTES,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      const error = new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname);
      error.message = 'Only image files are allowed (jpeg, png, webp, gif, bmp, tiff, svg, heic, heif, avif, ico).';
      cb(error);
      return;
    }

    cb(null, true);
  },
});

router.post('/upload-local', (req, res) => {
  localUpload.array('images', MAX_FILES)(req, res, (uploadError) => {
    if (uploadError instanceof multer.MulterError) {
      if (uploadError.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: `Each image must be ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB or smaller.` });
      }

      if (uploadError.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ error: `You can upload up to ${MAX_FILES} images per request.` });
      }

      return res.status(400).json({ error: uploadError.message || 'Invalid file upload.' });
    }

    if (uploadError) {
      return res.status(500).json({ error: 'File upload failed.' });
    }

    const files = Array.isArray(req.files) ? req.files : [];
    if (files.length === 0) {
      return res.status(400).json({ error: 'At least one image is required in the images field.' });
    }

    const uploadedImages = files.map((file) => ({
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url: `/uploads/${file.filename}`,
    }));

    return res.status(201).json({
      message: 'Images uploaded locally.',
      uploadedImages,
    });
  });
});

router.post('/upload-images', (req, res) => {
  upload.array('images', MAX_FILES)(req, res, async (uploadError) => {
    if (uploadError instanceof multer.MulterError) {
      if (uploadError.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: `Each image must be ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB or smaller.` });
      }

      if (uploadError.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ error: `You can upload up to ${MAX_FILES} images per request.` });
      }

      return res.status(400).json({ error: uploadError.message || 'Invalid file upload.' });
    }

    if (uploadError) {
      return res.status(500).json({ error: 'File upload failed.' });
    }

    const files = Array.isArray(req.files) ? req.files : [];

    if (files.length === 0) {
      return res.status(400).json({ error: 'At least one image is required in the images field.' });
    }

    try {
      /* ── Upload files to Supabase Storage ── */
      const uploaded = await uploadMultipleToSupabase(files, 'clothes');
      const imageUrls = uploaded.map((item) => item.publicUrl);

      /* ── Save URLs to database ── */
      const { data, error } = await supabaseAdmin
        .from('image_uploads')
        .insert({
          image_urls: imageUrls,
          uploaded_by: req.user?.id || null,
        })
        .select('id, image_urls, created_at')
        .single();

      if (error || !data) {
        return res.status(500).json({
          error: 'Failed to save image URLs to the database.',
          details: error?.message || 'Unknown Supabase insert failure.',
        });
      }

      return res.status(201).json({
        message: 'Images uploaded successfully.',
        uploadId: data.id,
        imageUrls: data.image_urls,
        createdAt: data.created_at,
      });
    } catch (err) {
      return res.status(500).json({
        error: 'Failed to upload images.',
        details: err?.message || 'Unknown error.',
      });
    }
  });
});

router.post('/upload-selected-outfit', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated.' });
    }

    const top = req.body?.top || null;
    const bottom = req.body?.bottom || null;
    const score = Number(req.body?.score ?? 0);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    const rank = Number(req.body?.rank ?? 1);

    if (!top || !bottom) {
      return res.status(400).json({ error: 'top and bottom are required.' });
    }

    const topImageUrl = typeof top.imageUrl === 'string' ? top.imageUrl : null;
    const topFilename = typeof top.filename === 'string' ? path.basename(top.filename) : null;
    const bottomImageUrl = typeof bottom.imageUrl === 'string' ? bottom.imageUrl : null;
    const bottomFilename = typeof bottom.filename === 'string' ? path.basename(bottom.filename) : null;

    const shirtColor = await detectShirtColor({
      imageUrl: topImageUrl,
      filename: topFilename,
    });

    const row = {
      user_id: userId,
      shirt_image_url: topImageUrl,
      shirt_name: typeof top.name === 'string' ? top.name : 'Top',
      shirt_filename: topFilename,
      shirt_color: shirtColor.color,
      shirt_color_hex: shirtColor.colorHex,
      pants_image_url: bottomImageUrl,
      pants_name: typeof bottom.name === 'string' ? bottom.name : 'Bottom',
      pants_filename: bottomFilename,
      score: Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0,
      reason: reason || 'Selected from grading.',
      rank: Number.isFinite(rank) ? Math.max(1, rank) : 1,
    };

    const { data, error } = await supabaseAdmin
      .from('selected_outfits')
      .insert(row)
      .select('id, user_id, shirt_image_url, shirt_name, shirt_color, shirt_color_hex, pants_image_url, pants_name, score, reason, rank, created_at')
      .single();

    if (!error && data) {
      return res.status(201).json({
        message: 'Selected outfit saved.',
        selectedOutfit: data,
      });
    }

    // Backward-compatible fallback for environments where selected_outfits table is not created yet.
    if (error?.code === '42P01' || String(error?.message || '').toLowerCase().includes('selected_outfits')) {
      const fallbackRow = {
        user_id: userId,
        shirt_image_url: topImageUrl,
        shirt_name: typeof top.name === 'string' ? top.name : 'Top',
        pants_image_url: bottomImageUrl,
        pants_name: typeof bottom.name === 'string' ? bottom.name : 'Bottom',
        score: Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0,
        reason: reason || 'Selected from grading.',
        rank: Number.isFinite(rank) ? Math.max(1, rank) : 1,
      };

      const { data: fallbackData, error: fallbackError } = await supabaseAdmin
        .from('wardrobe_pairs')
        .insert(fallbackRow)
        .select('id, user_id, shirt_image_url, shirt_name, pants_image_url, pants_name, score, reason, rank, created_at')
        .single();

      if (fallbackError || !fallbackData) {
        return res.status(500).json({
          error: 'Failed to save selected outfit.',
          details: fallbackError?.message || error?.message || 'Unknown database error.',
        });
      }

      return res.status(201).json({
        message: 'Selected outfit saved (fallback mode).',
        selectedOutfit: {
          ...fallbackData,
          shirt_color: shirtColor.color,
          shirt_color_hex: shirtColor.colorHex,
        },
      });
    }

    return res.status(500).json({
      error: 'Failed to save selected outfit.',
      details: error?.message || 'Unknown database error.',
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to process selected outfit.',
      details: error?.message || 'Unknown error.',
    });
  }
});

export default router;
