import type { DateFormat } from '@/domain/settings';

import { MIN_CONFIDENCE, parseExpiryDates } from './dateParser';
import { prepareForUpload } from './image';
import { hasApiKey, MistralError, ocrImage, recognizeProduct } from './mistral';
import { ocr } from './ocr';
import type { DateScanResult, ProductInfo } from './types';

export interface ScanExpiryOptions {
  dateFormat: DateFormat;
  /** Escalate to Mistral automatically when the local read is unsure. */
  autoFallback: boolean;
}

export interface ScanExpiryOutcome extends DateScanResult {
  /** True when the local read was too weak and no fallback ran. */
  needsFallback: boolean;
  /** Set when the fallback was attempted and failed. */
  error: string | null;
}

/**
 * The expiry-date pipeline.
 *
 * On-device OCR runs first because it is instant, free and works on a plane.
 * Mistral is only paid for when the local read genuinely cannot find a date it
 * believes in — and even then the AI only supplies text, never the final date:
 * the same local parser ranks it, so a hallucinated date cannot slip through.
 */
export async function scanExpiryDate(
  imageUri: string,
  options: ScanExpiryOptions
): Promise<ScanExpiryOutcome> {
  const local = ocr.available
    ? await ocr.recognize(imageUri).catch(() => null)
    : null;

  if (local) {
    const parsed = parseExpiryDates(local.lines, { dateFormat: options.dateFormat });
    if (parsed.best && parsed.best.confidence >= MIN_CONFIDENCE) {
      return { ...parsed, engine: local.engine, rawText: local.text, needsFallback: false, error: null };
    }

    if (!options.autoFallback || !(await hasApiKey())) {
      return {
        ...parsed,
        engine: local.engine,
        rawText: local.text,
        needsFallback: true,
        error: null,
      };
    }
  } else if (!(await hasApiKey())) {
    return {
      best: null,
      alternates: [],
      engine: 'none',
      rawText: '',
      needsFallback: true,
      error: null,
    };
  }

  return runFallback(imageUri, options, local?.text ?? '');
}

/** Explicit "ask the AI" path, also used by the retry button in the sheet. */
export async function scanExpiryWithAi(
  imageUri: string,
  options: ScanExpiryOptions
): Promise<ScanExpiryOutcome> {
  return runFallback(imageUri, options, '');
}

async function runFallback(
  imageUri: string,
  options: ScanExpiryOptions,
  localText: string
): Promise<ScanExpiryOutcome> {
  try {
    const prepared = await prepareForUpload(imageUri);
    const remote = await ocrImage(prepared.base64);
    const parsed = parseExpiryDates(remote.lines, { dateFormat: options.dateFormat });
    return {
      ...parsed,
      engine: 'mistral',
      rawText: remote.text || localText,
      needsFallback: parsed.best == null,
      error: null,
    };
  } catch (error) {
    return {
      best: null,
      alternates: [],
      engine: 'none',
      rawText: localText,
      needsFallback: true,
      error: error instanceof MistralError ? error.message : 'The scan could not be completed.',
    };
  }
}

export interface ProductScanOutcome {
  product: ProductInfo | null;
  /** Dates the model read off the pack, ranked by the local parser. */
  suggestedExpiry: string | null;
  error: string | null;
}

/**
 * Product recognition from a photo. Needs a key — there is no on-device model
 * that can name a specific product, so this path is AI-only by nature.
 */
export async function scanProductPhoto(
  imageUri: string,
  model: string,
  dateFormat: DateFormat
): Promise<ProductScanOutcome> {
  try {
    const prepared = await prepareForUpload(imageUri);
    const recognized = await recognizeProduct(prepared.base64, model);
    if (!recognized) {
      return { product: null, suggestedExpiry: null, error: 'That did not look like a product.' };
    }

    // Any date the model claims to have seen still goes through the local
    // parser, so the app never shows a date the parser would not accept.
    const parsed = parseExpiryDates(
      recognized.visibleDates.map((text) => ({ text, frame: null })),
      { dateFormat }
    );

    return {
      product: recognized,
      suggestedExpiry: parsed.best?.date ?? null,
      error: null,
    };
  } catch (error) {
    return {
      product: null,
      suggestedExpiry: null,
      error: error instanceof MistralError ? error.message : 'The scan could not be completed.',
    };
  }
}
