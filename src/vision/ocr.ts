/** Type contract; Metro swaps in the platform file. */
import type { OcrResult } from './types';

export interface OcrEngine {
  readonly available: boolean;
  /** Reads printed text from a local image file URI. */
  recognize(imageUri: string): Promise<OcrResult>;
}

export const ocr: OcrEngine = {
  available: false,
  async recognize() {
    return { text: '', lines: [], engine: 'none' };
  },
};
