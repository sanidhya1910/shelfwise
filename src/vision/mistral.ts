import { categoryFromKeywords } from '@/domain/categories';
import { secure } from '@/utils/secure';

import type { OcrResult, ProductInfo } from './types';

const API_ROOT = 'https://api.mistral.ai/v1';
const KEY_STORAGE = 'mistral_api_key';
const OCR_MODEL = 'mistral-ocr-latest';
const TIMEOUT_MS = 30_000;

export class MistralError extends Error {
  constructor(
    message: string,
    readonly kind: 'no-key' | 'auth' | 'rate-limit' | 'network' | 'bad-response'
  ) {
    super(message);
    this.name = 'MistralError';
  }
}

export async function getApiKey(): Promise<string | null> {
  return secure.get(KEY_STORAGE);
}

export async function setApiKey(key: string): Promise<void> {
  const trimmed = key.trim();
  if (trimmed) await secure.set(KEY_STORAGE, trimmed);
  else await secure.remove(KEY_STORAGE);
}

export async function hasApiKey(): Promise<boolean> {
  return (await getApiKey()) != null;
}

async function request<T>(path: string, body: unknown): Promise<T> {
  const key = await getApiKey();
  if (!key) throw new MistralError('No API key has been saved.', 'no-key');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_ROOT}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new MistralError('Could not reach Mistral. Check your connection.', 'network');
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 401 || response.status === 403) {
    throw new MistralError('That API key was rejected.', 'auth');
  }
  if (response.status === 429) {
    throw new MistralError('Rate limited. Try again in a moment.', 'rate-limit');
  }
  if (!response.ok) {
    throw new MistralError(`Mistral returned ${response.status}.`, 'bad-response');
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new MistralError('Mistral sent a response we could not read.', 'bad-response');
  }
}

/** Cheapest possible call, used by the "Test key" button in settings. */
export async function verifyApiKey(key: string): Promise<boolean> {
  const response = await fetch(`${API_ROOT}/models`, {
    headers: { Authorization: `Bearer ${key.trim()}` },
  }).catch(() => null);
  return response?.ok ?? false;
}

interface OcrResponse {
  pages?: { markdown?: string }[];
}

/**
 * Document OCR fallback for when the on-device reader cannot find a confident
 * date. Returns raw text only — the same local parser then ranks the dates, so
 * the AI never gets to invent a date that was not printed on the pack.
 */
export async function ocrImage(base64Jpeg: string): Promise<OcrResult> {
  const data = await request<OcrResponse>('/ocr', {
    model: OCR_MODEL,
    document: {
      type: 'image_url',
      image_url: `data:image/jpeg;base64,${base64Jpeg}`,
    },
    include_image_base64: false,
  });

  const text = (data.pages ?? [])
    .map((page) => page.markdown ?? '')
    .join('\n')
    .trim();

  return {
    text,
    lines: text
      .split(/\r?\n/)
      .map((line) => line.replace(/[#*_`|]/g, ' ').trim())
      .filter(Boolean)
      .map((line) => ({ text: line, frame: null })),
    engine: 'mistral',
  };
}

interface ChatResponse {
  choices?: { message?: { content?: string } }[];
}

const PRODUCT_PROMPT = `You identify consumer products from a photo so they can be added to a home expiry tracker.

Return ONLY a JSON object with these keys:
- "name": the specific product, 2-5 words, no brand (e.g. "Greek yoghurt", "Whole wheat bread")
- "brand": the brand if legible, else null
- "categoryHint": one of dairy, meat, produce, bakery, frozen, pantry, beverages, condiments, snacks, medicine, cosmetics, household, baby, pet, other
- "shelfLifeDays": typical unopened shelf life in days from today as an integer, or null if you cannot reasonably estimate
- "visibleDates": array of any date strings printed on the packaging, copied exactly as printed, empty if none
- "confidence": 0 to 1, how sure you are of the identification

Do not guess a date that is not printed. If the photo is not a product, set name to null.`;

export interface RecognizedProduct extends ProductInfo {
  /** Dates the model could read off the pack, passed through the local parser. */
  visibleDates: string[];
}

export async function recognizeProduct(
  base64Jpeg: string,
  model: string
): Promise<RecognizedProduct | null> {
  const data = await request<ChatResponse>('/chat/completions', {
    model,
    response_format: { type: 'json_object' },
    max_tokens: 400,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: PRODUCT_PROMPT },
          { type: 'image_url', image_url: `data:image/jpeg;base64,${base64Jpeg}` },
        ],
      },
    ],
  });

  const raw = data.choices?.[0]?.message?.content;
  if (!raw) return null;

  let parsed: {
    name?: string | null;
    brand?: string | null;
    categoryHint?: string | null;
    shelfLifeDays?: number | null;
    visibleDates?: string[];
    confidence?: number;
  };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new MistralError('The AI reply was not valid JSON.', 'bad-response');
  }

  if (!parsed.name) return null;

  return {
    name: parsed.name,
    brand: parsed.brand ?? null,
    // The hint is mapped through our own keyword table rather than trusted
    // directly, so a made-up category still lands somewhere sensible.
    categoryId: categoryFromKeywords([parsed.categoryHint, parsed.name, parsed.brand]),
    imageUrl: null,
    packSize: null,
    barcode: null,
    shelfLifeDays:
      typeof parsed.shelfLifeDays === 'number' && parsed.shelfLifeDays > 0
        ? Math.round(parsed.shelfLifeDays)
        : null,
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : null,
    source: 'ai',
    visibleDates: Array.isArray(parsed.visibleDates) ? parsed.visibleDates.filter((d) => typeof d === 'string') : [],
  };
}
