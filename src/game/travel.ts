/**
 * The trip to the venue: a short side-scroller, as a pure simulation. The
 * component draws a Run and feeds it time and jumps; every rule — the jump,
 * the hits, the finish — is checked headless by scripts/check-travel.mjs,
 * including an autopilot proving every mode can be finished.
 *
 * Units are logical pixels of a fixed 450 x 300 scene, drawn scaled to fit.
 * The scene is a landscape strip even on a portrait phone: at full phone
 * height the road would be so narrow that an obstacle came into view only
 * half a second before it arrived.
 */
export type TravelMode = 'motor' | 'mobil' | 'jalan';

export const W = 450;
export const H = 300;
/** Where wheels and feet meet the road. */
export const GROUND = 250;
/** Centre of the traveller's hitbox. */
export const PLAYER_X = 96;
export const DURATION = 20_000;

const JUMP_V = 700;   // px/s up
const GRAVITY = 1900; // px/s²
const HURT_MS = 1200;
/** The finish arch rolls in this long before the end, so the trip lasts about DURATION. */
const FINISH_LEAD_MS = 1700;
export const HEARTS = 3;

/** Opaque bounds of each obstacle in public/assets/travel/obstacles.png, and its drawn height. */
export const OBSTACLES: { src: [number, number, number, number]; h: number }[] = [
  { src: [21, 72, 127, 66], h: 26 },    // 0 sand pile
  { src: [180, 72, 152, 46], h: 14 },   // 1 speed bump
  { src: [379, 31, 96, 117], h: 40 },   // 2 cone
  { src: [11, 215, 148, 86], h: 22 },   // 3 puddle
  { src: [180, 210, 152, 101], h: 38 }, // 4 rice sacks
  { src: [384, 210, 101, 101], h: 28 }, // 5 coconut
  { src: [26, 369, 112, 122], h: 40 },  // 6 chicken
  { src: [195, 369, 116, 116], h: 38 }, // 7 cat
  { src: [369, 404, 116, 87], h: 20 },  // 8 banana peel
];
export const obstacleW = (kind: number) => {
  const [, , sw, sh] = OBSTACLES[kind].src;
  return Math.round((sw / sh) * OBSTACLES[kind].h);
};

/** Same mechanic for all three; what differs is how they look and what is in the road. */
export const MODES: Record<TravelMode, {
  name: string; sub: string; obstacles: number[];
  /** Drawn height of the traveller, and the hitbox — narrower than the art, to be fair. */
  drawH: number; box: { w: number; h: number };
}> = {
  motor: { name: 'MOTOR', sub: 'Lincah lewat jalan kampung', obstacles: [0, 1, 2, 3], drawH: 92, box: { w: 56, h: 70 } },
  mobil: { name: 'MOBIL', sub: 'Santai, ber-AC', obstacles: [1, 2, 4, 5], drawH: 64, box: { w: 84, h: 50 } },
  jalan: { name: 'JALAN KAKI', sub: 'Sambil menyapa tetangga', obstacles: [3, 6, 7, 8], drawH: 84, box: { w: 26, h: 70 } },
};

export const FINISH_H = 210;
export const FINISH_W = Math.round((432 / 511) * FINISH_H);

export interface Obstacle { kind: number; x: number; hit: boolean }

export interface Run {
  mode: TravelMode;
  t: number;
  dist: number;
  /** Height above the road. */
  lift: number;
  vy: number;
  hearts: number;
  /** Time left of the blink after a hit, during which nothing else can hurt. */
  hurt: number;
  obstacles: Obstacle[];
  gapLeft: number;
  /** Left edge of the finish arch, once it is on its way. */
  finishX: number | null;
  outcome: 'arrived' | 'tumbled' | null;
  rand: () => number;
}

/** Seeded, so a test run is the same run every time. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRun(mode: TravelMode, seed = Math.floor(Math.random() * 2 ** 31)): Run {
  return {
    mode, t: 0, dist: 0, lift: 0, vy: 0, hearts: HEARTS, hurt: 0,
    obstacles: [], gapLeft: 160, finishX: null, outcome: null, rand: mulberry32(seed),
  };
}

/** Ramps gently, so the end is a little livelier than the start. */
export const speedAt = (t: number) => 240 + 50 * Math.min(1, t / DURATION);

/** The traveller's hitbox: left, right, bottom, top, with y growing upward from the road. */
export function playerBox(r: Run) {
  const { w, h } = MODES[r.mode].box;
  return { l: PLAYER_X - w / 2, r: PLAYER_X + w / 2, b: r.lift, t: r.lift + h };
}

/** Inset from the art, so a near miss is a miss. */
export function obstacleBox(o: Obstacle) {
  const w = obstacleW(o.kind);
  const h = OBSTACLES[o.kind].h;
  return { l: o.x + w * 0.18, r: o.x + w * 0.82, b: 0, t: h * 0.85 };
}

/** Advances the run in place. A jump only starts from the road. */
export function tick(r: Run, dtMs: number, jump: boolean): void {
  if (r.outcome) return;
  const ms = Math.min(dtMs, 48); // a backgrounded tab must not teleport anyone
  const dt = ms / 1000;
  r.t += ms;
  const dx = speedAt(r.t) * dt;
  r.dist += dx;

  if (jump && r.lift === 0) r.vy = JUMP_V;
  if (r.lift > 0 || r.vy > 0) {
    r.lift += r.vy * dt;
    r.vy -= GRAVITY * dt;
    if (r.lift <= 0) { r.lift = 0; r.vy = 0; }
  }

  for (const o of r.obstacles) o.x -= dx;
  r.obstacles = r.obstacles.filter((o) => o.x + obstacleW(o.kind) > -20);

  if (r.finishX === null) {
    if (r.t >= DURATION - FINISH_LEAD_MS) {
      r.finishX = W + 40;
    } else if ((r.gapLeft -= dx) <= 0) {
      const set = MODES[r.mode].obstacles;
      r.obstacles.push({ kind: set[Math.floor(r.rand() * set.length)], x: W + 10, hit: false });
      r.gapLeft = 300 + r.rand() * 200;
    }
  } else {
    r.finishX -= dx;
    // Through the arch: arrived, hearts or not.
    if (r.finishX + FINISH_W / 2 <= PLAYER_X) r.outcome = 'arrived';
  }

  r.hurt = Math.max(0, r.hurt - ms);
  if (r.hurt === 0) {
    const p = playerBox(r);
    const hit = r.obstacles.find((o) => {
      if (o.hit) return false;
      const b = obstacleBox(o);
      return p.l < b.r && p.r > b.l && p.b < b.t;
    });
    if (hit) {
      hit.hit = true;
      r.hearts -= 1;
      r.hurt = HURT_MS;
      if (r.hearts <= 0) r.outcome = 'tumbled';
    }
  }
}
