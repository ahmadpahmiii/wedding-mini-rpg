import { useEffect, useRef, useState } from 'react';
import Modal from '../ui/Modal';
import { audio, haptic } from '../../services/audio';
import { useToast } from '../../hooks/useToast';
import { FRAME_H, FRAME_W, PHOTO_FRAMES as FRAMES } from '../../data/photoFrames';
import { coupleNames, wedding } from '../../data/weddingInfo';

/** Output size. The frame SVGs are 600x800, so 2x gives a printable PNG. */
const SCALE = 2;
const OUT_W = FRAME_W * SCALE;
const OUT_H = FRAME_H * SCALE;

type Stage = 'pick' | 'live' | 'done';

export default function PhotoboxModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [frame, setFrame] = useState(FRAMES[0].id);
  const [stage, setStage] = useState<Stage>('pick');
  const [count, setCount] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const resultBlob = useRef<Blob | null>(null);
  const [camError, setCamError] = useState(false);

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
  }, [frame]);

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
  const download = async () => {
    const blob = resultBlob.current;
    const name = `WeddingQuest-${wedding.couple.bride.name}-${wedding.couple.groom.name}-${Date.now()}.png`;

    if (blob && typeof navigator.share === 'function') {
      const file = new File([blob], name, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: `Wedding Quest — ${coupleNames}` });
          return; // the share sheet has it; saying "saved" would be a guess
        } catch {
          return; // the guest dismissed the sheet
        }
      }
    }

    const href = blob ? URL.createObjectURL(blob) : result;
    if (!href) return;
    const a = document.createElement('a');
    a.href = href;
    a.download = name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (blob) window.setTimeout(() => URL.revokeObjectURL(href), 30_000);
    toast('Foto tersimpan 📸', 'ok');
  };

  return (
    <Modal title="Photobox" icon="📷" onClose={onClose}>
      <p className="mb-4 mt-0 text-[13px] leading-5 text-ink-600">
        Ambil kenang-kenangan dari taman kami. <strong>Foto diproses langsung di perangkat kamu</strong> —
        tidak ada yang dikirim ke mana pun.
      </p>

      <span className="label-cap mb-2 block">PILIH BINGKAI</span>
      <div className="mb-5 grid grid-cols-3 gap-2">
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
          <div className="relative overflow-hidden rounded-md border-2 border-wood-400 bg-wood-900">
            <video ref={video} playsInline muted className="block w-full -scale-x-100" />
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
          <button type="button" onClick={() => void download()} className="btn-primary w-full">
            SIMPAN FOTO
          </button>
          <p className="m-0 text-[11px] leading-4 text-ink-muted">
            Kalau tombolnya tidak jalan di HP kamu, tekan lama fotonya di atas lalu pilih
            &ldquo;Simpan ke Foto&rdquo;.
          </p>
          <button
            type="button"
            onClick={() => { shot.current = null; setResult(null); setStage('pick'); }}
            className="btn-secondary w-full"
          >
            ULANGI
          </button>
        </div>
      )}
    </Modal>
  );
}
