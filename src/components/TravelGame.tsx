import { useEffect, useMemo, useRef, useState } from 'react';
import { audio, haptic } from '../services/audio';
import { CELL_W, CELL_H, type LoadedAssets } from '../services/assets';
import { outfitLook, OUTFITS, OUTFIT_PREVIEWS, type Look, type OutfitId } from '../data/outfits';
import {
  createRun, tick, DURATION, FINISH_H, FINISH_W, GROUND, H, HEARTS, MODES, OBSTACLES, PLAYER_X, W, obstacleW,
  type Run, type TravelMode,
} from '../game/travel';

interface Props {
  assets: LoadedAssets;
  outfit: OutfitId;
  /** Every way out leads to the venue: arriving, tumbling and skipping alike. */
  onDone: () => void;
}

const ART = '/assets/travel/';
/** A tap this soon before landing still jumps, so presses just before touchdown are not lost. */
const JUMP_BUFFER_MS = 140;

type Images = Record<'far' | 'near' | 'obstacles' | 'motor' | 'car' | 'finish', HTMLImageElement>;
const ready = (img: HTMLImageElement) => img.complete && img.naturalWidth > 0;

/**
 * Mirror-tiled, so art that was never painted to tile still joins without a seam:
 * each copy meets the next at the same edge of the painting.
 */
function tiled(ctx: CanvasRenderingContext2D, img: HTMLImageElement, scroll: number, y: number, h: number): boolean {
  if (!ready(img)) return false;
  const w = (img.naturalWidth / img.naturalHeight) * h;
  for (let k = Math.floor(scroll / w); k * w - scroll < W; k++) {
    const x = k * w - scroll;
    if (k % 2) {
      ctx.save();
      ctx.translate(x + w, y);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(img, x, y, w, h);
    }
  }
  return true;
}

/** The whole scene for one frame, in the 450 x 300 logical space. */
function draw(ctx: CanvasRenderingContext2D, r: Run, img: Images, look: Look) {
  ctx.fillStyle = '#9cc9dc';
  ctx.fillRect(0, 0, W, H);
  // The village art stops just short of the bottom edge; gravel, not sky, below the road.
  ctx.fillStyle = '#776c59';
  ctx.fillRect(0, GROUND + 20, W, H - GROUND - 20);
  tiled(ctx, img.far, r.dist * 0.15, -40, 330);
  if (!tiled(ctx, img.near, r.dist, -51, 330)) {
    ctx.fillStyle = '#3d3f4a';
    ctx.fillRect(0, GROUND - 24, W, H - GROUND + 24);
  }

  if (r.finishX !== null) {
    if (ready(img.finish)) ctx.drawImage(img.finish, r.finishX, GROUND + 8 - FINISH_H, FINISH_W, FINISH_H);
    else { ctx.fillStyle = '#d4af37'; ctx.fillRect(r.finishX + FINISH_W / 2 - 4, GROUND - FINISH_H, 8, FINISH_H); }
  }

  for (const o of r.obstacles) {
    const h = OBSTACLES[o.kind].h;
    const w = obstacleW(o.kind);
    const [sx, sy, sw, sh] = OBSTACLES[o.kind].src;
    if (ready(img.obstacles)) ctx.drawImage(img.obstacles, sx, sy, sw, sh, o.x, GROUND - h + 2, w, h);
    else { ctx.fillStyle = '#7a4a2a'; ctx.fillRect(o.x, GROUND - h, w, h); }
  }

  // Blink while hurt; nothing else can hit during it.
  if (r.hurt > 0 && Math.floor(r.hurt / 100) % 2) return;
  const { drawH } = MODES[r.mode];
  const bottom = GROUND - r.lift + 4;
  ctx.save();
  if (r.mode === 'jalan') {
    // The guest's own outfit, side frames facing left in the art — mirrored to walk right.
    const dw = (CELL_W / CELL_H) * drawH;
    const col = r.lift > 0 ? 2 : 2 + (Math.floor(r.t / 140) % 2);
    ctx.translate(PLAYER_X + dw / 2, bottom - drawH);
    ctx.scale(-1, 1);
    ctx.drawImage(look.sheet, col * CELL_W, (look.base + 1) * CELL_H, CELL_W, CELL_H, 0, 0, dw, drawH);
  } else {
    const v = r.mode === 'motor' ? img.motor : img.car;
    const dw = ready(v) ? (v.naturalWidth / v.naturalHeight) * drawH : drawH * 1.4;
    ctx.translate(PLAYER_X, bottom);
    ctx.rotate(r.lift > 0 ? (r.vy > 0 ? -0.08 : 0.05) : 0); // nose up on the way up
    if (ready(v)) ctx.drawImage(v, -dw / 2, -drawH, dw, drawH);
    else { ctx.fillStyle = '#9b2f2f'; ctx.fillRect(-dw / 2, -drawH, dw, drawH); }
  }
  ctx.restore();
}

