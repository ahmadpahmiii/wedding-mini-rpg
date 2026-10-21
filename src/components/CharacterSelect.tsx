import { useState } from 'react';
import { audio } from '../services/audio';
import { OUTFITS, OUTFIT_PREVIEWS, type OutfitId } from '../data/outfits';

interface Props { initialName: string; initialOutfit: OutfitId; onStart: (outfit: OutfitId, name: string) => void }

/** One front frame from the previews strip: 150 x 224 cells, in OUTFITS order. */
const PREVIEW_W = 60;
const PREVIEW_H = Math.round((224 / 150) * PREVIEW_W);

export default function CharacterSelect({ initialName, initialOutfit, onStart }: Props) {
  const [outfit, setOutfit] = useState<OutfitId>(initialOutfit);
  const [name, setName] = useState(initialName);

  const start = () => {
    audio.play('levelup');
    onStart(outfit, name.trim() || 'Tamu Undangan');
  };

  return (
    <div className="relative grid h-full place-items-center overflow-hidden bg-wood-900 p-5">
      <div
        aria-hidden
        className="absolute inset-0 bg-[url('/assets/map/world_map_v2.jpg')] bg-cover bg-top brightness-[.42]"
      />
      <div
        className="relative w-full max-w-[360px] rounded-lg border-4 border-gold-500 bg-parchment-200
                   px-5 py-6 text-center shadow-modal"
        style={{ animation: 'wq-rise 320ms ease-out' }}
      >
        <h1 className="mb-2 font-display text-[26px] font-bold text-ink-900">Pilih baju kamu</h1>
        <p className="mb-4 text-sm leading-[22px] text-ink-600">
          Semua baju gratis. Yuk jalan-jalan keliling peta pernikahan kami dan sapa pasangan.
        </p>

        {/* Every outfit is free and open to everyone; nothing is picked for the guest from their name. */}
        <div className="mb-5 grid grid-cols-3 gap-2" role="group" aria-label="Pilih baju">
          {OUTFITS.map((o, i) => {
            const on = outfit === o.id;
            return (
              <button
                key={o.id}
                type="button"
                aria-pressed={on}
                aria-label={o.sub}
                onClick={() => { audio.play('click'); setOutfit(o.id); }}
                className={`relative flex flex-col items-center rounded-md bg-parchment-100 px-1 pb-2 pt-3 ${
                  on ? 'border-[3px] border-gold-500 opacity-100 shadow-raised-gold' : 'border-2 border-wood-400 opacity-80'
                }`}
              >
                {on && (
                  <span className="absolute -right-[8px] -top-[8px] grid h-5 w-5 place-items-center rounded-full
                                   border-2 border-wood-800 bg-wax-500 text-[10px] text-parchment-100">✓</span>
                )}
                <span
                  aria-hidden
                  className="mx-auto mb-1 block"
                  style={{
                    width: PREVIEW_W,
                    height: PREVIEW_H,
                    background: `url(${OUTFIT_PREVIEWS}) ${-i * PREVIEW_W}px 0 / ${PREVIEW_W * OUTFITS.length}px ${PREVIEW_H}px no-repeat`,
                  }}
                />
                <b className="block font-pixel text-[8px] text-ink-900">{o.label}</b>
                <span className="mt-1 block text-[10px] leading-3 text-ink-muted">{o.sub}</span>
              </button>
            );
          })}
        </div>

        <label htmlFor="wq-name" className="label-cap mb-2 block text-left">NAMA KAMU</label>
        <input
          id="wq-name"
          className="field mb-5"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') start(); }}
        />
        <button type="button" onClick={start} className="btn-primary w-full">MASUKI PETA DUNIA!</button>
        {/* The whole invitation without the game, for anyone who would rather just read it. */}
        <a
          href={`/undangan/${window.location.search}`}
          className="mt-4 inline-flex min-h-tap items-center text-[13px] font-semibold text-ink-600 underline underline-offset-4"
        >
          Lihat undangan biasa, tanpa game
        </a>
      </div>
    </div>
  );
}
