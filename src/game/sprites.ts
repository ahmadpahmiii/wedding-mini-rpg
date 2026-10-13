import { CELL_W, CELL_H } from '../services/assets';
import type { Facing, Gender } from './types';

/** On-screen size. The cell is 150x224; the painted guests on the map are small. */
export const DRAW_H = 76;
export const DRAW_W = Math.round((CELL_W / CELL_H) * DRAW_H);

/**
 * Sheet layout: 8 cols x 4 rows. Rows 0-1 male, rows 2-3 female.
 * Row N   — front-facing and back-facing poses
 * Row N+1 — the side walk cycle
 * Side frames face LEFT in the art, so "right" is the same frames mirrored.
 */
interface FrameSet { row: number; cols: number[]; flip: boolean }

export function frameSet(gender: Gender, facing: Facing): FrameSet {
  const base = gender === 'pria' ? 0 : 2;
  switch (facing) {
    case 'down':  return { row: base, cols: [0, 1], flip: false };
    case 'up':    return { row: base, cols: [4, 5], flip: false };
    case 'left':  return { row: base + 1, cols: [2, 3], flip: false };
    case 'right': return { row: base + 1, cols: [2, 3], flip: true };
  }
}

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  sheet: ImageBitmap,
  gender: Gender,
  facing: Facing,
  moving: boolean,
  clock: number,
  sx: number,
  sy: number,
): void {
  const { row, cols, flip } = frameSet(gender, facing);
  // 8fps walk cycle; a stopped character holds the first frame.
  const col = moving ? cols[Math.floor(clock / 125) % cols.length] : cols[0];
  const x = Math.round(sx - DRAW_W / 2);
  const y = Math.round(sy - DRAW_H);

  ctx.save();
  if (flip) {
    ctx.translate(x + DRAW_W, y);
    ctx.scale(-1, 1);
    ctx.drawImage(sheet, col * CELL_W, row * CELL_H, CELL_W, CELL_H, 0, 0, DRAW_W, DRAW_H);
  } else {
    ctx.drawImage(sheet, col * CELL_W, row * CELL_H, CELL_W, CELL_H, x, y, DRAW_W, DRAW_H);
  }
  ctx.restore();
}

export function drawShadow(ctx: CanvasRenderingContext2D, sx: number, sy: number): void {
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = '#1b110d';
  ctx.beginPath();
  ctx.ellipse(sx, sy - 2, DRAW_W * 0.28, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Wooden nameplate above a walking guest. Kept short and drawn only for guests
 * near the player — a dozen full names at once turns the garden into a wall of
 * labels and hides the landmark signs behind them.
 */
export function drawNameplate(ctx: CanvasRenderingContext2D, name: string, sx: number, sy: number): void {
  const first = name.split(' ')[0];
  const label = first.length > 9 ? `${first.slice(0, 8)}…` : first;
  ctx.font = '7px "Press Start 2P", monospace';
  const w = Math.ceil(ctx.measureText(label).width) + 10;
  const h = 14;
  const x = Math.round(sx - w / 2);
  const y = Math.round(sy - DRAW_H - h - 4);

  ctx.fillStyle = '#2d1e18';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5);
  ctx.fillStyle = '#fdf6e2';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2 + 1);
}


/**
 * The player's marker, in two halves. Without it a guest cannot tell which of
 * the identical batik-and-peci figures is theirs — the single most confusing
 * thing about the crowd.
 *
 * The ring goes under the sprite; the tag is drawn last, after the floating
 * wishes, so nothing can ever hide the thing that says "you are here".
 */
export function drawPlayerRing(ctx: CanvasRenderingContext2D, sx: number, sy: number): void {
  ctx.save();
  ctx.strokeStyle = '#f4e07b';
  ctx.lineWidth = 2.5;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.ellipse(sx, sy - 2, DRAW_W * 0.34, 7, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = '#f4e07b';
  ctx.fill();
  ctx.restore();
}

export function drawPlayerTag(
  ctx: CanvasRenderingContext2D, sx: number, sy: number, clock: number, inRange = false,
): void {
  const bob = Math.sin(clock / 260) * 3;
  ctx.save();

  // "KAMU" plate
  const label = 'KAMU';
  ctx.font = '7px "Press Start 2P", monospace';
  const w = Math.ceil(ctx.measureText(label).width) + 12;
  const h = 15;
  const x = Math.round(sx - w / 2);
  const y = Math.round(sy - DRAW_H - h - 12 + bob);

  ctx.fillStyle = '#d4af37';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#2d1e18';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = '#2d1e18';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2 + 1);

  // Arrow pointing down at the player
  ctx.fillStyle = '#d4af37';
  ctx.beginPath();
  ctx.moveTo(sx - 5, y + h);
  ctx.lineTo(sx + 5, y + h);
  ctx.lineTo(sx, y + h + 6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#2d1e18';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // In range: a chevron above the tag. The tappable control is the bar above
  // the nav — putting a button up here collides with the tag and sits out of
  // thumb reach anyway.
  if (inRange) {
    const cy2 = y - 8 + bob;
    ctx.fillStyle = '#f4e07b';
    ctx.beginPath();
    ctx.moveTo(sx - 7, cy2 - 7);
    ctx.lineTo(sx + 7, cy2 - 7);
    ctx.lineTo(sx, cy2 + 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#2d1e18';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}
