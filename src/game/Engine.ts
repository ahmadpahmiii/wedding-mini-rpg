import { LANDMARKS, SPAWN, WORLD_W, WORLD_H, ZONE_SQUASH, camClamp, landmarkAt, nearest } from './landmarks';
import { Player } from './Player';
import { Npc, spawnNpcs, freeSpot, admit } from './Npc';
import { Particles, detectProfile } from './Particles';
import { drawSprite, drawShadow, drawNameplate, drawPlayerRing, drawPlayerTag, DRAW_H, DRAW_W } from './sprites';
import type { Destination, Facing, Gender, GiftItem, Landmark, Vec2, Wish } from './types';
import { beatOf, gestureFor, startMeet, stepMeet, type Beat, type Gesture, type Meet, type Who } from './meet';
import type { LoadedAssets } from '../services/assets';
import { GIFTS, GIFT_CELL, GIFT_SHEET, giftIndex } from '../data/gifts';
import { baseRow, outfitLook, type Look, type OutfitId } from '../data/outfits';
import { wrap } from './text';

const LERP = 0.08;

export interface EngineHooks {
  onProximity: (lm: Landmark | null) => void;
  onNpcTap: (npc: Npc) => void;
  /** Each beat of the meeting on the pelaminan; null when it is called off. */
  onMeet: (beat: Beat | null) => void;
  onFps?: (fps: number) => void;
}

interface FloatingWish { wish: Wish; x: number; y: number; life: number }
// Ucapan & RSVP lives at the tree, so guests now stand where the bubbles rise.
// Fewer and further apart keeps two cards from stacking on each other.
const WISH_LIFE = 9000;
const WISH_MAX = 2;
/** Half-width of a guest's tap target, in world px. */
const TAP_REACH = 46;

/** Where the couple sit, painted into the map. */
const PELAMINAN = LANDMARKS.find((l) => l.id === 'pelaminan')!;
const HOP_MS = 420;
const FLIGHT_MS = 520;
interface Heart { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string }
const HEART = ['.X.X.', 'XXXXX', 'XXXXX', '.XXX.', '..X..'];

/**
 * The couple as painted into the map, measured off it: each one's centre, and
 * the spot beside them where a guest stands to greet them — beside, not in
 * front, because characters draw over the painting and would cover their faces.
 */
const COUPLE: Record<Who, { x: number; spot: Vec2; face: Facing }> = {
  groom: { x: 370, spot: { x: 336, y: 304 }, face: 'right' },
  bride: { x: 402, spot: { x: 436, y: 304 }, face: 'left' },
};
/** From the groom to the bride the guest steps down and round, not across the couple. */
const DIP: Vec2 = { x: 386, y: 334 };
const HEAD_Y = 212;
const MEET_SPEED = 0.11; // px/ms: an unhurried step
interface Bubble { text: string; x: number; y: number; delay: number; life: number; max: number }
const SALAMAN_ICONS = '/assets/game/salaman_icons.png';
const GESTURE_CELL: Record<Gesture | 'doa', number> = { jabat: 0, salam: 1, doa: 2 };
const GESTURE_EMOJI: Record<Gesture | 'doa', string> = { jabat: '🤝', salam: '🙏', doa: '🤲' };

/**
 * The couple as standing sprites — public/assets/photobooth/couple.png,
 * 2 cols × 4 rows of 150 × 224. Row 0 standing, 1 peace, 2 finger heart, 3 wave.
 * Col 0 groom, col 1 bride.
 */
const COUPLE_CELL_W = 150;
const COUPLE_CELL_H = 224;
type CouplePose = 0 | 1 | 2 | 3;
const REACT_POSES: CouplePose[] = [1, 2, 3]; // peace, finger heart, wave

/** Camera zoom during salaman: eases to 1.6× and back. */
const ZOOM_TARGET = 1.6;
const ZOOM_IN_MS = 600;
const ZOOM_OUT_MS = 500;
type ZoomPhase = 'in' | 'hold' | 'out' | null;

/** Confetti particle for the celebration burst. */
interface Confetti {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number; size: number; color: string; rot: number; vr: number;
}
const CONFETTI_COLORS = ['#f4e07b', '#e8687f', '#7ec8e3', '#f7c8d8', '#d4af37', '#fdf6e2'];

/** A golden sparkle during the hold. */
interface MeetSparkle { x: number; y: number; vx: number; vy: number; life: number; max: number }

/** Light ray during the doa. */
interface LightRay { x: number; w: number; a: number; speed: number }

