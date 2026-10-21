import { useEffect, useRef, useState } from 'react';
import { audio, haptic } from '../services/audio';
import { wedding } from '../data/weddingInfo';

interface Props { guestName: string; onOpened: () => void }

/**
 * The envelope. Its SVG is fetched and inlined rather than used as <img src>:
 * an SVG-as-image cannot load its Google Fonts @import, and the guest's name
 * has to be written into the card slot at runtime.
 *
 * The seal drawn inside the SVG is the visual; the button below is a larger
 * transparent hit area sitting exactly on top of it.
 */
export default function CoverOpening({ guestName, onOpened }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [breaking, setBreaking] = useState(false);
  /** No envelope art means no visible seal — the guest needs a real button instead. */
  const [noArt, setNoArt] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/assets/ui/cover_envelope.svg')
      // A 404 page must never be pasted into the cover as if it were the SVG.
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.text(); })
      .then((svg) => {
        if (!alive || !host.current) return;
        host.current.innerHTML = svg;
        const el = host.current.querySelector('svg');
        el?.setAttribute('width', '100%');
        el?.removeAttribute('height');
        // Target the card slot by class — the last <text> is the seal monogram.
        const slot = host.current.querySelector<SVGTextElement>('text.guest-name');
        if (slot) slot.textContent = guestName;
        // The seal group is the only element the SVG marks as clickable.
        host.current.querySelector<SVGGElement>('g[style*="cursor"]')?.classList.add('wq-seal');
      })
      .catch(() => { if (alive) setNoArt(true); });
    return () => { alive = false; };
  }, [guestName]);

  const open = async () => {
    if (breaking) return;
    setBreaking(true);
    host.current?.querySelector('.wq-seal')?.classList.add('wq-seal-break');
    await audio.unlock();
    audio.play('seal');
    haptic(18);
    window.setTimeout(() => void audio.startBgm(wedding.bgmUrl), 500);
    window.setTimeout(onOpened, 900);
  };

  return (
    <div className="relative grid h-full place-items-center overflow-hidden bg-wood-900 p-5">
      <div
        aria-hidden
        className="absolute inset-0 bg-[url('/assets/map/world_map_v2.jpg')] bg-cover bg-top transition-[filter] duration-700"
        style={{ filter: breaking ? 'blur(0px) brightness(.55)' : 'blur(8px) brightness(.45)' }}
      />
      <div
        className="relative w-full max-w-[360px] transition-transform duration-[650ms]"
        style={{
          transform: breaking ? 'translateY(-130%)' : 'none',
          transitionTimingFunction: 'cubic-bezier(.4,0,.2,1)',
          transitionDelay: breaking ? '450ms' : '0ms',
        }}
      >
        <div ref={host} className="drop-shadow-[0_18px_44px_#1b110d99]" />
        {/* 48.6% is where the SVG draws its seal, on the ribbon crossing. */}
        <button
          type="button"
          onClick={open}
          aria-label={`Buka undangan untuk ${guestName}`}
          className="absolute left-1/2 top-[48.6%] h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full"
        />
      </div>
      {noArt && !breaking && (
        <button type="button" onClick={open} className="btn-primary relative">BUKA UNDANGAN</button>
      )}
      {!breaking && !noArt && (
        <p className="absolute bottom-8 px-4 text-center font-pixel text-[8px] leading-4 tracking-[1px] text-gold-400">
          KETUK SEGEL UNTUK MEMBUKA
        </p>
      )}
    </div>
  );
}
