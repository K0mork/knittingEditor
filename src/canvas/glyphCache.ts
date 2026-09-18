import { svgDataUrl } from '../stitches/catalog';

const images = new Map<string, HTMLImageElement>();
const pending = new Map<string, Promise<HTMLImageElement>>();
const colored = new Map<string, HTMLCanvasElement>();

export function getGlyph(key: string, invalidate: () => void): HTMLImageElement | undefined {
  const ready = images.get(key);
  if (ready) return ready;
  if (!pending.has(key)) {
    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => { images.set(key, image); pending.delete(key); invalidate(); resolve(image); };
      image.onerror = () => { pending.delete(key); reject(new Error(`記号を読み込めません: ${key}`)); };
      image.src = svgDataUrl(key);
    });
    pending.set(key, promise);
  }
  return undefined;
}

export function getColoredGlyph(key: string, color: string, width: number, height: number, invalidate: () => void): CanvasImageSource | undefined {
  const image = getGlyph(key, invalidate);
  if (!image) return undefined;
  const pixelWidth = Math.max(1, Math.round(width));
  const pixelHeight = Math.max(1, Math.round(height));
  const cacheKey = `${key}:${color}:${pixelWidth}:${pixelHeight}`;
  const cached = colored.get(cacheKey);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = pixelWidth;
  canvas.height = pixelHeight;
  const context = canvas.getContext('2d')!;
  context.drawImage(image, 0, 0, pixelWidth, pixelHeight);
  context.globalCompositeOperation = 'source-in';
  context.fillStyle = color;
  context.fillRect(0, 0, pixelWidth, pixelHeight);
  colored.set(cacheKey, canvas);
  if (colored.size > 512) colored.delete(colored.keys().next().value!);
  return canvas;
}
