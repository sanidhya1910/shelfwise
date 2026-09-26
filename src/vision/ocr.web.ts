import type { OcrEngine } from './ocr';

/**
 * The web build does no scanning, so it ships without an OCR engine rather than
 * pulling a WASM model into the bundle.
 *
 * Defined inline rather than re-exported from './ocr' — on web Metro resolves
 * that specifier back to this same file, which would recurse forever.
 */
export const ocr: OcrEngine = {
  available: false,
  async recognize() {
    return { text: '', lines: [], engine: 'none' };
  },
};
