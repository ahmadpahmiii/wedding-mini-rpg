import { useState } from 'react';
import { audio } from '../services/audio';
import { CELL_W, CELL_H, type LoadedAssets } from '../services/assets';
import type { Gender } from '../game/types';

interface Props { assets: LoadedAssets; initialName: string; onStart: (gender: Gender, name: string) => void }

const OPTIONS: { id: Gender; label: string; sub: string; row: number }[] = [
  { id: 'pria', label: 'PRIA', sub: 'Batik & Peci', row: 0 },
  { id: 'wanita', label: 'WANITA', sub: 'Kebaya & Sanggul', row: 2 },
];

/** Draws one idle cell straight from the keyed spritesheet, so the choice shows the real body. */
function SpritePreview({ assets, row }: { assets: LoadedAssets; row: number }) {
  return (
    <canvas
      width={CELL_W}
      height={CELL_H}
      className="mx-auto mb-2 h-[112px] w-[75px] [image-rendering:pixelated]"
      ref={(el) => {
        const ctx = el?.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, CELL_W, CELL_H);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(assets.sprites, 0, row * CELL_H, CELL_W, CELL_H, 0, 0, CELL_W, CELL_H);
      }}
    />
  );
}

export default function CharacterSelect({ assets, initialName, onStart }: Props) {
  const [gender, setGender] = useState<Gender>('pria');
  const [name, setName] = useState(initialName);

  const start = () => {
    audio.play('levelup');
    onStart(gender, name.trim() || 'Tamu Undangan');
  };

  return (
    <div className="relative grid h-full place-items-center overflow-hidden bg-wood-900 p-5">
      <div
        aria-hidden
        className="absolute inset-0 bg-[url('/assets/map/world_map_base.jpg')] bg-cover bg-top brightness-[.42]"
      />
      <div
        className="relative w-full max-w-[360px] rounded-lg border-4 border-gold-500 bg-parchment-200
                   px-5 py-6 text-center shadow-modal"
        style={{ animation: 'wq-rise 320ms ease-out' }}
      >
        <h1 className="mb-2 font-display text-[26px] font-bold text-ink-900">Pilih karakter kamu</h1>
        <p className="mb-5 text-sm leading-[22px] text-ink-600">
          Yuk jalan-jalan keliling peta pernikahan kami dan sapa pasangan.
        </p>

        <div className="mb-5 grid grid-cols-2 gap-3">
          {OPTIONS.map((o) => {
            const on = gender === o.id;
            return (
              <button
                key={o.id}
                type="button"
                aria-pressed={on}
                onClick={() => { audio.play('click'); setGender(o.id); }}
                className={`relative rounded-md bg-parchment-100 px-2 py-3 ${
                  on ? 'border-[3px] border-gold-500 opacity-100 shadow-raised-gold' : 'border-2 border-wood-400 opacity-75'
                }`}
              >
                {on && (
                  <span className="absolute -right-[9px] -top-[9px] grid h-6 w-6 place-items-center rounded-full
                                   border-2 border-wood-800 bg-wax-500 text-xs text-parchment-100">✓</span>
                )}
                <SpritePreview assets={assets} row={o.row} />
                <b className="block font-pixel text-[9px] text-ink-900">{o.label}</b>
                <span className="mt-[5px] block text-[11px] text-ink-muted">{o.sub}</span>
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
      </div>
    </div>
  );
}
