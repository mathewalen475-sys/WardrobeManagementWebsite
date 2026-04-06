import { v4 as uuidv4 } from 'uuid';
import path from 'path';

import { supabaseAdmin } from './supabase.js';

const BUCKET_NAME = process.env.SUPABASE_STORAGE_BUCKET || 'wardrobe-images';

/**
 * Upload a single file buffer to Supabase Storage.
 *
 * @param {Buffer} buffer   – raw file bytes
 * @param {string} originalName – original filename (used for extension)
 * @param {string} mimetype – MIME type of the file
 * @param {string} [folder] – optional subfolder inside the bucket
 * @returns {{ storagePath: string, publicUrl: string }}
 */
export async function uploadToSupabaseStorage(buffer, originalName, mimetype, folder = '') {
  const ext = path.extname(originalName) || '.img';
  const safeName = `${Date.now()}-${uuidv4()}${ext.toLowerCase()}`;
  const storagePath = folder ? `${folder}/${safeName}` : safeName;

  const { error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .upload(storagePath, buffer, {
      contentType: mimetype,
      upsert: false,
    });

  if (error) {
    throw new Error(`Supabase Storage upload failed: ${error.message}`);
  }

  const { data: urlData } = supabaseAdmin.storage
    .from(BUCKET_NAME)
    .getPublicUrl(storagePath);

  return {
    storagePath,
    publicUrl: urlData.publicUrl,
  };
}

/**
 * Upload multiple multer file objects to Supabase Storage.
 *
 * @param {Array} files   – array of multer file objects (with .buffer, .originalname, .mimetype)
 * @param {string} [folder] – optional subfolder
 * @returns {Promise<Array<{ storagePath: string, publicUrl: string, originalName: string }>>}
 */
export async function uploadMultipleToSupabase(files, folder = '') {
  const results = [];

  for (const file of files) {
    const uploaded = await uploadToSupabaseStorage(
      file.buffer,
      file.originalname,
      file.mimetype,
      folder,
    );

    results.push({
      ...uploaded,
      originalName: file.originalname,
    });
  }

  return results;
}
