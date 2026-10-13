/**
 * BGM plus seven synthesised chiptune SFX.
 *
 * SFX are generated with the Web Audio API rather than loaded — seven short
 * files would cost more bytes and more round-trips than the ~60 lines below.
 */
type Sfx = 'seal' | 'levelup' | 'open' | 'close' | 'click' | 'camera' | 'success';

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

class AudioManager {
  private ctx: AudioContext | null = null;
  private bgm: HTMLAudioElement | null = null;
  private bgmGain = 0.3;
  /** What the music *should* sit at. Actual volume = targetGain x loop envelope. */
  private targetGain = 0;
  private envTimer: number | null = null;
  private wanted = false;
  private duckTimer: number | null = null;
  /** No music file on the server is a different problem from a blocked autoplay. */
  private bgmBroken = false;
  /** Only the newest fade may write the volume — see fade(). */
  private fadeId = 0;

  /** True once the browser has actually allowed sound to start. */
  get unlocked(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  get playing(): boolean {
    return this.wanted && !!this.bgm && !this.bgm.paused;
  }

  /** False when there is no usable track — the "enable music" prompt must stay hidden. */
  get bgmAvailable(): boolean {
    return !this.bgmBroken;
  }

  private ensureCtx(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    this.ctx = new Ctor();
    return this.ctx;
  }

  /** Call from inside a real user gesture (the wax seal). */
  async unlock(): Promise<boolean> {
    const ctx = this.ensureCtx();
    if (!ctx) return false;
    try { await ctx.resume(); } catch { /* iOS may reject outside a gesture */ }
    return ctx.state === 'running';
  }

  private element(url: string): HTMLAudioElement {
    if (!this.bgm) {
      const el = new Audio(url);
      el.loop = true;
      el.preload = 'auto';
      el.volume = 0;
      // No music file yet? Fail quietly — SFX still work, the UI still says OFF.
      el.addEventListener('error', () => { this.wanted = false; this.bgmBroken = true; });
      this.bgm = el;
    }
    return this.bgm;
  }

  /**
   * Start buffering before the guest taps, so the music is ready when they do.
   * The same element is reused by startBgm, so nothing downloads twice. iOS
   * ignores preload until a gesture; there it simply loads on the tap instead.
   */
  prepareBgm(url: string): void {
    this.element(url);
  }

  async startBgm(url: string): Promise<void> {
    this.wanted = true;
    const el = this.element(url);
    try {
      await el.play();
      this.startEnvelope();
      this.fade(this.bgmGain, 2000);
    } catch (err) {
      this.wanted = false;
      // NotAllowedError means the browser blocked autoplay and a tap will fix it.
      // Anything else (missing file, bad codec) will not be fixed by tapping.
      if ((err as DOMException)?.name !== 'NotAllowedError') this.bgmBroken = true;
    }
  }

  /**
   * The track is a 3-minute cut, so `loop` restarts it mid-phrase. Riding the
   * volume down into the seam and back up out of it turns an audible click
   * into a breath. Everything else sets `targetGain`; this is the only place
   * that touches `el.volume`.
   */
  private static readonly SEAM = 2.5;

  private applyVolume(): void {
    const el = this.bgm;
    if (!el) return;
    const d = el.duration;
    let env = 1;
    if (Number.isFinite(d) && d > AudioManager.SEAM * 2) {
      const t = el.currentTime;
      if (t < AudioManager.SEAM) env = t / AudioManager.SEAM;
      else if (t > d - AudioManager.SEAM) env = Math.max(0, (d - t) / AudioManager.SEAM);
    }
    el.volume = Math.max(0, Math.min(1, this.targetGain * env));
  }

  private startEnvelope(): void {
    if (this.envTimer) return;
    this.envTimer = window.setInterval(() => this.applyVolume(), 100);
  }

  private stopEnvelope(): void {
    if (this.envTimer) window.clearInterval(this.envTimer);
    this.envTimer = null;
  }

  private fade(to: number, ms: number): void {
    const el = this.bgm;
    if (!el) return;
    // A newer fade supersedes this one. Two running together (a modal opened and
    // closed quickly, or the invitation ducking while the start fade is still going)
    // each wrote the volume every frame, and it flickered between their values.
    const id = ++this.fadeId;
    const from = this.targetGain;
    const t0 = performance.now();
    const step = (t: number) => {
      if (id !== this.fadeId) return;
      const k = Math.min(1, (t - t0) / ms);
      this.targetGain = from + (to - from) * k;
      this.applyVolume();
      if (k < 1) requestAnimationFrame(step);
      else if (to === 0) {
        this.stopEnvelope();
        el.pause();
      }
    };
    requestAnimationFrame(step);
  }

  toggleBgm(url: string): boolean {
    if (this.bgmBroken) return false;
    if (this.playing) {
      this.wanted = false;
      this.fade(0, 400);
      return false;
    }
    void this.startBgm(url);
    return true;
  }

  /** Drop the music under an open modal so reading is not a shouting match. */
  duck(on: boolean): void {
    if (!this.bgm || !this.wanted) return;
    if (this.duckTimer) window.clearTimeout(this.duckTimer);
    this.fade(on ? 0.18 : this.bgmGain, 300);
  }

  pauseForHidden(): void { if (this.playing) this.bgm?.pause(); }
  resumeFromHidden(): void { if (this.wanted) void this.bgm?.play().catch(() => undefined); }

  play(name: Sfx): void {
    if (reduced()) return;
    const ctx = this.ensureCtx();
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const beep = (freq: number, at: number, dur: number, type: OscillatorType = 'square', vol = 0.35) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now + at);
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(vol, now + at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + at);
      osc.stop(now + at + dur + 0.02);
    };
    const noise = (at: number, dur: number, vol = 0.3) => {
      const n = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, n, ctx.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const src = ctx.createBufferSource();
      const gain = ctx.createGain();
      gain.gain.value = vol;
      src.buffer = buf;
      src.connect(gain).connect(ctx.destination);
      src.start(now + at);
    };

    switch (name) {
      case 'seal':    noise(0, 0.18, 0.35); beep(320, 0.02, 0.1); beep(180, 0.1, 0.16); break;
      case 'levelup': [523, 659, 784, 1047].forEach((f, i) => beep(f, i * 0.08, 0.12)); break;
      case 'open':    beep(440, 0, 0.07); beep(660, 0.06, 0.1); break;
      case 'close':   beep(660, 0, 0.06); beep(440, 0.05, 0.09); break;
      case 'click':   beep(880, 0, 0.04, 'square', 0.22); break;
      case 'camera':  noise(0, 0.05, 0.4); beep(1200, 0.03, 0.05, 'sine'); break;
      case 'success': [523, 659, 784].forEach((f, i) => beep(f, i * 0.05, 0.22, 'triangle')); break;
    }
  }
}

export const audio = new AudioManager();

export function haptic(ms: number): void {
  if (reduced()) return;
  // Chrome logs an error for every vibrate before the first tap (e.g. spawning
  // inside a landmark's range), so skip it until the page has been touched.
  const act = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  if (act && !act.hasBeenActive) return;
  navigator.vibrate?.(ms);
}
