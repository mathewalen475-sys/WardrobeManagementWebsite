import { Router } from 'express';
import multer from 'multer';
import Groq from 'groq-sdk';

import { supabaseAdmin } from '../lib/supabase.js';
import { uploadToSupabaseStorage } from '../lib/storage.js';

const router = Router();

const MAX_IMAGES_PER_CALL = 5;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 10,
    fileSize: 15 * 1024 * 1024,
  },
});

const PROMPT_A = `Role: You are an expert personal fashion stylist and wardrobe consultant with a deep understanding of color theory, fabric matching, and contemporary style trends.
Task: I am providing you with several images of clothing items from my wardrobe, primarily shirts and pants. I need you to analyze these items, create the best possible shirt-and-pant combinations, and rank these outfit pairings in a strict hierarchical order from most stylish to least stylish.
Instructions:

Inventory & Categorization: Briefly list the items you see in the images to confirm you have identified them correctly. Assign a simple label to each.

Outfit Creation: Create distinct pairs consisting of one shirt and one pair of pants. Try to create as many viable combinations as the wardrobe allows.

Hierarchical Ranking: Rank the created pairs from Best (Rank #1) to Worst. Group them into Tier 1 (The Top Picks), Tier 2 (Solid Everyday Wear), and Tier 3 (Weak or Clashing).

Justification: For every pair you create, provide a brief 1-2 sentence explanation of why it earned its rank.
Output Format: Please format your response clearly using headings for the Tiers and bullet points for the ranked outfits.`;

const PROMPT_B = `Role: You are a high-end fashion editor and garment quality inspector. You have a keen eye for fabric, construction, current trends, and classic, timeless style.
Task: Analyze the provided images of clothing items from my wardrobe. Your objective is to categorize the items and then provide a separate, hierarchical ranking for each category, from best to worst.
Instructions:
Step 1: Inventory & ID: Scan all the images. Briefly list every item you identify with a descriptive name.
Step 2: Sorting: Separate the identified items into exactly two categories: Shirts/Tops and Pants/Bottoms.
Step 3: Hierarchical Evaluation & Ranking: Within each category, rank the items from "Best" (Rank #1) to "Worst." You are ranking Shirts vs. Shirts and Pants vs. Pants. Do not create outfits across categories. Base your rankings on Visual Quality, Condition, Style & Versatility, and Fit.
Step 4: Output Format: Present your findings exactly in this format:
###CATEGORY 1: SHIRTS/TOPS
[Insert descriptive name of Rank 1 Shirt]
Justification: [1-2 sentences explaining why...]
[Continue for all items]
###CATEGORY 2: PANTS/BOTTOMS
[Insert descriptive name of Rank 1 Pants]
Justification: [1-2 sentences explaining why...]
[Continue for all items]`;

function chunkArray(input, chunkSize) {
  const chunks = [];

  for (let index = 0; index < input.length; index += chunkSize) {
    chunks.push(input.slice(index, index + chunkSize));
  }

  return chunks;
}

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

function resolvePrompt(type) {
  if (type === 'one to one') {
    return PROMPT_A;
  }

  if (type === 'one to many') {
    return PROMPT_B;
  }

  return null;
}

function toDataUri(file) {
  const mime = file.mimetype || 'application/octet-stream';
  const base64 = file.buffer.toString('base64');
  return `data:${mime};base64,${base64}`;
}

function extractAssistantText(completion) {
  const content = completion?.choices?.[0]?.message?.content;

  if (!content) {
    return '';
  }

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .filter((part) => part?.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('\n')
      .trim();
  }

  return '';
}

