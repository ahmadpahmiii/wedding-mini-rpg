import { LANDMARKS, SPAWN, WORLD_W, WORLD_H, ZONE_SQUASH, landmarkAt, nearest } from './landmarks';
import { Player } from './Player';
import { Npc, spawnNpcs, freeSpot, admit } from './Npc';
import { Particles, detectProfile } from './Particles';
import { drawSprite, drawShadow, drawNameplate, drawPlayerRing, drawPlayerTag, DRAW_H } from './sprites';
import type { Destination, Gender, Landmark, Wish } from './types';
import type { LoadedAssets } from '../services/assets';

const LERP = 0.08;
const DESKTOP_MIN = 768;

export interface EngineHooks {
  onProximity: (lm: Landmark | null) => void;
  onNpcTap: (npc: Npc) => void;
  onFps?: (fps: number) => void;
}

interface FloatingWish { wish: Wish; x: number; y: number; life: number }
// Ucapan & RSVP lives at the tree, so guests now stand where the bubbles rise.
// Fewer and further apart keeps two cards from stacking on each other.
const WISH_LIFE = 9000;
const WISH_MAX = 2;
/** Half-width of a guest's tap target, in world px. */
const TAP_REACH = 46;

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

  readonly player: Player;

  constructor(
    private canvas: HTMLCanvasElement,
    private assets: LoadedAssets,
    gender: Gender,
    wishes: Wish[],
    private hooks: EngineHooks,
  ) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D canvas unavailable');
    this.ctx = ctx;
    this.player = new Player(SPAWN, gender);
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
    // On desktop the stage is narrower than the map, so X is locked to centre:
    // free panning would expose the edge of the painting inside the letterbox.
    if (window.innerWidth >= DESKTOP_MIN) return Math.max(0, (WORLD_W - this.vw) / 2);
    return Math.max(0, Math.min(x, WORLD_W - this.vw));
  }

  private clampCamY(y: number): number {
    return Math.max(0, Math.min(y, WORLD_H - this.vh));
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
    this.player.update(dt);

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

    ctx.drawImage(this.assets.map, cx, cy, Math.ceil(vw), Math.ceil(vh), 0, 0, Math.ceil(vw), Math.ceil(vh));

    if (!this.quiet) this.particles.draw(ctx, cx, cy, vw, vh);

    if (this.inRange) this.drawProximityRing(this.inRange, cx, cy);

    // y-sorted so a guest lower on the map overlaps one standing behind them
    const cast: { y: number; paint: () => void }[] = [];
    for (const n of this.npcs) {
      const sx = n.x - cx;
      const sy = n.y - cy;
      if (sx < -80 || sy < -140 || sx > vw + 80 || sy > vh + 80) continue;
      // Every guest is labelled. The range limit existed when there were
      // sixteen of them; with five it only hid the one affordance telling a
      // guest that the people in the garden can be tapped and read.
      cast.push({
        y: n.y,
        paint: () => {
          if (this.profile.shadows) drawShadow(ctx, sx, sy);
          drawSprite(ctx, this.assets.sprites, n.gender, n.facing, n.moving, this.clock + n.x * 7, sx, sy);
          drawNameplate(ctx, n.wish.name, sx, sy);
        },
      });
    }
    const px = this.player.x - cx;
    const py = this.player.y - cy;
    cast.push({
      y: this.player.y,
      paint: () => {
        drawPlayerRing(ctx, px, py);
        drawSprite(ctx, this.assets.sprites, this.player.gender, this.player.facing, this.player.moving, this.clock, px, py);
      },
    });
    cast.sort((a, b) => a.y - b.y).forEach((c) => c.paint());

    this.drawSigns(cx, cy, vw, vh);
    if (!this.quiet) this.drawFloats(cx, cy);
    this.drawDestination(cx, cy);
    // Last of all: nothing is allowed to cover "you are here".
    drawPlayerTag(ctx, px, py, this.clock, !!this.inRange);
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

function wrap(
  ctx: CanvasRenderingContext2D, text: string, x: number, y: number,
  maxW: number, lh: number, maxLines: number,
): void {
  const words = text.split(' ');
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

export type { Landmark, Destination };