export default function TravelGame({ assets, outfit, onDone }: Props) {
  const [stage, setStage] = useState<'pick' | 'run' | 'end'>('pick');
  const [mode, setMode] = useState<TravelMode>('motor');
  const [hud, setHud] = useState({ hearts: HEARTS, pct: 0, outcome: null as Run['outcome'] });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const jumpAt = useRef(0);

  // Loading starts on the pick screen, so the art is there by the time a mode is chosen.
  const img = useMemo<Images>(() => {
    const load = (f: string) => Object.assign(new Image(), { src: ART + f });
    return {
      far: load('bg_far.jpg'), near: load('bg_near.png'), obstacles: load('obstacles.png'),
      motor: load('motor.png'), car: load('car.png'), finish: load('finish.png'),
    };
  }, []);
  const look = useRef<Look | null>(null);
  look.current ??= outfitLook(outfit, assets.sprites, (l) => { look.current = l; });

  const jump = () => { jumpAt.current = performance.now(); };

  useEffect(() => {
    if (stage !== 'run') return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { alpha: false });
    if (!canvas || !ctx) return;
    const run = createRun(mode);
    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cssW = canvas.getBoundingClientRect().width;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(((cssW * H) / W) * dpr);
      const k = (cssW / W) * dpr;
      ctx.setTransform(k, 0, 0, k, 0, 0);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);

    let raf = 0;
    let last = performance.now();
    let shown = { hearts: HEARTS, pct: 0 };
    const frame = (now: number) => {
      const want = jumpAt.current > 0 && now - jumpAt.current < JUMP_BUFFER_MS;
      const before = { lift: run.lift, hearts: run.hearts };
      tick(run, now - last, want);
      last = now;
      if (want && run.vy > 0 && before.lift === 0) { jumpAt.current = 0; audio.play('click'); }
      if (run.hearts < before.hearts) { audio.play('close'); haptic(30); }
      draw(ctx, run, img, look.current!);

      const pct = Math.min(100, Math.round((100 * run.t) / DURATION));
      if (pct !== shown.pct || run.hearts !== shown.hearts || run.outcome) {
        shown = { hearts: run.hearts, pct };
        setHud({ ...shown, outcome: run.outcome });
      }
      if (run.outcome) {
        audio.play(run.outcome === 'arrived' ? 'levelup' : 'close');
        setStage('end');
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') { e.preventDefault(); jump(); }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('keydown', onKey);
    };
  }, [stage, mode, img]);

  const start = (m: TravelMode) => {
    audio.play('click');
    setMode(m);
    setHud({ hearts: HEARTS, pct: 0, outcome: null });
    setStage('run');
  };
  const skip = () => { audio.play('click'); onDone(); };

  if (stage === 'pick') return <Pick outfit={outfit} onPick={start} onSkip={skip} />;

  return (
    // touch-none: rapid taps must never scroll the page or zoom it on iOS.
    <div className="mx-auto flex h-full w-full max-w-stage touch-none select-none flex-col bg-wood-900">
      <header
        className="flex items-center gap-3 px-3 pb-2"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        <span className="font-pixel text-[12px] tracking-[2px] text-wax-400" aria-label={`Nyawa ${hud.hearts} dari ${HEARTS}`}>
          {'♥'.repeat(hud.hearts)}<span className="text-wood-600">{'♥'.repeat(HEARTS - hud.hearts)}</span>
        </span>
        <div className="grid grow gap-1">
          <span className="font-pixel text-[7px] tracking-[1px] text-gold-400">MENUJU LOKASI ACARA</span>
          <div className="h-2 overflow-hidden rounded-full border border-gold-500 bg-wood-800" aria-hidden>
            <div className="h-full bg-gold-500" style={{ width: `${hud.pct}%` }} />
          </div>
        </div>
        <button
          type="button"
          onClick={skip}
          className="min-h-tap rounded-sm border-2 border-gold-500 bg-wood-800 px-3 font-pixel text-[9px] text-ink-onwood"
        >
          LEWATI ›
        </button>
      </header>

      <div className="relative grid grow place-items-center" onPointerDown={stage === 'run' ? jump : undefined}>
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="Perjalanan ke lokasi acara"
          className="block aspect-[3/2] w-full border-y-[3px] border-gold-500"
        />
        {stage === 'end' && (
          <Arrival outcome={hud.outcome} hearts={hud.hearts} onGo={onDone} onAgain={() => setStage('pick')} />
        )}
      </div>

      <footer className="grid gap-2 px-4 pt-2" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
        <button
          type="button"
          onPointerDown={(e) => { e.preventDefault(); jump(); }}
          disabled={stage !== 'run'}
          className="btn-primary h-[76px] w-full text-[13px]"
        >
          ▲ LOMPAT
        </button>
        <p className="m-0 text-center text-[11px] text-parchment-300">
          Ketuk layar atau tombol untuk melompati rintangan
        </p>
      </footer>
    </div>
  );
}

