import { blocked } from './landmarks';
import { admit, chooseGuests, NPC_CAP, NPC_MALE, NPC_FEMALE } from './roster';
import type { Facing, Gender, Wish } from './types';

export { admit, NPC_CAP, NPC_MALE, NPC_FEMALE };

const SPEED = 0.85; // a stroll. They are ambience; anything faster reads as traffic.

/**
 * A seeded guest: one submitted wish, given a body and a walking loop.
 * This is what replaces real multiplayer — the garden is busy for the first
 * visitor at 2am, with nothing to run and nothing to moderate.
 */
export class Npc {
  x: number;
  y: number;
  facing: Facing = 'down';
  moving = false;
  gender: Gender;
  readonly wish: Wish;

  private tx: number;
  private ty: number;
  private pause = 0;

  constructor(wish: Wish, x: number, y: number, gender: Gender) {
    this.wish = wish;
    this.x = x;
    this.y = y;
    this.gender = gender;
    this.tx = x;
    this.ty = y;
    this.pickTarget();
  }

  /** Short wanders around where they already are, so nobody crosses the map. */
  private pickTarget(): void {
    for (let i = 0; i < 12; i++) {
      const x = this.x + (Math.random() - 0.5) * 150;
      const y = this.y + (Math.random() - 0.5) * 150;
      if (x > 40 && x < 720 && y > 366 && y < 1290 && !blocked(x, y)) {
        this.tx = x; this.ty = y; return;
      }
    }
    this.tx = this.x;
    this.ty = this.y;
  }

  update(dt: number): void {
    if (this.pause > 0) {
      this.pause -= dt;
      this.moving = false;
      return;
    }
    const dx = this.tx - this.x;
    const dy = this.ty - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 4) {
      this.pause = 5000 + Math.random() * 7000; // long stands, short walks
      this.pickTarget();
      this.moving = false;
      return;
    }

    // Scaled by dt: per-frame steps made guests stroll twice as fast on 120Hz screens.
    const step = Math.min(SPEED * (Math.min(dt, 48) / (1000 / 60)), d);
    const vx = (dx / d) * step;
    const vy = (dy / d) * step;
    this.facing = Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 'right' : 'left') : vy > 0 ? 'down' : 'up';

    const x0 = this.x;
    const y0 = this.y;
    if (!blocked(this.x + vx, this.y)) this.x += vx;
    if (!blocked(this.x, this.y + vy)) this.y += vy;

    // `moving` drives the walk cycle, so it has to mean "actually moved".
    // Setting it unconditionally made a guest wedged against the gazebo or the
    // gift table stride on the spot forever.
    this.moving = Math.hypot(this.x - x0, this.y - y0) > step * 0.25;
    if (!this.moving) {
      this.pickTarget();
      this.pause = 500 + Math.random() * 1200; // stand a moment, then try elsewhere
    }
  }
}

const MIN_X = 40, MAX_X = 720, MIN_Y = 380, MAX_Y = 1260;

/**
 * Nudges a spawn point out of whatever it landed inside. The hand-placed
 * positions below looked fine on the map but one of them sat squarely in the
 * gift table, and a guest who starts inside a blocker can never leave it.
 */
export function freeSpot(x: number, y: number): { x: number; y: number } {
  const cx = Math.max(MIN_X, Math.min(MAX_X, x));
  const cy = Math.max(MIN_Y, Math.min(MAX_Y, y));
  if (!blocked(cx, cy)) return { x: cx, y: cy };
  for (let r = 24; r <= 240; r += 24) {
    for (let a = 0; a < 12; a++) {
      const t = (a / 12) * Math.PI * 2;
      const nx = Math.max(MIN_X, Math.min(MAX_X, cx + Math.cos(t) * r));
      const ny = Math.max(MIN_Y, Math.min(MAX_Y, cy + Math.sin(t) * r));
      if (!blocked(nx, ny)) return { x: nx, y: ny };
    }
  }
  return { x: 384, y: 1180 }; // the open path by the arch, always walkable
}

export function spawnNpcs(wishes: Wish[]): Npc[] {
  const chosen = chooseGuests(wishes);
  const max = chosen.length || 1;
  return chosen
    .map((w, i) => {
      // Spread down the length of the garden, and kept off the central path so
      // the player is never standing in a row of identical strangers.
      const angle = i * 2.399; // golden angle — no visible rows or clumps
      const side = i % 2 === 0 ? -1 : 1;
      const x = 384 + side * (120 + (i % 3) * 55) + Math.cos(angle) * 30;
      const y = 400 + ((i + 0.5) / max) * 780 + Math.sin(angle) * 50;
      // Kept off the pelaminan dais so nobody stands in front of the couple.
      const spot = freeSpot(x, y);
      return new Npc(w, spot.x, spot.y, w.gender);
    });
}
