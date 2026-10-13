import { BOUNDS, blocked } from './landmarks';
import { findPath } from './path';
import type { Facing, Gender, Vec2 } from './types';

const SPEED = 2.6;          // px per 60Hz frame at full magnitude — ~12s to cross the map
/** One 60Hz frame. Movement is scaled by dt against this, so a 120Hz phone does not walk twice as fast. */
const FRAME = 1000 / 60;
const STALL_MS = 1500;
const ARRIVE = 6;           // tap-to-move stop radius
const { minX: MIN_X, maxX: MAX_X, minY: MIN_Y, maxY: MAX_Y } = BOUNDS;

export class Player {
  x: number;
  y: number;
  facing: Facing = 'up';
  moving = false;
  gender: Gender;

  /** Joystick vector, -1..1 on each axis. */
  stick: Vec2 = { x: 0, y: 0 };
  keys = new Set<string>();
  private target: Vec2 | null = null;
  /** Remaining waypoints from the pathfinder; the last one is the real target. */
  private route: Vec2[] = [];
  /** Which way round an obstacle we committed to, so we do not dither at a corner. */
  private slide: 1 | -1 | 0 = 0;
  /** Time without closing on the current waypoint — the anti-freeze guard. */
  private stalled = 0;
  private lastGap = Infinity;

  constructor(spawn: Vec2, gender: Gender) {
    this.x = spawn.x;
    this.y = spawn.y;
    this.gender = gender;
  }

  /**
   * Routes around the scenery rather than pressing into it. Falls back to a
   * straight line only when no route exists at all.
   */
  walkTo(p: Vec2): void {
    this.slide = 0;
    this.route = findPath({ x: this.x, y: this.y }, p);
    this.target = this.route.length ? this.route[0] : { ...p };
    // Where the route really ends — a tap on the fountain ends at its edge,
    // and the marker should say so rather than sit in the water.
    this.finalTarget = { ...(this.route[this.route.length - 1] ?? p) };
    this.stalled = 0;
    this.lastGap = Infinity;
  }

  private finalTarget: Vec2 | null = null;

  /** Where the guest is ultimately headed, for the on-screen marker. */
  get destination(): Vec2 | null { return this.finalTarget; }

  private clearRoute(): void {
    this.target = null;
    this.finalTarget = null;
    this.route = [];
    this.stalled = 0;
    this.lastGap = Infinity;
  }

  /** Move on to the next leg, or stop if that was the last. */
  private nextLeg(): void {
    this.route.shift();
    if (this.route.length) {
      this.target = this.route[0];
      this.stalled = 0;
      this.lastGap = Infinity;
    } else {
      this.clearRoute();
    }
  }

  private keyVector(): Vec2 {
    const k = this.keys;
    const x = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
    const y = (k.has('s') || k.has('arrowdown') ? 1 : 0) - (k.has('w') || k.has('arrowup') ? 1 : 0);
    return { x, y };
  }

  update(dt = FRAME): void {
    const k = Math.min(dt, 48) / FRAME;
    const speed = SPEED * k;
    let dx = 0, dy = 0;

    const kv = this.keyVector();
    if (kv.x || kv.y) {
      this.clearRoute();
      const len = Math.hypot(kv.x, kv.y) || 1; // normalise so diagonals aren't faster
      dx = (kv.x / len) * speed;
      dy = (kv.y / len) * speed;
    } else if (this.stick.x || this.stick.y) {
      this.clearRoute();
      dx = this.stick.x * speed;
      dy = this.stick.y * speed;
    } else if (this.target) {
      const tx = this.target.x - this.x;
      const ty = this.target.y - this.y;
      const d = Math.hypot(tx, ty);
      // Not closing on this waypoint for a second and a half means something
      // is wrong with the route. Skip the leg rather than stand there forever:
      // a guest frozen mid-garden has no way to understand or recover.
      this.stalled = d < this.lastGap - 0.25 * k ? 0 : this.stalled + dt;
      this.lastGap = Math.min(this.lastGap, d);
      if (this.stalled > STALL_MS) {
        this.nextLeg();
        return;
      }
      if (d < ARRIVE) {
        this.nextLeg();
      } else {
        // Never step past the waypoint: a long frame used to overshoot it.
        const s = Math.min(speed, d);
        dx = (tx / d) * s;
        dy = (ty / d) * s;
      }
    }

    if (!dx && !dy) {
      this.moving = false;
      return;
    }

    const x0 = this.x;
    const y0 = this.y;
    if (this.step(dx, dy)) {
      this.slide = 0;
    } else if (this.target) {
      // Walking straight at the target is not enough on this map: the fountain
      // sits in the middle of the path to the pelaminan, and a naive walker
      // presses into it forever. When the direct step is blocked, go round —
      // turn 90 degrees and keep that choice until the direct way opens again.
      const order: (1 | -1)[] = this.slide ? [this.slide, (-this.slide) as 1 | -1] : [1, -1];
      const s = order.find((s) => this.step(-dy * s, dx * s));
      if (s) this.slide = s;
      else this.clearRoute(); // boxed in — give control back rather than shuffling
    }

    // The walk cycle means "actually moved". Pushed into the fountain with the
    // joystick, the guest used to stride on the spot. Facing follows the real
    // motion too, so sliding round a corner never looks like a moonwalk; with
    // no motion at all, face where the guest is pushing.
    const mx = this.x - x0;
    const my = this.y - y0;
    this.moving = Math.hypot(mx, my) > 0.1;
    if (this.moving) this.face(mx, my);
    else this.face(dx, dy);
  }

  /**
   * The dominant axis wins, with a dead band around 45 degrees: a thumb
   * resting on the joystick diagonal wobbles across it constantly, and
   * without the band the sprite flipped between side and front frames
   * dozens of times a second.
   */
  private face(dx: number, dy: number): void {
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    const horiz: Facing = dx > 0 ? 'right' : 'left';
    const vert: Facing = dy > 0 ? 'down' : 'up';
    if (ax > ay * 1.3) this.facing = horiz;
    else if (ay > ax * 1.3) this.facing = vert;
    else if (this.facing !== horiz && this.facing !== vert) this.facing = ax > ay ? horiz : vert;
  }

  /**
   * One axis-separated move. Returns whether real progress was made — not
   * merely whether the position changed. Pressed against the fountain while
   * aiming straight past it, the blocked step still slipped sideways by two
   * hundredths of a pixel, which counted as success and cancelled the detour
   * on every frame. The player inched sideways forever instead of going round.
   */
  private step(dx: number, dy: number): boolean {
    const x0 = this.x;
    const y0 = this.y;
    const nx = clamp(this.x + dx, MIN_X, MAX_X);
    if (!blocked(nx, this.y)) this.x = nx;
    const ny = clamp(this.y + dy, MIN_Y, MAX_Y);
    if (!blocked(this.x, ny)) this.y = ny;
    const wanted = Math.hypot(dx, dy);
    const got = Math.hypot(this.x - x0, this.y - y0);
    return got >= wanted * 0.5;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