export class Engine {
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private last = 0;
  private clock = 0;
  private camX = 0;
  private camY = 0;
  private vw = 0;
  private vh = 0;
  private dpr = 1;
  private profile = detectProfile();
  private particles: Particles;
  private npcs: Npc[];
  private floats: FloatingWish[] = [];
  private nextFloat = 2000;
  private wishes: Wish[];
  private inRange: Landmark | null = null;
  private frames = 0;
  private fpsAt = 0;
  /** Modals pause ambience but never the world — it keeps breathing behind them. */
  quiet = false;
  /** The virtual gift in the guest's hands. The app owns it; the engine only draws it. */
  held: GiftItem | null = null;
  private giftSheet = Object.assign(new Image(), { src: GIFT_SHEET });
  private hearts: Heart[] = [];
  /** A gift on its way from the guest's hands to the couple, in world px. */
  private flight: { item: GiftItem; t: number; x: number; y: number } | null = null;
  private hop = 0;
  private look: Look;
  /** The meeting on the pelaminan, while it lasts. */
  private meet: { m: Meet; body: Gender; name: string; path: Vec2[] } | null = null;
  /** The action button is held down: the handshake itself. */
  holding = false;
  private bubbles: Bubble[] = [];
  private gesture: { kind: Gesture | 'doa'; x: number; y: number; life: number } | null = null;
  private icons = Object.assign(new Image(), { src: SALAMAN_ICONS });

  // --- Option C: Hybrid salaman VFX ---
  /** Camera zoom state during salaman. */
  private zoom: { phase: ZoomPhase; t: number; scale: number } = { phase: null, t: 0, scale: 1 };
  /** Couple pose for each (changes on react beats). */
  private couplePose: Record<Who, CouplePose> = { groom: 0, bride: 0 };
  /** Confetti burst at the celebration. */
  private confetti: Confetti[] = [];
  /** Golden sparkles during the hold mechanic. */
  private meetSparkles: MeetSparkle[] = [];
  /** Light rays during the doa. */
  private lightRays: LightRay[] = [];
  /** Warm tint overlay: 0 = none, 1 = full. */
  private warmth = 0;
  /** Dim overlay for the doa: 0 = none, 1 = full. */
  private doaDim = 0;

  readonly player: Player;

