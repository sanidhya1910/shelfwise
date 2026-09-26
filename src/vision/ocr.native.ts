import { recognizeText } from '@infinitered/react-native-mlkit-text-recognition';

import type { OcrEngine } from './ocr';
import type { OcrLine, OcrResult } from './types';

/**
 * Google ML Kit text recognition, running entirely on the device.
 *
 * Lines are flattened out of the block/line tree because the date parser scores
 * one line at a time, and the per-line frame is what gives it the "this text is
 * printed larger, so it is probably the date" signal.
 */
export const ocr: OcrEngine = {
  available: true,

  async recognize(imageUri: string): Promise<OcrResult> {
    const result = await recognizeText(imageUri);

    const lines: OcrLine[] = [];
    for (const block of result.blocks ?? []) {
      for (const line of block.lines ?? []) {
        if (!line.text?.trim()) continue;
        lines.push({
          text: line.text,
          frame: line.frame
            ? {
                left: line.frame.left,
                top: line.frame.top,
                right: line.frame.right,
                bottom: line.frame.bottom,
              }
            : null,
        });
      }
    }

    return {
      text: result.text ?? lines.map((l) => l.text).join('\n'),
      lines,
      engine: 'mlkit',
    };
  },
};
