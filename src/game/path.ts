import { blocked, inBounds, WORLD_H, WORLD_W } from './landmarks';
import type { Vec2 } from './types';

/**
 * Grid pathfinding for tap-to-move and the bottom navigation.
 *
 * Walking straight at the target and sliding along whatever it hits gets
 * pinned in corners: eleven of the thirty routes between destinations could
 * not be completed, including anything from the pelaminan to the photobox.
 * Wall-following always has cases like that. A* does not.
 *
 * The joystick and keyboard do not use this — those are direct control, and
 * the guest does their own steering.
 */
const CELL = 16;
const COLS = Math.ceil(WORLD_W / CELL);
const ROWS = Math.ceil(WORLD_H / CELL);

/** Keeps paths off the wall by roughly half a body width. */
const CLEARANCE = 10;

const walkable = new Uint8Array(COLS * ROWS);
for (let cy = 0; cy < ROWS; cy++) {
  for (let cx = 0; cx < COLS; cx++) {
    const x = cx * CELL + CELL / 2;
    const y = cy * CELL + CELL / 2;
    // Sample the centre plus a ring, so a path never shaves a corner the
    // player's own collision box would catch on.
    const clear =
      inBounds(x, y) &&
      !blocked(x, y) &&
      !blocked(x - CLEARANCE, y) && !blocked(x + CLEARANCE, y) &&
      !blocked(x, y - CLEARANCE) && !blocked(x, y + CLEARANCE);
    walkable[cy * COLS + cx] = clear ? 1 : 0;
  }
}

const idx = (cx: number, cy: number) => cy * COLS + cx;
const inside = (cx: number, cy: number) => cx >= 0 && cx < COLS && cy >= 0 && cy < ROWS;
const toCell = (p: Vec2) => ({
  cx: Math.max(0, Math.min(COLS - 1, Math.floor(p.x / CELL))),
  cy: Math.max(0, Math.min(ROWS - 1, Math.floor(p.y / CELL))),
});
const toWorld = (cx: number, cy: number): Vec2 => ({ x: cx * CELL + CELL / 2, y: cy * CELL + CELL / 2 });

/**
 * Nearest walkable cell, for a tap that lands on scenery. Of the equally near
 * ones, the one closest to `prefer` (the guest) wins: tapping the fountain from
 * below used to send the guest all the way round to its top-right corner,
 * simply because that corner came first in the scan.
 */
function nearestOpen(cx: number, cy: number, prefer?: Vec2): { cx: number; cy: number } | null {
  if (inside(cx, cy) && walkable[idx(cx, cy)]) return { cx, cy };
  for (let r = 1; r <= 14; r++) {
    let best: { cx: number; cy: number; d: number } | null = null;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = cx + dx, ny = cy + dy;
        if (!inside(nx, ny) || !walkable[idx(nx, ny)]) continue;
        const w = toWorld(nx, ny);
        const d = prefer ? Math.hypot(w.x - prefer.x, w.y - prefer.y) : 0;
        if (!best || d < best.d) best = { cx: nx, cy: ny, d };
      }
    }
    if (best) return best;
  }
  return null;
}

/** True when nothing blocks the straight line between two points. */
function clearLine(a: Vec2, b: Vec2): boolean {
  const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 6);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    if (!inBounds(x, y) || blocked(x, y)) return false;
    if (blocked(x - CLEARANCE, y) || blocked(x + CLEARANCE, y)) return false;
    if (blocked(x, y - CLEARANCE) || blocked(x, y + CLEARANCE)) return false;
  }
  return true;
}

const NEIGHBOURS: [number, number, number][] = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];

/**
 * A* over the grid, then string-pulled: waypoints that can see each other are
 * collapsed, so the player walks a natural line rather than a staircase.
 * Returns an empty array when there is no route.
 */
export function findPath(from: Vec2, to: Vec2): Vec2[] {
  const a = nearestOpen(toCell(from).cx, toCell(from).cy);
  const b = nearestOpen(toCell(to).cx, toCell(to).cy, from);
  if (!a || !b) return [];
  const start = idx(a.cx, a.cy);
  const goal = idx(b.cx, b.cy);
  // Finish on the real target, not its cell centre — unless the target is
  // scenery, in which case the open cell beside it is where the walk ends.
  const end = blocked(to.x, to.y) ? toWorld(b.cx, b.cy) : to;
  if (start === goal) return [end];

  const g = new Float32Array(COLS * ROWS).fill(Infinity);
  const f = new Float32Array(COLS * ROWS).fill(Infinity);
  const came = new Int32Array(COLS * ROWS).fill(-1);
  const open = new Set<number>([start]);
  const h = (i: number) =>
    Math.hypot((i % COLS) - b.cx, Math.floor(i / COLS) - b.cy);
  g[start] = 0;
  f[start] = h(start);

  while (open.size) {
    let cur = -1;
    let best = Infinity;
    for (const i of open) if (f[i] < best) { best = f[i]; cur = i; }
    if (cur === goal) break;
    open.delete(cur);
    const cx = cur % COLS, cy = Math.floor(cur / COLS);
    for (const [dx, dy, cost] of NEIGHBOURS) {
      const nx = cx + dx, ny = cy + dy;
      if (!inside(nx, ny) || !walkable[idx(nx, ny)]) continue;
      // No squeezing diagonally between two blocked cells.
      if (dx && dy && (!walkable[idx(cx + dx, cy)] || !walkable[idx(cx, cy + dy)])) continue;
      const n = idx(nx, ny);
      const tentative = g[cur] + cost;
      if (tentative < g[n]) {
        came[n] = cur;
        g[n] = tentative;
        f[n] = tentative + h(n);
        open.add(n);
      }
    }
  }
  if (came[goal] === -1) return [];

  const cells: number[] = [goal];
  for (let i = goal; came[i] !== -1; i = came[i]) cells.unshift(came[i]);
  const raw = cells.map((i) => toWorld(i % COLS, Math.floor(i / COLS)));
  raw[raw.length - 1] = end;

  const pulled: Vec2[] = [];
  let anchor: Vec2 = from;
  for (let i = 0; i < raw.length; i++) {
    const next = raw[i + 1];
    if (!next || !clearLine(anchor, next)) {
      pulled.push(raw[i]);
      anchor = raw[i];
    }
  }
  return pulled;
}
