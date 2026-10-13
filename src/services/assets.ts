/**
 * Asset preloading, with the checkerboard fix.
 *
 * guest_characters_spritesheet.jpg and couple_pelaminan.jpg are JPEGs with the
 * grey/white "transparency" checkerboard painted into the pixels — there is no
 * alpha channel. Drawn straight to canvas, every character sits on a grid.
 *
 * We chroma-key it once, here, while the preloader is already on screen: a
 * flood fill inward from the border removes connected background only, so the
 * bride's white dress and the groom's white kopyah survive because they are
 * enclosed by the character.
 */

export interface LoadedAssets {
  map: ImageBitmap;
  sprites: ImageBitmap;
  couple: ImageBitmap;
}

const BG_MAX_SAT = 26;  // checkerboard greys are neutral; skin and cloth are not
const BG_MIN_LUM = 168; // ...and light

function isBackgroundPixel(d: Uint8ClampedArray, i: number): boolean {
  const r = d[i], g = d[i + 1], b = d[i + 2];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max - min <= BG_MAX_SAT && (r * 0.299 + g * 0.587 + b * 0.114) >= BG_MIN_LUM;
}

/**
 * Flood fill from every border pixel, 4-connected. Anything reachable from
 * outside and matching the background test becomes transparent.
 */
function keyOutCheckerboard(img: ImageBitmap): ImageBitmap | HTMLCanvasElement {
  const { width: w, height: h } = img;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  if (!ctx) return img;
  ctx.drawImage(img, 0, 0);

  const image = ctx.getImageData(0, 0, w, h);
  const d = image.data;
  const seen = new Uint8Array(w * h);
  // Int32Array as a ring-free stack: ~1M pixels worst case, still only 4MB.
  const stack = new Int32Array(w * h);
  let sp = 0;

  const push = (p: number) => {
    if (seen[p]) return;
    if (!isBackgroundPixel(d, p * 4)) return;
    seen[p] = 1;
    stack[sp++] = p;
  };

  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }

  while (sp > 0) {
    const p = stack[--sp];
    d[p * 4 + 3] = 0;
    const x = p % w;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (p >= w) push(p - w);
    if (p < (h - 1) * w) push(p + w);
  }

  ctx.putImageData(image, 0, 0);
  return cv;
}

async function loadBitmap(url: string, onBytes: (n: number) => void): Promise<ImageBitmap> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  const blob = await res.blob();
  onBytes(blob.size);
  return createImageBitmap(blob);
}

export async function preloadAssets(onProgress: (pct: number) => void): Promise<LoadedAssets> {
  // Rough weights so the bar moves proportionally to real work, not file count.
  const total = 613_238 + 743_810 + 746_864;
  let done = 0;
  const bump = (n: number) => {
    done += n;
    onProgress(Math.min(0.92, done / total));
  };

  const [map, rawSprites, rawCouple] = await Promise.all([
    loadBitmap('/assets/map/world_map_base.jpg', bump),
    loadBitmap('/assets/characters/guest_characters_spritesheet.jpg', bump),
    loadBitmap('/assets/characters/couple_pelaminan.jpg', bump),
  ]);

  // Yield a frame so the bar paints before the (blocking) pixel pass.
  await new Promise(requestAnimationFrame);
  const sprites = await createImageBitmap(keyOutCheckerboard(rawSprites));
  onProgress(0.97);
  const couple = await createImageBitmap(keyOutCheckerboard(rawCouple));

  await document.fonts.ready.catch(() => undefined);
  onProgress(1);
  return { map, sprites, couple };
}

/** Spritesheet is 8 columns x 4 rows at 150x224 — NOT the 8x8/150x112 in prd.md. */
export const CELL_W = 150;
export const CELL_H = 224;
export const COLS = 8;