function buildBatchInstruction({ selectedPrompt, type, totalImages, batchNumber, totalBatches, batchItems, carryForwardScoreContext }) {
  const imageOrderText = batchItems
    .map((item) => `- order=${item.order}, filename=${item.name}`)
    .join('\n');

  const carryForwardText = carryForwardScoreContext.length > 0
    ? `Previous scores and notes from earlier images:\n${carryForwardScoreContext.join('\n')}`
    : 'No previous score context yet. This is the first batch.';

  return [
    selectedPrompt,
    '',
    `Analysis mode: ${type}`,
    `Global image count: ${totalImages}`,
    `Current batch: ${batchNumber} of ${totalBatches}`,
    'You must keep all scoring calibrated against earlier batches.',
    carryForwardText,
    '',
    'Current batch images (preserve this order):',
    imageOrderText,
    '',
    'For each image, return one line exactly in this format:',
    'IMAGE_SCORE | order=<number> | filename=<name> | score=<0-100> | category=<shirt|pants|other> | note=<short reason>',
    '',
    'After the image lines, return a short section titled BATCH_SUMMARY with 2-4 lines.',
    'Do not omit any image. Keep the same order as provided.',
  ].join('\n');
}

function buildFinalAggregationPrompt({ type, totalImages, orderedImages, allBatchScores }) {
  const orderedImageLines = orderedImages
    .map((image) => `- order=${image.order}, filename=${image.name}`)
    .join('\n');

  const scoreLines = allBatchScores.length > 0
    ? allBatchScores.join('\n')
    : 'No per-image scores available.';

  return [
    `Analysis mode: ${type}`,
    `Total images: ${totalImages}`,
    '',
    'Image order that must be preserved in your output:',
    orderedImageLines,
    '',
    'Per-image score lines collected from previous calls:',
    scoreLines,
    '',
    'Generate one final combined response across all images in the exact order above.',
    '',
    'CRITICAL REQUIREMENT — Structured outfit pairs:',
    'You MUST create shirt-and-pant outfit pairings from the images.',
    'For EVERY pair you propose, output exactly one line in this format:',
    'OUTFIT_PAIR | rank=<number> | shirt_order=<order number> | shirt_name=<filename or description> | pants_order=<order number> | pants_name=<filename or description> | score=<0-100> | reason=<1-2 sentence explanation>',
    '',
    'Rules for pairs:',
    '- Each pair MUST have one shirt/top and one pants/bottom.',
    '- Rank pairs from best (rank=1) to worst.',
    '- Create as many viable pairs as possible from the available items.',
    '- The score should reflect how well the shirt and pants go together (0=terrible clash, 100=perfect match).',
    '- Use the order numbers from the image list above for shirt_order and pants_order.',
    '',
    'After all OUTFIT_PAIR lines, include a section named ORDERED_IMAGE_BREAKDOWN where each image appears in order with score and rationale.',
    'Then include a brief STYLE_SUMMARY section with overall wardrobe recommendations.',
  ].join('\n');
}

function extractOutfitPairs(text) {
  if (typeof text !== 'string' || text.trim().length === 0) {
    return [];
  }

  const pairs = [];

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();

    if (!line.includes('OUTFIT_PAIR')) {
      continue;
    }

    const rankMatch = line.match(/rank\s*=\s*(\d+)/i);
    const shirtOrderMatch = line.match(/shirt_order\s*=\s*(\d+)/i);
    const shirtNameMatch = line.match(/shirt_name\s*=\s*([^|]+)/i);
    const pantsOrderMatch = line.match(/pants_order\s*=\s*(\d+)/i);
    const pantsNameMatch = line.match(/pants_name\s*=\s*([^|]+)/i);
    const scoreMatch = line.match(/score\s*=\s*(\d{1,3})/i);
    const reasonMatch = line.match(/reason\s*=\s*(.+)$/i);

    if (!shirtOrderMatch || !pantsOrderMatch) {
      continue;
    }

    pairs.push({
      rank: rankMatch ? Number(rankMatch[1]) : pairs.length + 1,
      shirt: {
        order: Number(shirtOrderMatch[1]),
        name: (shirtNameMatch?.[1] || 'Unknown shirt').trim(),
      },
      pants: {
        order: Number(pantsOrderMatch[1]),
        name: (pantsNameMatch?.[1] || 'Unknown pants').trim(),
      },
      score: scoreMatch ? Math.max(0, Math.min(100, Number(scoreMatch[1]))) : null,
      reason: (reasonMatch?.[1] || 'No reason provided.').trim(),
    });
  }

  pairs.sort((a, b) => a.rank - b.rank);

  return pairs;
}

