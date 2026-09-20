import type { DateOnly } from '@/domain/item';

export interface OcrFrame {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface OcrLine {
  text: string;
  /** Null when the engine gives no geometry; scoring then skips the size signal. */
  frame: OcrFrame | null;
}

export interface OcrResult {
  text: string;
  lines: OcrLine[];
  engine: 'mlkit' | 'mistral' | 'none';
}

export type DatePrecision = 'day' | 'month';

export interface DateCandidate {
  date: DateOnly;
  /** 0..1. Below `MIN_CONFIDENCE` the UI offers the AI fallback. */
  confidence: number;
  /** The exact substring this came from, shown to the user for reassurance. */
  raw: string;
  precision: DatePrecision;
  /** True when the source text only named a month, so we snapped to its last day. */
  snappedToMonthEnd: boolean;
}

export interface DateScanResult {
  best: DateCandidate | null;
  alternates: DateCandidate[];
  engine: OcrResult['engine'];
  /** Full recognised text, kept so the confirm sheet can show "what I read". */
  rawText: string;
}

export interface ProductInfo {
  name: string;
  brand: string | null;
  categoryId: string;
  imageUrl: string | null;
  /** Pack size as printed, e.g. "500 g". */
  packSize: string | null;
  barcode: string | null;
  /** Suggested days from today, used to pre-fill the expiry when unknown. */
  shelfLifeDays: number | null;
  confidence: number | null;
  source: 'openfoodfacts' | 'ai' | 'cache';
}
