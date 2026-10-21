import type { Landmark, Vec2 } from './types';

export const WORLD_W = 768;
export const WORLD_H = 1376;

/**
 * Measured off public/assets/map/world_map_base.jpg (world_map_v2.jpg is the
 * same painting with the buffet in the tent), not copied from prd.md —
 * six of the eight coordinates documented there do not match the painting.
 */
// The couple are painted into the map at the pelaminan now, so the stand point
// sits down on the red carpet: characters draw over the map, and anyone standing
// on the dais would hide the bride and groom.
export const LANDMARKS: Landmark[] = [
  { id: 'pelaminan',     label: 'PASANGAN', target: 'pasangan',  x: 384, y: 255,  sx: 384, sy: 342,  radius: 78, signOffset: 46 },
  // At the foot of the stage steps. It used to be 292,470 — off to the side,
  // round the speaker — so the ring lit up somewhere nobody would stand.
  { id: 'panggung',      label: 'ACARA',    target: 'acara',     x: 125, y: 465,  sx: 165, sy: 640,  radius: 78, signOffset: 42 },
  // The wishing tree already holds paper wishes in the art, so it is where
  // ucapan and RSVP belong. The fountain is scenery — it has no modal of its
  // own since Sapa Tamu was dropped, but it still blocks and still sprays.
  { id: 'pohon-harapan', label: 'UCAPAN & RSVP', target: 'rsvp',      x: 600, y: 930,  sx: 520, sy: 958,  radius: 78, signOffset: 44 },
  // The lovestory gazebo is a place to sit and talk. Keys 1-6 follow this order.
  { id: 'gazebo',        label: 'NGOBROL',  target: 'ngobrol',   x: 165, y: 820,  sx: 165, sy: 966,  radius: 78, signOffset: 44 },
  { id: 'kios-photobox', label: 'PHOTOBOX', target: 'photobox',  x: 650, y: 1065, sx: 628, sy: 1175, radius: 78, signOffset: 52 },
  // The painted gift table, with its chests and wrapped box, hands out the
  // virtual gift a guest carries up to the pelaminan.
  { id: 'meja-hadiah',   label: 'HADIAH',   target: 'hadiah',    x: 140, y: 1055, sx: 200, sy: 1160, radius: 78, signOffset: 40 },
  // The gallery tent, repainted as the buffet (world_map_v2.jpg). Desktop locks
  // the camera to x 144-624, so the sign and the stand point keep to the
  // tent's left side rather than its centre, which is off that screen.
  { id: 'prasmanan',     label: 'PRASMANAN', target: 'buffet',   x: 572, y: 500,  sx: 600, sy: 640,  radius: 78, signOffset: 70 },
];

/**
 * The stone path just inside the flower arch. The PRD spawned at 384,650 —
 * the exact centre of the fountain — so the guest started standing in water.
 * Arriving at the gate and walking up the garden is the journey the map was painted for.
 */
export const SPAWN: Vec2 = { x: 384, y: 1230 };

/** Coarse blockers. Per-pixel collision buys nothing here and costs a mask. */
export const BLOCKERS: readonly [number, number, number, number][] = [
  [96, 60, 576, 200],   // pelaminan platform + carved backdrop
  [20, 370, 230, 190],  // gamelan gazebo floor
  [278, 572, 212, 220], // fountain basin, extended down so a 76px sprite stops clear of the water
  [545, 360, 223, 242], // buffet tent, down to the table's gold skirt
  [58, 745, 210, 185],  // lovestory gazebo
  [566, 880, 70, 80],   // wishing tree trunk — the canopy is walk-behind
  [20, 990, 250, 130],  // gift table, chests and all
  [588, 1000, 130, 128], // photobox kiosk
  [0, 1290, 260, 30],   // garden wall, left of the arch
  [508, 1290, 260, 30], // garden wall, right of the arch
];

/**
 * Where a body may stand. The pathfinder needs these as much as the player
 * does: routed through a gap the player is clamped out of, it aims at a
 * waypoint that can never be reached and the guest stops dead.
 */
/**
 * Where the camera sits on one axis: follow `want`, but never past the edge of
 * the painting, so the stage is always full of map.
 */
export function camClamp(want: number, view: number, world: number): number {
  return Math.max(0, Math.min(want, world - view));
}

export const BOUNDS = { minX: 16, maxX: WORLD_W - 16, minY: 120, maxY: WORLD_H - 26 };

export function inBounds(x: number, y: number): boolean {
  return x >= BOUNDS.minX && x <= BOUNDS.maxX && y >= BOUNDS.minY && y <= BOUNDS.maxY;
}

export function blocked(x: number, y: number): boolean {
  for (const [bx, by, bw, bh] of BLOCKERS) {
    if (x > bx && x < bx + bw && y > by && y < by + bh) return true;
  }
  return false;
}

/**
 * The trigger zone is an ellipse flattened to the map's three-quarter view,
 * and it is exactly the ring the engine draws. It used to be a circle twice
 * the height of the drawn ring, so the prompt fired while the guest was
 * visibly standing outside it.
 */
export const ZONE_SQUASH = 0.5;

/**
 * The landmark whose scenery is at this point, if any. A tap on the stage or
 * the chests means "go there": walking to the open ground nearest the tap
 * stopped the guest just outside the ring, and the prompt never came up.
 */
export function landmarkAt(x: number, y: number): Landmark | null {
  // The floating sign boards read as buttons, so they act like them. Sized as
  // the engine draws them: 8px glyphs, a "+ " prefix, 16px padding, 20px tall,
  // on a 12px post.
  for (const l of LANDMARKS) {
    const half = ((l.label.length + 2) * 8 + 16) / 2;
    const base = l.y - l.signOffset;
    if (Math.abs(x - l.x) <= half && y >= base - 20 && y <= base + 12) return l;
  }
  const box = BLOCKERS.find(([bx, by, bw, bh]) => x > bx && x < bx + bw && y > by && y < by + bh);
  if (!box) return null;
  const [bx, by, bw, bh] = box;
  return LANDMARKS.find((l) => l.x > bx && l.x < bx + bw && l.y > by && l.y < by + bh) ?? null;
}

export function nearest(x: number, y: number): { lm: Landmark; dist: number } | null {
  let best: { lm: Landmark; dist: number } | null = null;
  for (const lm of LANDMARKS) {
    // 0 at the stand point, 1 on the ring.
    const d = Math.hypot((lm.sx - x) / lm.radius, (lm.sy - y) / (lm.radius * ZONE_SQUASH));
    if (d <= 1 && (!best || d < best.dist)) best = { lm, dist: d };
  }
  return best;
}