async function createCompletionWithKeyRotation({ groqKeys, model, messages, temperature }) {
  let completion = null;
  let lastError = null;

  for (const apiKey of groqKeys) {
    const groq = new Groq({ apiKey });

    try {
      completion = await groq.chat.completions.create({
        model,
        messages,
        temperature,
      });
      break;
    } catch (error) {
      lastError = error;

      if (!isGroqLimitError(error)) {
        throw error;
      }
    }
  }

  if (!completion) {
    const exhaustedMessage = 'All configured Groq API keys are currently rate-limited or quota-exhausted.';
    const fallbackMessage = lastError?.message || exhaustedMessage;
    const wrappedError = new Error(fallbackMessage);
    wrappedError.statusCode = 429;
    wrappedError.publicMessage = exhaustedMessage;
    throw wrappedError;
  }

  return completion;
}

function extractImageScoreLines(text) {
  if (typeof text !== 'string' || text.trim().length === 0) {
    return [];
  }

  const rawLines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const normalized = [];

  for (const line of rawLines) {
    if (line.includes('IMAGE_SCORE |')) {
      normalized.push(line.slice(line.indexOf('IMAGE_SCORE |')));
      continue;
    }

    if (!line.includes('order=') || !line.includes('score=')) {
      continue;
    }

    const orderMatch = line.match(/order\s*=\s*(\d+)/i);
    const scoreMatch = line.match(/score\s*=\s*(\d{1,3})/i);
    const fileMatch = line.match(/filename\s*=\s*([^|]+)/i);
    const categoryMatch = line.match(/category\s*=\s*([^|]+)/i);
    const noteMatch = line.match(/note\s*=\s*(.+)$/i);

    if (!orderMatch || !scoreMatch) {
      continue;
    }

    const order = orderMatch[1];
    const score = Math.max(0, Math.min(100, Number(scoreMatch[1])));
    const filename = (fileMatch?.[1] || `image-${order}`).trim();
    const category = (categoryMatch?.[1] || 'other').trim();
    const note = (noteMatch?.[1] || 'No note provided.').trim();

    normalized.push(
      `IMAGE_SCORE | order=${order} | filename=${filename} | score=${score} | category=${category} | note=${note}`,
    );
  }

  return normalized;
}

