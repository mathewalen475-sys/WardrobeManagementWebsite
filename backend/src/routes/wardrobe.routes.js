import { Router } from 'express';
import multer from 'multer';
import Groq from 'groq-sdk';

const router = Router();

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

    const imageParts = files.map((file) => ({
      type: 'image_url',
      image_url: {
        url: toDataUri(file),
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
          { type: 'text', text: selectedPrompt },
          ...imageParts,
        ],
      },
    ];

    let completion = null;
    let lastError = null;

    for (const apiKey of groqKeys) {
      const groq = new Groq({ apiKey });

      try {
        completion = await groq.chat.completions.create({
          model: process.env.GROQ_VISION_MODEL || 'llama-3.2-90b-vision-preview',
          messages,
          temperature: 0.4,
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
      return res.status(429).json({ error: exhaustedMessage, details: fallbackMessage });
    }

    const text = extractAssistantText(completion);
    if (!text) {
      return res.status(502).json({ error: 'Groq returned an empty response.' });
    }

    return res.status(200).json({ result: text });
  } catch (error) {
    const message = error?.message || 'Unexpected error while analyzing wardrobe images.';
    return res.status(500).json({ error: message });
  }
});

export default router;
