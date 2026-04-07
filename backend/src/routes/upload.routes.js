import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';

import { supabaseAdmin } from '../lib/supabase.js';
import { uploadMultipleToSupabase } from '../lib/storage.js';

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

export default router;