function Pick({ outfit, onPick, onSkip }: { outfit: OutfitId; onPick: (m: TravelMode) => void; onSkip: () => void }) {
  const preview = OUTFITS.findIndex((o) => o.id === outfit);
  const thumb = (m: TravelMode) => m === 'jalan'
    ? (
      <span
        aria-hidden
        className="mx-auto block"
        style={{ width: 44, height: 66, background: `url(${OUTFIT_PREVIEWS}) ${-preview * 44}px 0 / ${44 * OUTFITS.length}px 66px no-repeat` }}
      />
    )
    : <img src={`${ART}${m === 'motor' ? 'motor' : 'car'}.png`} alt="" className="mx-auto h-[66px] w-full object-contain" />;

  return (
    <div className="relative grid h-full place-items-center overflow-hidden bg-wood-900 p-5">
      <div aria-hidden className="absolute inset-0 bg-[url('/assets/map/world_map_v2.jpg')] bg-cover bg-bottom brightness-[.42]" />
      <div
        className="relative w-full max-w-[360px] rounded-lg border-4 border-gold-500 bg-parchment-200 px-5 py-6 text-center shadow-modal"
        style={{ animation: 'wq-rise 320ms ease-out' }}
      >
        <span className="label-cap">PERJALANAN</span>
        <h1 className="mb-2 mt-1 font-display text-[26px] font-bold text-ink-900">Berangkat ke acara</h1>
        <p className="mb-4 text-sm leading-[22px] text-ink-600">
          Mau naik apa ke pernikahan kami? Lompati rintangan di jalan, sekitar 20 detik.
        </p>
        <div className="mb-4 grid grid-cols-3 gap-2" role="group" aria-label="Pilih kendaraan">
          {(Object.keys(MODES) as TravelMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onPick(m)}
              className="flex flex-col items-center rounded-md border-2 border-wood-400 bg-parchment-100 px-1 pb-2 pt-3 active:border-gold-500"
            >
              {thumb(m)}
              <b className="mt-2 block font-pixel text-[8px] text-ink-900">{MODES[m].name}</b>
              <span className="mt-1 block text-[10px] leading-3 text-ink-muted">{MODES[m].sub}</span>
            </button>
          ))}
        </div>
        <button type="button" onClick={onSkip} className="btn-ghost w-full">LEWATI, LANGSUNG KE TAMAN</button>
      </div>
    </div>
  );
}

/** Some guests come back just to ride, so another go is one tap away. */
function Arrival({ outcome, hearts, onGo, onAgain }: {
  outcome: Run['outcome']; hearts: number; onGo: () => void; onAgain: () => void;
}) {
  const arrived = outcome === 'arrived';
  return (
    <div className="absolute inset-x-4 rounded-lg border-4 border-gold-500 bg-parchment-200 p-5 text-center shadow-modal"
         style={{ animation: 'wq-rise 220ms ease-out' }}>
      <h2 className="mb-1 mt-0 font-display text-[22px] font-bold text-ink-900">
        {arrived ? 'Sampai! 🎉' : 'Aduh, jalannya ramai!'}
      </h2>
      <p className="mb-4 mt-0 text-[13px] leading-5 text-ink-600">
        {!arrived ? 'Tenang, kamu tetap sampai di acara.'
          : hearts === HEARTS ? 'Mulus tanpa hambatan.' : 'Sedikit drama di jalan, tapi sampai juga.'}
      </p>
      <div className="grid gap-2">
        <button type="button" onClick={onGo} className="btn-primary w-full">MASUK KE TAMAN</button>
        <button type="button" onClick={onAgain} className="btn-secondary w-full">MAIN LAGI</button>
      </div>
    </div>
  );
}
