export interface CropRect {
  /** All values are in the source image's natural pixel coordinates. */
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Longest edge of a stored image. Keeps uploads well under the function limit. */
const MAX_EDGE = 1600;

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('That file could not be read as an image.'));
    img.src = src;
  });
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('That file could not be read.'));
    reader.readAsDataURL(file);
  });
}

function encode(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else
          canvas.toBlob(
            (fallback) =>
              fallback ? resolve(fallback) : reject(new Error('Could not encode the image.')),
            'image/jpeg',
            0.88,
          );
      },
      'image/webp',
      0.9,
    );
  });
}

/** Renders the chosen region of the source image to a bounded, compressed blob. */
export async function cropToBlob(image: HTMLImageElement, rect: CropRect): Promise<Blob> {
  const scale = Math.min(1, MAX_EDGE / Math.max(rect.w, rect.h));
  const width = Math.max(1, Math.round(rect.w * scale));
  const height = Math.max(1, Math.round(rect.h * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser could not open a drawing canvas.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h, 0, 0, width, height);
  return encode(canvas);
}
