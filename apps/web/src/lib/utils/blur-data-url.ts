import { decode } from 'blurhash';

const cache = new Map<string, string>();

export function getBlurDataUrl(hash: string | null, size = 32): string | undefined {
  if (!hash || typeof document === 'undefined') {
    return undefined;
  }

  const cached = cache.get(hash);
  if (cached) {
    return cached;
  }

  try {
    const pixels = decode(hash, size, size);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return undefined;
    }
    const imageData = ctx.createImageData(size, size);
    imageData.data.set(pixels);
    ctx.putImageData(imageData, 0, 0);
    const dataUrl = canvas.toDataURL();
    cache.set(hash, dataUrl);
    return dataUrl;
  } catch {
    return undefined;
  }
}
