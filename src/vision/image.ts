import * as ImageManipulator from 'expo-image-manipulator';

/** Longest edge sent to the API. Beyond this costs latency without helping OCR. */
const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.72;

const SAVE_OPTIONS = {
  format: ImageManipulator.SaveFormat.JPEG,
  compress: JPEG_QUALITY,
  base64: true,
} as const;

export interface PreparedImage {
  uri: string;
  base64: string;
  width: number;
  height: number;
}

/**
 * Downscales and re-encodes a capture before it goes to the network.
 *
 * A raw 12MP phone photo is several megabytes of mostly-irrelevant detail; at
 * 1280px the printed date is still crisp and the upload finishes in a second.
 * An image already within budget is saved straight from the first render rather
 * than being pushed through a second, pointless pass.
 */
export async function prepareForUpload(imageUri: string): Promise<PreparedImage> {
  const original = await ImageManipulator.ImageManipulator.manipulate(imageUri).renderAsync();
  const longest = Math.max(original.width, original.height);

  if (longest <= MAX_EDGE) {
    const saved = await original.saveAsync(SAVE_OPTIONS);
    return { uri: saved.uri, base64: saved.base64 ?? '', width: saved.width, height: saved.height };
  }

  const scale = MAX_EDGE / longest;
  const resized = await ImageManipulator.ImageManipulator.manipulate(original)
    .resize({
      width: Math.round(original.width * scale),
      height: Math.round(original.height * scale),
    })
    .renderAsync();

  const saved = await resized.saveAsync(SAVE_OPTIONS);
  return { uri: saved.uri, base64: saved.base64 ?? '', width: saved.width, height: saved.height };
}