router.post('/wardrobe/analyze', upload.array('images'), async (req, res) => {
  try {
    const { type } = req.body ?? {};
    const files = req.files ?? [];

    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'At least one image is required in the images field.' });
    }

    const selectedPrompt = resolvePrompt(type);
    if (!selectedPrompt) {
      return res.status(400).json({ error: 'Invalid type. Use "one to one" or "one to many".' });
    }

    const invalidFile = files.find((file) => !file.mimetype || !file.mimetype.startsWith('image/'));
    if (invalidFile) {
      return res.status(400).json({ error: 'Only image files are allowed in the images field.' });
    }

    const groqKeys = getGroqApiKeys();
    if (groqKeys.length === 0) {
      return res.status(500).json({ error: 'Missing GROQ_API_KEY or GROQ_API_KEYS environment configuration.' });
    }

    const model = process.env.GROQ_VISION_MODEL || 'llama-3.2-90b-vision-preview';
    const orderedFiles = files.map((file, index) => ({
      file,
      order: index + 1,
      name: file.originalname || `image-${index + 1}`,
    }));

    const batches = chunkArray(orderedFiles, MAX_IMAGES_PER_CALL);
    const totalBatches = batches.length;
    const carryForwardScoreContext = [];
    const batchOutputs = [];

    for (let index = 0; index < batches.length; index += 1) {
      const batchItems = batches[index];
      const batchNumber = index + 1;

      const instruction = buildBatchInstruction({
        selectedPrompt,
        type,
        totalImages: orderedFiles.length,
        batchNumber,
        totalBatches,
        batchItems,
        carryForwardScoreContext,
      });

      const imageParts = batchItems.map((item) => ({
        type: 'image_url',
        image_url: {
          url: toDataUri(item.file),
        },
      }));

      const messages = [
        {
          role: 'system',
          content: 'You are an expert wardrobe analysis assistant. Follow the provided instructions exactly.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: instruction },
            ...imageParts,
          ],
        },
      ];

      const completion = await createCompletionWithKeyRotation({
        groqKeys,
        model,
        messages,
        temperature: 0.4,
      });

      const batchText = extractAssistantText(completion);
      if (!batchText) {
        return res.status(502).json({ error: `Groq returned an empty response for batch ${batchNumber}.` });
      }

      const scoreLines = extractImageScoreLines(batchText);
      if (scoreLines.length > 0) {
        carryForwardScoreContext.push(...scoreLines);
      }

      batchOutputs.push({
        batchNumber,
        imageOrders: batchItems.map((item) => item.order),
        response: batchText,
        scoreLines,
      });
    }

    const finalAggregationPrompt = buildFinalAggregationPrompt({
      type,
      totalImages: orderedFiles.length,
      orderedImages: orderedFiles,
      allBatchScores: carryForwardScoreContext,
    });

    const finalMessages = [
      {
        role: 'system',
        content: 'You are an expert wardrobe analysis assistant. Produce clear final recommendations.',
      },
      {
        role: 'user',
        content: finalAggregationPrompt,
      },
    ];

    const finalCompletion = await createCompletionWithKeyRotation({
      groqKeys,
      model,
      messages: finalMessages,
      temperature: 0.3,
    });

    const finalText = extractAssistantText(finalCompletion);
    if (!finalText) {
      return res.status(502).json({ error: 'Groq returned an empty final aggregated response.' });
    }

    const pairs = extractOutfitPairs(finalText);

    /* ── Upload images to Supabase Storage ── */
    const orderToUrl = {};
    for (const item of orderedFiles) {
      try {
        const uploaded = await uploadToSupabaseStorage(
          item.file.buffer,
          item.file.originalname || `image-${item.order}.jpg`,
          item.file.mimetype,
          'wardrobe',
        );
        orderToUrl[item.order] = uploaded.publicUrl;
      } catch (err) {
        console.error(`Failed to upload image ${item.order} to storage:`, err.message);
        orderToUrl[item.order] = null;
      }
    }

    /* ── Enrich pairs with Supabase Storage URLs ── */
    const enrichedPairs = pairs.map((pair) => ({
      ...pair,
      shirt: {
        ...pair.shirt,
        imageUrl: orderToUrl[pair.shirt.order] || null,
      },
      pants: {
        ...pair.pants,
        imageUrl: orderToUrl[pair.pants.order] || null,
      },
    }));

    /* ── Store pairs in the database ── */
    const userId = req.user?.id || null;
    const pairRows = enrichedPairs.map((pair) => ({
      user_id: userId,
      rank: pair.rank,
      shirt_image_url: pair.shirt.imageUrl,
      shirt_name: pair.shirt.name,
      pants_image_url: pair.pants.imageUrl,
      pants_name: pair.pants.name,
      score: pair.score,
      reason: pair.reason,
    }));

    let savedPairs = [];
    if (pairRows.length > 0) {
      const { data: insertedPairs, error: insertError } = await supabaseAdmin
        .from('wardrobe_pairs')
        .insert(pairRows)
        .select('id, rank, shirt_image_url, shirt_name, pants_image_url, pants_name, score, reason, created_at');

      if (insertError) {
        console.error('Failed to save pairs to database:', insertError.message);
      } else {
        savedPairs = insertedPairs || [];
      }
    }

    return res.status(200).json({
      result: finalText,
      pairs: enrichedPairs,
      savedPairs,
      type,
      totalImages: orderedFiles.length,
      callsUsed: batchOutputs.length + 1,
      imageOrder: orderedFiles.map((item) => ({
        order: item.order,
        filename: item.name,
        imageUrl: orderToUrl[item.order] || null,
      })),
      batchResponses: batchOutputs,
    });
  } catch (error) {
    if (error?.statusCode === 429) {
      return res.status(429).json({ error: error.publicMessage || error.message, details: error.message });
    }

    const message = error?.message || 'Unexpected error while analyzing wardrobe images.';
    return res.status(500).json({ error: message });
  }
});

export default router;
