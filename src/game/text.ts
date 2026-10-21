/** Canvas text layout for the world overlays. */

/** Just enough of a canvas context to measure, so the checks can run headless. */
export interface Measurer {
  measureText(text: string): { width: number };
}

/**
 * Chop one word into pieces that each fit `maxW`.
 *
 * A guest can paste a link into their ucapan, and a 40-character URL has no
 * space to break on — left alone it runs straight off the card and off the
 * screen. Breaking mid-word is ugly; text lying in the grass is uglier.
 */
export function splitWord(ctx: Measurer, word: string, maxW: number): string[] {
  if (ctx.measureText(word).width <= maxW) return [word];
  const parts: string[] = [];
  let part = '';
  for (const ch of word) {
    if (part && ctx.measureText(part + ch).width > maxW) {
      parts.push(part);
      part = ch;
    } else {
      part += ch;
    }
  }
  if (part) parts.push(part);
  return parts;
}

export function wrap(
  ctx: CanvasRenderingContext2D, text: string, x: number, y: number,
  maxW: number, lh: number, maxLines: number,
): void {
  const words = text.split(' ').flatMap((w) => splitWord(ctx, w, maxW));
  let line = '';
  let lines = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y + lines * lh);
      lines++;
      if (lines >= maxLines) return;
      line = word;
    } else {
      line = test;
    }
  }
  if (lines < maxLines) ctx.fillText(line, x, y + lines * lh);
}
