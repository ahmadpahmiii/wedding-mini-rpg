import type { DeviceProfile } from './types';

interface P { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; src: number }

/** Emitters sit on the painted objects; colours are sampled from the map art. */
const SOURCES = [
  { x: 384, y: 250,  n: 18, color: '#f4e07b', kind: 'sparkle' as const },
  { x: 384, y: 640,  n: 24, color: '#7ec8e3', kind: 'spray' as const },
  { x: 600, y: 850,  n: 20, color: '#f7c8d8', kind: 'petal' as const },
  { x: 384, y: 1000, n: 12, color: '#fdf6e2', kind: 'dust' as const },
  { x: 612, y: 498,  n: 8,  color: '#fdf6e2', kind: 'steam' as const }, // the bakso pot at the buffet
];

export class Particles {
  private ps: P[] = [];
  private profile: DeviceProfile;

  constructor(profile: DeviceProfile) {
    this.profile = profile;
    this.seed();
  }

  private seed(): void {
    for (const s of SOURCES) {
      if (s.kind === 'sparkle' && !this.profile.sparkles) continue;
      const n = Math.max(2, Math.round(s.n * this.profile.particleScale));
      for (let i = 0; i < n; i++) this.ps.push(this.make(s, Math.random()));
    }
  }

  private make(s: (typeof SOURCES)[number], startLife = 0): P {
    const spread = s.kind === 'spray' ? 34 : s.kind === 'steam' ? 14 : 60;
    const max = s.kind === 'spray' ? 900 : s.kind === 'steam' ? 1600 : 4200;
    const base = {
      x: s.x + (Math.random() - 0.5) * spread,
      y: s.y + (Math.random() - 0.5) * (s.kind === 'petal' ? 90 : 24),
      life: startLife * max,
      max,
      size: s.kind === 'dust' ? 2 : 3,
      color: s.color,
      src: SOURCES.indexOf(s),
    };
    switch (s.kind) {
      case 'spray':   return { ...base, vx: (Math.random() - 0.5) * 0.5, vy: -0.55 - Math.random() * 0.4 };
      case 'sparkle': return { ...base, vx: (Math.random() - 0.5) * 0.12, vy: -0.16 - Math.random() * 0.12 };
      case 'petal':   return { ...base, vx: (Math.random() - 0.5) * 0.3, vy: 0.14 + Math.random() * 0.18 };
      case 'steam':   return { ...base, y: s.y + Math.random() * 6, vx: (Math.random() - 0.5) * 0.1, vy: -0.22 - Math.random() * 0.1 };
      default:        return { ...base, vx: (Math.random() - 0.5) * 0.08, vy: -0.05 };
    }
  }

  update(dt: number): void {
    for (let i = 0; i < this.ps.length; i++) {
      const p = this.ps[i];
      p.x += p.vx * (dt / 16.67);
      p.y += p.vy * (dt / 16.67);
      p.life += dt;
      if (p.life >= p.max) {
        // Recycle rather than allocate — the array length never changes. From
        // its own emitter: picking by slot (i % 4) reshuffled every effect after
        // the first cycle, and brought sparkles back on phones that had them off.
        this.ps[i] = this.make(SOURCES[p.src]);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, camY: number, vw: number, vh: number): void {
    for (const p of this.ps) {
      const sx = p.x - camX;
      const sy = p.y - camY;
      if (sx < -8 || sy < -8 || sx > vw + 8 || sy > vh + 8) continue;
      const k = p.life / p.max;
      // Fade in over the first 15%, out over the last 30%.
      const a = 0.7 * Math.min(1, k / 0.15) * Math.min(1, (1 - k) / 0.3);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(sx), Math.round(sy), p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }
}

export function detectProfile(): DeviceProfile {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const weak = (navigator.hardwareConcurrency ?? 8) <= 4 && (nav.deviceMemory ?? 8) <= 4;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return { tier: 'low', reduced, particleScale: 0, sparkles: false, shadows: false };
  if (weak) return { tier: 'low', reduced, particleScale: 0.3, sparkles: false, shadows: false };
  return { tier: 'high', reduced, particleScale: 1, sparkles: true, shadows: true };
}
