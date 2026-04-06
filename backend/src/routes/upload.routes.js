import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

import { supabaseAdmin } from '../lib/supabase.js';

const router = Router();

const MAX_FILES = 10;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MIME_TO_EXT = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
  ['image/bmp', '.bmp'],
  ['image/tiff', '.tiff'],
  ['image/svg+xml', '.svg'],
  ['image/heic', '.heic'],
  ['image/heif', '.heif'],
  ['image/avif', '.avif'],
  ['image/x-icon', '.ico'],
  ['image/vnd.microsoft.icon', '.ico'],
]);
const ALLOWED_MIME_TYPES = new Set(MIME_TO_EXT.keys());
const uploadDir = path.resolve(process.cwd(), 'public', 'uploads');

function ensureUploadDirectory() {
  fs.mkdirSync(uploadDir, { recursive: true });
}

function getExtensionFromMimeType(mimetype) {
  return MIME_TO_EXT.get(mimetype) || '';
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      ensureUploadDirectory();
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (_req, file, cb) => {
    const ext = getExtensionFromMimeType(file.mimetype) || path.extname(file.originalname) || '.img';
    const safeName = `${Date.now()}-${uuidv4()}${ext.toLowerCase()}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
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

async function removeFiles(filePaths) {
  await Promise.allSettled(
    filePaths.map((filePath) => fs.promises.unlink(filePath)),
  );
}

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

    const imageUrls = files.map((file) => `${req.protocol}://${req.get('host')}/uploads/${file.filename}`);

    try {
      const { data, error } = await supabaseAdmin
        .from('image_uploads')
        .insert({
          image_urls: imageUrls,
          uploaded_by: req.user?.id || null,
        })
        .select('id, image_urls, created_at')
        .single();

      if (error || !data) {
        await removeFiles(files.map((file) => file.path));
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
    } catch {
      await removeFiles(files.map((file) => file.path));
      return res.status(500).json({ error: 'Failed to save image URLs to the database.' });
    }
  });
});

export default router;