  constructor(
    private canvas: HTMLCanvasElement,
    private assets: LoadedAssets,
    outfit: OutfitId,
    wishes: Wish[],
    private hooks: EngineHooks,
  ) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D canvas unavailable');
    this.ctx = ctx;
    this.player = new Player(SPAWN);
    this.look = outfitLook(outfit, assets.sprites, (look) => { this.look = look; });
    this.wishes = wishes;
    this.particles = new Particles(this.profile);
    this.npcs = spawnNpcs(wishes);
    this.resize();
    this.camX = this.clampCamX(this.player.x - this.vw / 2);
    this.camY = this.clampCamY(this.player.y - this.vh / 2);
  }

  get deviceProfile() { return this.profile; }

  /**
   * The wishes arrive over the network, so they may land after the guest has
   * already walked into the garden. Seat the walkers when they do.
   */
  setGuests(wishes: Wish[]): void {
    this.wishes = wishes;
    this.npcs = spawnNpcs(wishes);
  }

  /**
   * A guest who just sent their RSVP walks in through the garden gate.
   * This exists so a new wish never forces the engine to be rebuilt — doing
   * that would reset the camera and teleport the player back to the spawn.
   */
  addGuest(wish: Wish): void {
    this.wishes = [wish, ...this.wishes];
    const gate = freeSpot(384 + (Math.random() - 0.5) * 60, 1300);
    // Five is a hard cap, so someone leaves as the new guest arrives.
    admit(this.npcs, new Npc(wish, gate.x, gate.y, wish.gender));
  }

  resize = (): void => {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.vw = rect.width;
    this.vh = rect.height;
    this.canvas.width = Math.round(this.vw * this.dpr);
    this.canvas.height = Math.round(this.vh * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
  };

  private clampCamX(x: number): number {
    // X used to lock to the centre of the map above 768px wide. The stage caps
    // at 480 while the map is 768, so a third of the garden sat outside the
    // view: walk left on a laptop and your own character left the box, and the
    // photobox could not be reached at all. Following is right at every width.
    return camClamp(x, this.vw, WORLD_W);
  }

  private clampCamY(y: number): number {
    return camClamp(y, this.vh, WORLD_H);
  }

  /**
   * How far the player will sit from the bottom of the screen once the camera
   * settles. Near the bottom of the map the camera stops at the edge, so the
   * player drops low on screen — down where the HUD's open prompt sits.
   */
  playerFromBottom(): number {
    return this.vh - (this.player.y - this.clampCamY(this.player.y - this.vh / 2));
  }

  /** Screen point → world point, for tap-to-move and NPC hit tests. */
  toWorld(clientX: number, clientY: number): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: clientX - r.left + this.camX, y: clientY - r.top + this.camY };
  }

  /**
   * A tap either greets a guest or becomes a walk order.
   *
   * Nearest-within-reach rather than a strict box around each sprite. The box
   * was 56px wide on a target that walks, on a phone, with a thumb — missing
   * was the normal outcome, and a miss sends you walking away from the very
   * guest you were trying to read.
   */
  handleTap(clientX: number, clientY: number): void {
    const p = this.toWorld(clientX, clientY);
    let best: { npc: Npc; d: number } | null = null;
    for (const npc of this.npcs) {
      if (p.y < npc.y - DRAW_H - 18 || p.y > npc.y + 18) continue;
      const d = Math.abs(npc.x - p.x);
      if (d <= TAP_REACH && (!best || d < best.d)) best = { npc, d };
    }
    if (best) {
      this.hooks.onNpcTap(best.npc);
      return;
    }
    const lm = landmarkAt(p.x, p.y);
    this.player.walkTo(lm ? { x: lm.sx, y: lm.sy } : p);
  }

  /**
   * Meeting the couple: the guest turns to them and hops, and hearts rise off
   * the pelaminan — after the gift, if one is in hand, has flown up to them.
   * The app opens its modal once this has played; reduced motion skips it.
   */
  celebrate(item: GiftItem | null): void {
    this.player.facing = 'up';
    this.held = null;
    if (this.profile.reduced) return;
    this.hop = HOP_MS;
    if (item) this.flight = { item, t: 0, x: this.player.x, y: this.player.y - DRAW_H * 0.4 };
    else this.burst();
    // Option C: confetti, couple waves, zoom out
    this.couplePose = { groom: 3, bride: 3 }; // wave
    this.spawnConfetti();
    this.warmth = 0;
    this.doaDim = 0;
    this.lightRays = [];
    if (this.zoom.phase) this.zoom = { phase: 'out', t: 0, scale: this.zoom.scale };
  }

  private burst(): void {
    for (let i = 0; i < 14; i++) {
      this.hearts.push({
        x: PELAMINAN.x + (Math.random() - 0.5) * 70,
        y: PELAMINAN.y - 6 + (Math.random() - 0.5) * 24,
        vx: (Math.random() - 0.5) * 0.08,
        vy: -0.04 - Math.random() * 0.06,
        life: 0,
        max: 900 + Math.random() * 600,
        color: i % 3 ? '#e8687f' : '#f4e07b',
      });
    }
  }

  /** Option C: scatter confetti for the celebration. */
  private spawnConfetti(): void {
    for (let i = 0; i < 40; i++) {
      this.confetti.push({
        x: PELAMINAN.x + (Math.random() - 0.5) * 120,
        y: PELAMINAN.y - 20 + (Math.random() - 0.5) * 40,
        vx: (Math.random() - 0.5) * 0.18,
        vy: -0.08 - Math.random() * 0.14,
        life: 0,
        max: 1400 + Math.random() * 800,
        size: 3 + Math.random() * 3,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.01,
      });
    }
  }

  /** Option C: descending light rays for the doa blessing. */
  private spawnLightRays(): void {
    this.lightRays = [];
    for (let i = 0; i < 5; i++) {
      this.lightRays.push({
        x: PELAMINAN.x - 60 + i * 30 + (Math.random() - 0.5) * 20,
        w: 8 + Math.random() * 12,
        a: 0.08 + Math.random() * 0.12,
        speed: 0.0004 + Math.random() * 0.0003,
      });
    }
  }

  get meeting(): boolean { return this.meet !== null; }

  /**
   * Up onto the pelaminan: walk to the groom, greet him, then the bride, say
   * the doa. `body` decides handshake or salam (see meet.ts); `name` is the
   * guest's own, for the couple to answer them by.
   */
  startMeet(body: Gender, name: string): void {
    this.player.halt();
    this.holding = false;
    this.meet = { m: startMeet(), body, name: name.split(' ')[0].slice(0, 12) || 'kamu', path: [COUPLE.groom.spot] };
    this.hooks.onMeet(beatOf(this.meet.m));
    // Option C: zoom the camera in toward the pelaminan
    if (!this.profile.reduced) {
      this.zoom = { phase: 'in', t: 0, scale: 1 };
      this.couplePose = { groom: 0, bride: 0 };
      this.meetSparkles = [];
      this.warmth = 0;
      this.doaDim = 0;
    }
  }

  cancelMeet(): void {
    if (!this.meet) return;
    this.meet = null;
    this.holding = false;
    this.player.moving = false;
    this.hooks.onMeet(null);
    // Option C: zoom back out and clear VFX
    if (this.zoom.phase) this.zoom = { phase: 'out', t: 0, scale: this.zoom.scale };
    this.meetSparkles = [];
    this.lightRays = [];
    this.warmth = 0;
    this.doaDim = 0;
  }

  gestureFor(who: Who): Gesture {
    return gestureFor(this.meet?.body ?? 'pria', who);
  }

  /** One line at a time, like a conversation: a new line replaces whatever is showing. */
  private say(text: string, x: number, y: number, delay = 0, max = 2600): void {
    if (delay <= 0) this.bubbles = this.bubbles.filter((b) => b.delay > 0);
    this.bubbles.push({ text, x, y, delay, life: 0, max });
  }

  private updateMeet(dt: number): void {
    const meet = this.meet!;
    const p = this.player;
    // Walking off with the stick or the keys calls the meeting off.
    if (p.keys.size || p.stick.x || p.stick.y) {
      this.cancelMeet();
      p.update(dt);
      return;
    }
    const beat = beatOf(meet.m);
    let arrived = false;
    if (beat.kind === 'walk') {
      const to = meet.path[0];
      const dx = to.x - p.x, dy = to.y - p.y;
      const d = Math.hypot(dx, dy);
      const step = Math.min(d, MEET_SPEED * dt);
      if (d > 0.5) {
        p.x += (dx / d) * step;
        p.y += (dy / d) * step;
        p.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
        p.moving = true;
      }
      if (d - step <= 0.5) meet.path.shift();
      arrived = meet.path.length === 0;
    } else {
      p.moving = false;
      if (beat.kind === 'hold' || beat.kind === 'react') p.facing = COUPLE[beat.who].face;
    }

    if (beat.kind === 'hold') {
      const c = COUPLE[beat.who];
      const gx = (c.x + c.spot.x) / 2;
      const gy = 268;
      if (this.holding) {
        this.warmth = Math.min(1, this.warmth + dt / 250);
        if (!this.profile.reduced && Math.random() < 0.45) {
          this.meetSparkles.push({
            x: gx + (Math.random() - 0.5) * 24,
            y: gy + (Math.random() - 0.5) * 16,
            vx: (Math.random() - 0.5) * 0.05,
            vy: -0.04 - Math.random() * 0.04,
            life: 0,
            max: 350 + Math.random() * 250,
          });
        }
      } else {
        this.warmth = Math.max(0, this.warmth - dt / 250);
      }
    }

    const before = meet.m.i;
    meet.m = stepMeet(meet.m, dt, { holding: this.holding, arrived });
    if (meet.m.i === before) return;

    const next = beatOf(meet.m);
    if (next.kind === 'walk') {
      meet.path = next.to === 'bride' ? [DIP, COUPLE.bride.spot] : [COUPLE.groom.spot];
      this.warmth = 0;
      this.doaDim = 0;
      this.lightRays = [];
      if (next.to === 'bride') this.couplePose.groom = 0;
    }
    if (next.kind === 'react') {
      const c = COUPLE[next.who];
      const kind = this.gestureFor(next.who);
      this.gesture = { kind, x: (c.x + c.spot.x) / 2, y: 268, life: 0 };
      this.say(next.who === 'groom' ? `Makasih sudah datang, ${meet.name}!` : 'Senang banget kamu ke sini 🤍', c.x, HEAD_Y);
      // Couple reacts with peace sign (1) or finger heart (2)
      this.couplePose[next.who] = REACT_POSES[Math.floor(Math.random() * (REACT_POSES.length - 1))];
      this.warmth = 0.9;
    }
    if (next.kind === 'doa') {
      this.holding = false;
      p.facing = 'up';
      this.couplePose = { groom: 0, bride: 0 };
      this.gesture = { kind: 'doa', x: p.x, y: p.y - DRAW_H - 26, life: 0 };
      this.say('Barakallahu lakuma 🤲', p.x, p.y - DRAW_H - 10, 0, 2000);
      this.say('Aamiin! Jazakumullah khairan', PELAMINAN.x, HEAD_Y, 900, 2400);
      if (!this.profile.reduced) {
        this.doaDim = 0.45;
        this.spawnLightRays();
      }
    }
    if (next.kind === 'done') this.meet = null;
    this.hooks.onMeet(next);
  }

  start(): void {
    this.last = performance.now();
    this.fpsAt = this.last;
    this.raf = requestAnimationFrame(this.frame);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
  }

  private frame = (t: number): void => {
    const dt = Math.min(48, t - this.last); // a backgrounded tab must not teleport anyone
    this.last = t;
    this.clock += dt;
    this.update(dt);
    this.draw();

    this.frames++;
    if (t - this.fpsAt >= 1000) {
      this.hooks.onFps?.(this.frames);
      this.frames = 0;
      this.fpsAt = t;
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  private update(dt: number): void {
    if (this.meet) this.updateMeet(dt);
    else this.player.update(dt);

    const target = nearest(this.player.x, this.player.y);
    const lm = target?.lm ?? null;
    if (lm?.id !== this.inRange?.id) {
      this.inRange = lm;
      this.hooks.onProximity(lm);
    }

    // LERP is per 60Hz frame; this keeps the camera's ease the same at any refresh rate.
    const ease = 1 - Math.pow(1 - LERP, dt / (1000 / 60));
    this.camX += (this.clampCamX(this.player.x - this.vw / 2) - this.camX) * ease;
    this.camY += (this.clampCamY(this.player.y - this.vh / 2) - this.camY) * ease;

    for (const n of this.npcs) n.update(dt);

    // Before the quiet check: the couple's modal opens while the hearts are
    // still rising, and they should finish behind it rather than wait for it.
    this.hop = Math.max(0, this.hop - dt);
    if (this.flight && (this.flight.t += dt) >= FLIGHT_MS) {
      this.flight = null;
      this.burst();
    }
    for (let i = this.hearts.length - 1; i >= 0; i--) {
      const h = this.hearts[i];
      h.life += dt;
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      if (h.life >= h.max) this.hearts.splice(i, 1);
    }

    // Option C: update zoom, sparkles, confetti and light rays
    if (!this.profile.reduced) {
      if (this.zoom.phase === 'in') {
        this.zoom.t += dt;
        const k = Math.min(1, this.zoom.t / ZOOM_IN_MS);
        const e = k * k * (3 - 2 * k);
        this.zoom.scale = 1 + (ZOOM_TARGET - 1) * e;
        if (k >= 1) this.zoom.phase = 'hold';
      } else if (this.zoom.phase === 'out') {
        this.zoom.t += dt;
        const k = Math.min(1, this.zoom.t / ZOOM_OUT_MS);
        const e = k * k * (3 - 2 * k);
        this.zoom.scale = ZOOM_TARGET - (ZOOM_TARGET - 1) * e;
        if (k >= 1) {
          this.zoom.phase = null;
          this.zoom.scale = 1;
        }
      }
    }
    for (let i = this.meetSparkles.length - 1; i >= 0; i--) {
      const s = this.meetSparkles[i];
      s.life += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.life >= s.max) this.meetSparkles.splice(i, 1);
    }
    for (let i = this.confetti.length - 1; i >= 0; i--) {
      const c = this.confetti[i];
      c.life += dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.vy += 0.00012 * dt;
      c.rot += c.vr * dt;
      if (c.life >= c.max) this.confetti.splice(i, 1);
    }
    for (const r of this.lightRays) {
      r.x += Math.sin(this.clock * r.speed) * 0.25;
    }
    if (this.meet) {
      const b = beatOf(this.meet.m);
      if (b.kind !== 'hold' && b.kind !== 'react') this.warmth = Math.max(0, this.warmth - dt / 350);
      if (b.kind !== 'doa') this.doaDim = Math.max(0, this.doaDim - dt / 400);
    } else {
      this.warmth = Math.max(0, this.warmth - dt / 350);
      this.doaDim = Math.max(0, this.doaDim - dt / 400);
    }

    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      if (b.delay > 0 && (b.delay -= dt) <= 0) {
        // A reply that has waited its turn takes the floor.
        this.bubbles = this.bubbles.filter((o) => o === b || o.delay > 0);
        i = this.bubbles.length;
      } else if (b.delay <= 0 && (b.life += dt) >= b.max) {
        this.bubbles.splice(i, 1);
      }
    }
    if (this.gesture && (this.gesture.life += dt) > 1400) this.gesture = null;

    if (this.quiet) return;
    this.particles.update(dt);

    this.nextFloat -= dt;
    if (this.nextFloat <= 0 && this.floats.length < WISH_MAX && this.wishes.length) {
      this.nextFloat = 6000 + Math.random() * 4000;
      const w = this.wishes[Math.floor(Math.random() * Math.min(24, this.wishes.length))];
      this.floats.push({ wish: w, x: 600 + (Math.random() - 0.5) * 70, y: 880, life: 0 });
    }
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.life += dt;
      f.y -= (200 / WISH_LIFE) * dt;
      if (f.life >= WISH_LIFE) this.floats.splice(i, 1);
    }
  }

  private draw(): void {
    const { ctx, camX, camY, vw, vh } = this;
    const cx = Math.round(camX);
    const cy = Math.round(camY);

    ctx.save();
    const scale = this.zoom.scale;
    if (scale !== 1) {
      const fx = Math.round(PELAMINAN.x - cx);
      const fy = Math.round(PELAMINAN.y + 40 - cy);
      ctx.translate(fx, fy);
      ctx.scale(scale, scale);
      ctx.translate(-fx, -fy);
    }

    ctx.drawImage(this.assets.map, cx, cy, Math.ceil(vw), Math.ceil(vh), 0, 0, Math.ceil(vw), Math.ceil(vh));

    if (!this.quiet) this.particles.draw(ctx, cx, cy, vw, vh);

    if (this.inRange) this.drawProximityRing(this.inRange, cx, cy);

    // y-sorted so a guest lower on the map overlaps one standing behind them
    const cast: { y: number; paint: () => void }[] = [];
    for (const n of this.npcs) {
      const sx = n.x - cx;
      const sy = n.y - cy;
      if (sx < -80 || sy < -140 || sx > vw + 80 || sy > vh + 80) continue;
      cast.push({
        y: n.y,
        paint: () => {
          if (this.profile.shadows) drawShadow(ctx, sx, sy);
          drawSprite(ctx, this.assets.sprites, baseRow(n.gender), n.facing, n.moving, this.clock + n.x * 7, sx, sy);
          drawNameplate(ctx, n.wish.name, sx, sy);
        },
      });
    }

    // Option C: Animated couple standing characters on the pelaminan
    const showCouple = this.meet !== null || this.zoom.scale > 1 || this.confetti.length > 0;
    if (showCouple) {
      cast.push({
        y: 286,
        paint: () => this.drawCouple(ctx, cx, cy),
      });
    }

    const px = this.player.x - cx;
    const py = this.player.y - cy;
    const lift = this.hop > 0 ? Math.sin((1 - this.hop / HOP_MS) * Math.PI) * 7 : 0;
    cast.push({
      y: this.player.y,
      paint: () => {
        drawPlayerRing(ctx, px, py);
        drawSprite(ctx, this.look.sheet, this.look.base, this.player.facing, this.player.moving, this.clock, px, py - lift);
        if (this.held) this.drawGift(this.held, px + DRAW_W * 0.32, py - lift - DRAW_H * 0.36, 22);
      },
    });
    cast.sort((a, b) => a.y - b.y).forEach((c) => c.paint());

    // Option C: Salaman VFX layers
    this.drawDoa(cx, cy);
    this.drawWarmthAura(cx, cy);
    this.drawMeetSparkles(cx, cy);
    this.drawConfetti(cx, cy);

    this.drawSigns(cx, cy, vw, vh);
    if (!this.quiet) this.drawFloats(cx, cy);
    this.drawDestination(cx, cy);
    if (!this.meet) drawPlayerTag(ctx, px, py, this.clock, !!this.inRange);

    if (this.flight) {
      const f = this.flight;
      const k = f.t / FLIGHT_MS;
      const e = k * k * (3 - 2 * k); // smoothstep
      const x = f.x + (PELAMINAN.x - f.x) * e + Math.sin(k * Math.PI) * 46;
      const y = f.y + (PELAMINAN.y - f.y) * e - Math.sin(k * Math.PI) * 24;
      this.drawGift(f.item, x - cx, y - cy, 26);
    }
    this.drawHearts(cx, cy);
    this.drawMeet(cx, cy);

    ctx.restore();
  }

  /** Option C: Draw the animated bride and groom sprites with dynamic poses. */
  private drawCouple(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    const sheet = this.assets.coupleStand;
    if (!sheet) return;

    const groomX = COUPLE.groom.x - cx;
    const groomY = 286 - cy;
    const brideX = COUPLE.bride.x - cx;
    const brideY = 286 - cy;

    if (this.profile.shadows) {
      drawShadow(ctx, groomX, groomY);
      drawShadow(ctx, brideX, brideY);
    }

    // Groom: col 0, row = couplePose.groom
    const gRow = this.couplePose.groom;
    ctx.drawImage(
      sheet,
      0, gRow * COUPLE_CELL_H, COUPLE_CELL_W, COUPLE_CELL_H,
      Math.round(groomX - DRAW_W / 2), Math.round(groomY - DRAW_H), DRAW_W, DRAW_H,
    );

    // Bride: col 1, row = couplePose.bride
    const bRow = this.couplePose.bride;
    ctx.drawImage(
      sheet,
      COUPLE_CELL_W, bRow * COUPLE_CELL_H, COUPLE_CELL_W, COUPLE_CELL_H,
      Math.round(brideX - DRAW_W / 2), Math.round(brideY - DRAW_H), DRAW_W, DRAW_H,
    );
  }

  /** Option C: Ethereal illumination and descending light rays during doa. */
  private drawDoa(cx: number, cy: number): void {
    if (this.doaDim <= 0.01) return;
    const { ctx } = this;
    const px = PELAMINAN.x - cx;
    const py = PELAMINAN.y + 40 - cy;
    ctx.save();
    const spot = ctx.createRadialGradient(px, py, 45, px, py, 260);
    spot.addColorStop(0, `rgba(254, 243, 199, ${0.14 * this.doaDim})`);
    spot.addColorStop(0.55, `rgba(30, 18, 10, ${0.25 * this.doaDim})`);
    spot.addColorStop(1, `rgba(18, 9, 5, ${0.52 * this.doaDim})`);
    ctx.fillStyle = spot;
    ctx.fillRect(0, 0, this.vw, this.vh);

    for (const r of this.lightRays) {
      const rx = r.x - cx;
      const ray = ctx.createLinearGradient(rx, PELAMINAN.y - 120 - cy, rx, PELAMINAN.y + 100 - cy);
      ray.addColorStop(0, `rgba(254, 240, 138, ${r.a * this.doaDim * 1.6})`);
      ray.addColorStop(1, 'rgba(254, 240, 138, 0)');
      ctx.fillStyle = ray;
      ctx.beginPath();
      ctx.moveTo(rx - r.w * 0.4, PELAMINAN.y - 120 - cy);
      ctx.lineTo(rx + r.w * 0.4, PELAMINAN.y - 120 - cy);
      ctx.lineTo(rx + r.w * 1.3, PELAMINAN.y + 100 - cy);
      ctx.lineTo(rx - r.w * 1.3, PELAMINAN.y + 100 - cy);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  /** Option C: Warm golden aura glowing at the handshake or salam clasp point. */
  private drawWarmthAura(cx: number, cy: number): void {
    if (this.warmth <= 0.02 || !this.meet) return;
    const { ctx } = this;
    const beat = beatOf(this.meet.m);
    if (beat.kind === 'hold' || beat.kind === 'react') {
      const c = COUPLE[beat.who];
      const gx = (c.x + c.spot.x) / 2 - cx;
      const gy = 268 - cy;
      const pulse = 0.88 + 0.12 * Math.sin(this.clock / 130);
      const rad = ctx.createRadialGradient(gx, gy, 4, gx, gy, 50 * pulse);
      rad.addColorStop(0, `rgba(254, 224, 123, ${0.48 * this.warmth})`);
      rad.addColorStop(0.6, `rgba(244, 180, 70, ${0.2 * this.warmth})`);
      rad.addColorStop(1, 'rgba(244, 180, 70, 0)');
      ctx.save();
      ctx.fillStyle = rad;
      ctx.beginPath();
      ctx.arc(gx, gy, 50 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /** Option C: Pixel sparkles orbiting the handshake during hold. */
  private drawMeetSparkles(cx: number, cy: number): void {
    const { ctx } = this;
    for (const s of this.meetSparkles) {
      const k = s.life / s.max;
      const a = Math.min(1, k / 0.15) * (1 - k);
      const sx = Math.round(s.x - cx);
      const sy = Math.round(s.y - cy);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = '#fde68a';
      ctx.fillRect(sx - 1, sy - 1, 3, 3);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx, sy, 1, 1);
      ctx.restore();
    }
  }

  /** Option C: Confetti burst particles fluttering down at celebration. */
  private drawConfetti(cx: number, cy: number): void {
    const { ctx } = this;
    for (const c of this.confetti) {
      const k = c.life / c.max;
      const a = Math.min(1, k / 0.1) * Math.min(1, (1 - k) / 0.3);
      const sx = c.x - cx;
      const sy = c.y - cy;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(sx, sy);
      ctx.rotate(c.rot);
      ctx.fillStyle = c.color;
      ctx.fillRect(-c.size / 2, -c.size * 0.3, c.size, c.size * 0.6);
      ctx.restore();
    }
  }

  /** The gesture as pixel art, or the emoji until the art arrives. */
  private drawGesture(kind: Gesture | 'doa', x: number, y: number, size: number): void {
    const { ctx } = this;
    const img = this.icons;
    if (img.complete && img.naturalWidth) {
      const cw = img.naturalWidth / 3;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, GESTURE_CELL[kind] * cw, 0, cw, img.naturalHeight, x - size / 2, y - size / 2, size, size);
      ctx.imageSmoothingEnabled = false;
    } else {
      ctx.font = `${size * 0.8}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(GESTURE_EMOJI[kind], x, y);
    }
  }

  /**
   * The meeting: a ring between the guest's hand and the person's that fills
   * while A is held, the gesture popping when it completes, and what everyone says.
   */
  private drawMeet(cx: number, cy: number): void {
    const { ctx } = this;
    const beat = this.meet ? beatOf(this.meet.m) : null;
    if (beat?.kind === 'hold') {
      const c = COUPLE[beat.who];
      const x = (c.x + c.spot.x) / 2 - cx;
      const y = 268 - cy;
      const pulse = 0.5 + 0.5 * Math.sin(this.clock / 160);
      ctx.save();
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(27, 17, 13, 0.55)';
      ctx.beginPath();
      ctx.arc(x, y, 19, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#f4e07b';
      ctx.beginPath();
      ctx.arc(x, y, 19, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.meet!.m.hold);
      ctx.stroke();
      ctx.globalAlpha = 0.55 + 0.45 * (this.meet!.m.hold > 0 ? 1 : pulse);
      this.drawGesture(this.gestureFor(beat.who), x, y, 24);
      ctx.restore();
    }

    if (this.gesture) {
      const g = this.gesture;
      const k = g.life < 220 ? 0.6 + (g.life / 220) * 0.6 : 1.2 - Math.min(0.2, (g.life - 220) / 1000);
      ctx.save();
      ctx.globalAlpha = Math.min(1, (1400 - g.life) / 300);
      this.drawGesture(g.kind, g.x - cx, g.y - cy - Math.min(10, g.life / 40), 30 * k);
      ctx.restore();
    }

    ctx.save();
    ctx.font = '600 11px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const b of this.bubbles) {
      if (b.delay > 0) continue;
      const w = Math.ceil(ctx.measureText(b.text).width) + 18;
      const h = 24;
      const tipX = b.x - cx;
      const x = Math.round(Math.max(6, Math.min(this.vw - w - 6, tipX - w / 2)));
      const y = Math.round(b.y - cy - h - 8);
      ctx.globalAlpha = Math.min(1, b.life / 160, (b.max - b.life) / 300);
      ctx.fillStyle = '#fdf6e2';
      ctx.strokeStyle = '#4a2e18';
      ctx.lineWidth = 2;
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      ctx.beginPath();
      ctx.moveTo(tipX - 5, y + h - 1);
      ctx.lineTo(tipX + 5, y + h - 1);
      ctx.lineTo(tipX, y + h + 7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#2d1e18';
      ctx.fillText(b.text, x + w / 2, y + h / 2 + 1);
    }
    ctx.restore();
  }

  /** Exactly the trigger zone from `nearest` — the guest is inside it whenever it shows. */
  private drawProximityRing(lm: Landmark, cx: number, cy: number): void {
    const { ctx } = this;
    const pulse = 0.5 + 0.5 * Math.sin(this.clock / 190);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(Math.round(lm.sx - cx), Math.round(lm.sy - cy), lm.radius, lm.radius * ZONE_SQUASH, 0, 0, Math.PI * 2);
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#f4e07b';
    ctx.fill();
    ctx.globalAlpha = 0.55 + pulse * 0.4;
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }

  private drawSigns(cx: number, cy: number, vw: number, vh: number): void {
    const { ctx } = this;
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const lm of LANDMARKS) {
      // Mid-meeting the couple's own words sit where their sign is.
      if (this.meet && lm.id === 'pelaminan') continue;
      const sx = lm.x - cx;
      const sy = lm.y - cy - lm.signOffset;
      if (sx < -90 || sy < -40 || sx > vw + 90 || sy > vh + 40) continue;

      const near = this.inRange?.id === lm.id;
      const text = `+ ${lm.label}`;
      const w = Math.ceil(ctx.measureText(text).width) + 16;
      const h = 20;
      const x = Math.round(sx - w / 2);
      const y = Math.round(sy - h);

      ctx.fillStyle = '#4a2e18';
      ctx.fillRect(Math.round(sx) - 2, y + h, 4, 12);

      ctx.fillStyle = near ? '#734d2e' : '#2d1e18';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = near ? '#fde68a' : '#d4af37';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      ctx.fillStyle = '#fdf6e2';
      ctx.fillText(text, x + w / 2, y + h / 2 + 1);
    }
  }

  private drawFloats(cx: number, cy: number): void {
    const { ctx } = this;
    ctx.font = '11px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    for (const f of this.floats) {
      const k = f.life / WISH_LIFE;
      const a = Math.min(1, k / 0.15) * Math.min(1, (1 - k) / 0.2);
      const msg = f.wish.message.length > 52 ? `${f.wish.message.slice(0, 51)}…` : f.wish.message;
      const w = Math.min(190, Math.max(110, ctx.measureText(msg).width * 0.62 + 20));
      // Clamp into the viewport — a bubble half off the edge reads as a bug.
      const x = Math.round(Math.max(6, Math.min(this.vw - w - 6, f.x - cx - w / 2)));
      const y = Math.round(f.y - cy);

      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = '#fdf6e2';
      ctx.fillRect(x, y, w, 46);
      ctx.strokeStyle = '#4a2e18';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, w - 2, 44);
      ctx.fillStyle = '#7a5f3a';
      ctx.font = 'bold 8px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText(f.wish.name.toUpperCase().slice(0, 18), x + 7, y + 6);
      ctx.fillStyle = '#2d1e18';
      ctx.font = '10px "Plus Jakarta Sans", system-ui, sans-serif';
      wrap(ctx, msg, x + 7, y + 19, w - 14, 11, 2);
      ctx.restore();
    }
  }

  /** Smoothed, unlike the sprites: at this size nearest-neighbour turns the gifts to noise. */
  private drawGift(item: GiftItem, x: number, y: number, size: number): void {
    const { ctx } = this;
    const sheet = this.giftSheet;
    ctx.save();
    if (sheet.complete && sheet.naturalWidth) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(sheet, giftIndex(item) * GIFT_CELL, 0, GIFT_CELL, GIFT_CELL,
        Math.round(x - size / 2), Math.round(y - size / 2), size, size);
    } else {
      ctx.font = `${size - 4}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(GIFTS[giftIndex(item)].emoji, x, y);
    }
    ctx.restore();
  }

  private drawHearts(cx: number, cy: number): void {
    const { ctx } = this;
    for (const h of this.hearts) {
      const k = h.life / h.max;
      ctx.globalAlpha = Math.min(1, k / 0.1) * Math.min(1, (1 - k) / 0.4);
      ctx.fillStyle = h.color;
      const x = Math.round(h.x - cx) - 5;
      const y = Math.round(h.y - cy) - 5;
      HEART.forEach((row, r) => [...row].forEach((c, i) => { if (c === 'X') ctx.fillRect(x + i * 2, y + r * 2, 2, 2); }));
    }
    ctx.globalAlpha = 1;
  }

  private drawDestination(cx: number, cy: number): void {
    const d = this.player.destination;
    if (!d) return;
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = 0.6 + 0.3 * Math.sin(this.clock / 150);
    ctx.strokeStyle = '#f4e07b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(d.x - cx, d.y - cy, 14, 6, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

export type { Landmark, Destination };
