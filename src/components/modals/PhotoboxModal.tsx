import { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '../ui/Modal';
import { audio, haptic } from '../../services/audio';
import { useToast } from '../../hooks/useToast';
import { FRAME_H, FRAME_W, PHOTO_FRAMES as FRAMES } from '../../data/photoFrames';
import { coupleNames, wedding } from '../../data/weddingInfo';
import CharacterBooth, { CoupleSwitch } from './CharacterBooth';
import { CELL_H, CELL_W, type LoadedAssets } from '../../services/assets';
import { COUPLE_SHEET } from '../../game/photobooth';
import type { OutfitId } from '../../data/outfits';

/** Output size. The frame SVGs are 600x800, so 2x gives a printable PNG. */
const SCALE = 2;
const OUT_W = FRAME_W * SCALE;
const OUT_H = FRAME_H * SCALE;

type Stage = 'pick' | 'live' | 'done';
type Mode = 'karakter' | 'kamera';

/**
 * Safari on iPhone ignores downloads; the share sheet's "Save Image" is the
 * only way into Photos there. Everywhere else a download lands in the gallery.
 */
const IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/**
 * The couple standing either side of a selfie, like the life-size standee at
 * a real wedding photobooth: groom at the left edge, bride at the right, feet
 * on the bottom. Drawn on a transparent canvas the size of the frame's photo
 * window, so the same picture sits over the live camera and in the saved photo.
 */
function standee(sheet: HTMLImageElement, w: number, h: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const k = (0.6 * h) / 172; // a standing body is 172 px of its 224 px cell
  for (const [col, cx] of [[0, 0.16], [1, 0.83]] as const) {
    ctx.drawImage(sheet, col * CELL_W, 0, CELL_W, CELL_H, cx * w - (CELL_W / 2) * k, h - 200 * k, CELL_W * k, CELL_H * k);
  }
  return cv;
}

interface Props {
  assets: LoadedAssets;
  outfit: OutfitId;
  /** The guest kept a picture: that is what Picture Perfect is for. */
  onSaved: () => void;
  onClose: () => void;
}

/**
 * Two ways to the same framed keepsake. The character photo needs no camera
 * and no permission, so it comes first; the camera photo is one tab away.
 * Both are composed and framed here, on the device, and never uploaded.
 */
export default function PhotoboxModal({ assets, outfit, onSaved, onClose }: Props) {
  const toast = useToast();
  const [mode, setMode] = useState<Mode>('karakter');
  const [frame, setFrame] = useState(FRAMES[0].id);
  const [stage, setStage] = useState<Stage>('pick');
  const [count, setCount] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const resultBlob = useRef<Blob | null>(null);
  const [camError, setCamError] = useState(false);
  /** Camera tab: the couple standing either side of the guest. */
  const [withCouple, setWithCouple] = useState(true);
  const [coupleReady, setCoupleReady] = useState(false);
  const coupleSheet = useMemo(() => {
    const img = new Image();
    img.onload = () => setCoupleReady(true);
    img.src = COUPLE_SHEET;
    return img;
  }, []);
  const spec = FRAMES.find((f) => f.id === frame) ?? FRAMES[0];
  const overlay = useMemo(
    () => (withCouple && coupleReady ? standee(coupleSheet, spec.win.w * SCALE, spec.win.h * SCALE) : null),
    [withCouple, coupleReady, coupleSheet, spec],
  );
  const overlayUrl = useMemo(() => overlay?.toDataURL('image/png') ?? null, [overlay]);

  const video = useRef<HTMLVideoElement>(null);
  /** The 3-2-1 timer, so closing mid-countdown cannot fire the shutter into a dead modal. */
  const countdown = useRef<number | undefined>(undefined);
  /** Each composite bumps this; a slower, older one finishing late must not win. */
  const job = useRef(0);
  const stream = useRef<MediaStream | null>(null);
  /** The photo itself, kept so a frame picked afterwards re-frames it instead of being ignored. */
  const shot = useRef<HTMLImageElement | HTMLCanvasElement | null>(null);

  const stopCam = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };

  // The camera must not outlive the modal, or a backgrounded tab.
  useEffect(() => {
    const onHide = () => { if (document.hidden) { stopCam(); setStage('pick'); } };
    document.addEventListener('visibilitychange', onHide);
    return () => { document.removeEventListener('visibilitychange', onHide); stopCam(); window.clearInterval(countdown.current); };
  }, []);

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError(true);
      toast('Kamera tidak tersedia di browser ini — silakan unggah foto', 'bad');
      return;
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      setCamError(false);
      setStage('live'); // the effect below attaches it once the <video> exists
    } catch {
      setCamError(true);
      toast('Kamera tidak bisa dibuka — silakan unggah foto', 'bad');
    }
  };

  /**
   * Attach the stream after React has actually put the <video> in the DOM.
   * The old code did this from a requestAnimationFrame fired straight after
   * setStage, which can run before the commit — `video.current` was null and
   * the preview stayed blank. iOS also wants muted and playsInline set as
   * properties before play(), or it refuses to start inline.
   */
  useEffect(() => {
    const el = video.current;
    const s = stream.current;
    if (stage !== 'live' || !el || !s) return;
    el.srcObject = s;
    el.muted = true;
    el.playsInline = true;
    void el.play().catch(() => {
      setCamError(true);
      setStage('pick');
    });
  }, [stage]);

  const onUpload = (file: File) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); shot.current = img; void composite(img); };
    img.onerror = () => { URL.revokeObjectURL(url); toast('Foto tidak bisa dibaca — coba foto lain', 'bad'); };
    img.src = url;
  };

  useEffect(() => {
    if (shot.current) void composite(shot.current);
  }, [frame, overlay]); // a new frame, or the couple switched on or off, re-frames the photo already taken

  /** Draws the frame, then the photo cover-fit into that frame's window. */
  async function composite(source: HTMLImageElement | HTMLCanvasElement) {
    const mine = ++job.current;
    const spec = FRAMES.find((f) => f.id === frame) ?? FRAMES[0];
    const cv = document.createElement('canvas');
    cv.width = OUT_W;
    cv.height = OUT_H;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#fdf6e2';
    ctx.fillRect(0, 0, OUT_W, OUT_H);

    // Frame first. Its window is opaque, so the photo goes on top of it.
    const frameImg = new Image();
    frameImg.decoding = 'sync';
    const framed = await new Promise<boolean>((res) => {
      frameImg.onload = () => res(true);
      frameImg.onerror = () => res(false);
      frameImg.src = `/assets/frames/${spec.id}.svg`;
    });
    // Tapping through the frames quickly starts several of these at once.
    if (mine !== job.current) return;
    if (framed && frameImg.naturalWidth) ctx.drawImage(frameImg, 0, 0, OUT_W, OUT_H);

    const sw = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
    const sh = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
    const dx = spec.win.x * SCALE, dy = spec.win.y * SCALE;
    const dw = spec.win.w * SCALE, dh = spec.win.h * SCALE;
    const fit = Math.max(dw / sw, dh / sh);
    const w = sw * fit, h = sh * fit;

    ctx.save();
    ctx.beginPath();
    ctx.rect(dx, dy, dw, dh);
    ctx.clip();
    ctx.drawImage(source, dx + (dw - w) / 2, dy + (dh - h) / 2, w, h);
    // The couple stand in the selfie exactly where they stood over the live camera.
    if (mode === 'kamera' && overlay) ctx.drawImage(overlay, dx, dy, dw, dh);
    ctx.restore();

    setResult(cv.toDataURL('image/png'));
    cv.toBlob((b) => { resultBlob.current = b; }, 'image/png');
    setStage('done');
    stopCam();
  }

  const capture = () => {
    let n = 3;
    setCount(n);
    window.clearInterval(countdown.current);
    const tick = window.setInterval(() => {
      n -= 1;
      if (n > 0) {
        setCount(n);
        audio.play('click');
      } else {
        window.clearInterval(tick);
        setCount(null);
        setFlash(true);
        audio.play('camera');
        haptic(20);
        window.setTimeout(() => setFlash(false), 220);
        const v = video.current;
        if (v?.videoWidth) {
          // A snapshot at the camera's real size. The <video> element itself
          // reports width 0, so every camera photo used to be stretched to the
          // frame's 3:4. Mirrored, like the preview the guest framed themselves in.
          const c = document.createElement('canvas');
          c.width = v.videoWidth;
          c.height = v.videoHeight;
          const g = c.getContext('2d');
          if (g) { g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(v, 0, 0); }
          shot.current = c;
          void composite(c);
        }
      }
    }, 1000);
    countdown.current = tick;
    audio.play('click');
  };

  /**
   * iOS Safari ignores the `download` attribute, so the old one-liner did
   * nothing at all on an iPhone — which is most of the guests. Share sheet
   * first (that is how you get a photo into the camera roll on iOS), a real
   * download where that exists, and a new tab as the last resort.
   */
  const switchMode = (m: Mode) => {
    if (m === mode) return;
    audio.play('click');
    stopCam();
    window.clearInterval(countdown.current);
    setCount(null);
    shot.current = null;
    setResult(null);
    setStage('pick');
    setMode(m);
  };

  const fileName = () => `WeddingQuest-${wedding.couple.bride.name}-${wedding.couple.groom.name}-${Date.now()}.png`;
  const shareable = (blob: Blob | null): File | null => {
    if (!blob || typeof navigator.share !== 'function') return null;
    const file = new File([blob], fileName(), { type: 'image/png' });
    return navigator.canShare?.({ files: [file] }) ? file : null;
  };

  /**
   * Into the gallery. On an iPhone that means the share sheet's "Save Image";
   * elsewhere a download, which the gallery picks up. Picture Perfect follows
   * the "saved" toast: there is one toast slot, and its words say it too.
   */
  const saveToGallery = async () => {
    const blob = resultBlob.current;
    const file = IOS ? shareable(blob) : null;
    if (file) {
      try {
        await navigator.share({ files: [file] });
        onSaved();
      } catch { /* dismissed: nothing was saved */ }
      return;
    }
    const href = blob ? URL.createObjectURL(blob) : result;
    if (!href) return;
    const a = document.createElement('a');
    a.href = href;
    a.download = fileName();
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (blob) window.setTimeout(() => URL.revokeObjectURL(href), 30_000);
    toast('Foto tersimpan di galeri 📸', 'ok');
    onSaved();
  };

  /** Straight to WhatsApp, Instagram and the rest, where the phone can share files. */
  const share = async () => {
    const file = shareable(resultBlob.current);
    if (!file) return;
    try {
      await navigator.share({ files: [file], title: `Wedding Quest — ${coupleNames}`, text: `Foto bareng ${coupleNames} 💍 ${wedding.hashtag}` });
      onSaved();
    } catch { /* dismissed */ }
  };
  const canShare = !!result && typeof navigator.share === 'function' && typeof navigator.canShare === 'function';

  const framePicker = (
    <div>
      <span className="label-cap mb-2 block">PILIH BINGKAI</span>
      <div className="grid grid-cols-3 gap-2">
        {FRAMES.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={frame === f.id}
            onClick={() => { audio.play('click'); setFrame(f.id); }}
            className={`rounded-md bg-parchment-100 p-2 ${
              frame === f.id ? 'border-[3px] border-gold-500 shadow-raised-gold' : 'border-2 border-wood-400 opacity-75'
            }`}
          >
            <img src={`/assets/frames/${f.id}.svg`} alt="" className="mb-2 w-full" />
            <span className="block text-center font-pixel text-[7px] leading-[11px] text-ink-900">{f.name}</span>
          </button>
        ))}
      </div>
    </div>
  );

  const save = (
    <div className="grid gap-2">
      <div className={`grid gap-2 ${canShare ? 'grid-cols-[1fr_auto]' : ''}`}>
        <button type="button" onClick={() => void saveToGallery()} disabled={!result} className="btn-primary w-full">
          💾 SIMPAN KE GALERI
        </button>
        {canShare && (
          <button type="button" onClick={() => void share()} className="btn-secondary px-4" aria-label="Bagikan foto">
            📤
          </button>
        )}
      </div>
      <p className="m-0 text-center text-[11px] leading-4 text-ink-muted">
        {IOS && canShare ? 'Di iPhone: pilih “Simpan Gambar” di menu yang muncul.' : 'Foto masuk ke folder Download dan muncul di Galeri.'}
        {' '}Tidak jalan? Tekan lama fotonya, lalu simpan.
      </p>
    </div>
  );

  return (
    <Modal title="Photobox" icon="📷" onClose={onClose} footer={mode === 'karakter' ? save : undefined}>
      <p className="mb-4 mt-0 text-[13px] leading-5 text-ink-600">
        Ambil kenang-kenangan dari taman kami. <strong>Foto diproses langsung di perangkat kamu</strong> —
        tidak ada yang dikirim ke mana pun.
      </p>

      <div className="mb-5 grid grid-cols-2 overflow-hidden rounded-md border-2 border-wood-400" role="tablist">
        {([['karakter', '🎮 FOTO KARAKTER'], ['kamera', '📷 FOTO KAMU']] as const).map(([m, label]) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => switchMode(m)}
            className={`min-h-tap font-pixel text-[8px] ${mode === m ? 'bg-gold-500 text-wood-800' : 'bg-parchment-100 text-ink-600'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'karakter' && (
        <div className="grid gap-5">
          {result
            ? <img src={result} alt="Pratinjau foto karakter" className="mx-auto max-h-[44vh] rounded-md border-2 border-wood-400" />
            : (
              <div className="mx-auto grid aspect-[3/4] max-h-[44vh] w-2/3 place-items-center rounded-md border-2 border-dashed border-wood-400 text-[12px] text-ink-muted">
                Menyiapkan foto…
              </div>
            )}
          <CharacterBooth assets={assets} outfit={outfit} onScene={(scene) => { shot.current = scene; void composite(scene); }} />
          {framePicker}
        </div>
      )}

      {mode === 'kamera' && (
        <div className="grid gap-5">
          <CoupleSwitch on={withCouple} onToggle={() => { audio.play('click'); setWithCouple((v) => !v); }} />
          {framePicker}

          {stage === 'pick' && (
            <div className="grid gap-2">
              <button type="button" onClick={startCamera} className="btn-primary w-full">AMBIL FOTO</button>
              <label className="btn-secondary w-full cursor-pointer text-center">
                UNGGAH FOTO
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  // Cleared after reading, or choosing the same photo again after ULANGI did nothing.
                  onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onUpload(f); }}
                />
              </label>
              {camError && (
                <p className="m-0 text-[11px] leading-4 text-ink-muted">
                  Kamera tidak tersedia atau ditolak. Mengunggah foto dari galeri hasilnya sama persis.
                </p>
              )}
            </div>
          )}

          {stage === 'live' && (
            <div className="grid gap-3">
              {/* Shaped like the frame's photo window and cropped the same way, so
                  the couple stand over the live camera exactly where they will be in the photo. */}
              <div
                className="relative overflow-hidden rounded-md border-2 border-wood-400 bg-wood-900"
                style={{ aspectRatio: `${spec.win.w} / ${spec.win.h}` }}
              >
                <video ref={video} playsInline muted className="block h-full w-full -scale-x-100 object-cover" />
                {overlayUrl && <img src={overlayUrl} alt="" className="pointer-events-none absolute inset-0 h-full w-full" />}
                {count !== null && (
                  <div className="absolute inset-0 grid place-items-center bg-wood-900/50">
                    <span className="font-pixel text-[54px] text-gold-400">{count}</span>
                  </div>
                )}
                {flash && (
                  <div className="absolute inset-0 bg-white" style={{ animation: 'wq-flash 220ms ease-out forwards' }} />
                )}
              </div>
              <button type="button" onClick={capture} disabled={count !== null} className="btn-primary w-full">
                {count !== null ? 'BERSIAP…' : '📸 JEPRET (3-2-1)'}
              </button>
              <button type="button" onClick={() => { stopCam(); setStage('pick'); }} className="btn-ghost w-full">BATAL</button>
            </div>
          )}

          {stage === 'done' && result && (
            <div className="grid gap-3">
              <img src={result} alt="Hasil photobox" className="w-full rounded-md border-2 border-wood-400" />
              {save}
              <button
                type="button"
                onClick={() => { shot.current = null; setResult(null); setStage('pick'); }}
                className="btn-secondary w-full"
              >
                ULANGI
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
