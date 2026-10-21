import { useEffect, useMemo, useRef, useState } from 'react';
import { audio } from '../../services/audio';
import type { LoadedAssets } from '../../services/assets';
import { outfitLook, outfitOf, type Look, type OutfitId } from '../../data/outfits';
import {
  ACCESSORIES, ACCESSORY_SHEET, ACCESSORY_SHEET_SIZE, BACKGROUNDS, COUPLE_SHEET, POSES, SCENE_H, SCENE_W, renderScene,
  type AccessoryId, type BackgroundId, type PoseId,
} from '../../game/photobooth';

interface Props {
  assets: LoadedAssets;
  outfit: OutfitId;
  /** A fresh scene, every time a choice changes or an image arrives. */
  onScene: (scene: HTMLCanvasElement) => void;
}

/** The prop's own bounds from the sheet, fitted into a square tile. */
function PropIcon({ src, size }: { src: [number, number, number, number]; size: number }) {
  const [sx, sy, sw, sh] = src;
  const k = size / Math.max(sw, sh);
  return (
    <span aria-hidden className="grid place-items-center" style={{ width: size, height: size }}>
      <span
        style={{
          width: sw * k,
          height: sh * k,
          background: `url(${ACCESSORY_SHEET}) ${-sx * k}px ${-sy * k}px / ${ACCESSORY_SHEET_SIZE[0] * k}px ${ACCESSORY_SHEET_SIZE[1] * k}px no-repeat`,
        }}
      />
    </span>
  );
}

/** "With the bride and groom": the same switch in both photobox tabs. */
export function CoupleSwitch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className={`flex min-h-tap w-full items-center justify-between gap-3 rounded-md px-4 py-2 text-left ${
        on ? 'border-[3px] border-gold-500 bg-parchment-300' : 'border-2 border-wood-400 bg-parchment-100'
      }`}
    >
      <span>
        <b className="block text-[14px] text-ink-900">👰🤵 Bareng pengantin</b>
        <span className="block text-[12px] text-ink-600">Foto bersama kedua mempelai</span>
      </span>
      <span aria-hidden className={`grid h-7 w-12 shrink-0 items-center rounded-full border-2 border-wood-800 px-[2px] ${on ? 'justify-items-end bg-emerald-500' : 'justify-items-start bg-parchment-400'}`}>
        <span className="block h-5 w-5 rounded-full border-2 border-wood-800 bg-parchment-100" />
      </span>
    </button>
  );
}

const pill = (on: boolean) =>
  `grid justify-items-center gap-1 rounded-md px-1 py-2 text-[11px] font-semibold leading-3 text-ink-900 ${
    on ? 'border-[3px] border-gold-500 bg-parchment-300' : 'border-2 border-wood-400 bg-parchment-100'
  }`;

export default function CharacterBooth({ assets, outfit, onScene }: Props) {
  const [background, setBackground] = useState<BackgroundId>('pelaminan');
  const [pose, setPose] = useState<PoseId>('formal');
  // No prop to start with. The couple are in the shot by default, and a
  // keepsake with the bride and groom should not arrive wearing novelty
  // glasses nobody asked for — the playful ones are one tap away.
  const [accessory, setAccessory] = useState<AccessoryId>('none');
  /** With the bride and groom either side: the photo a guest most wants to keep. */
  const [withCouple, setWithCouple] = useState(true);
  /** Bumped as images load, so the scene is redrawn with them. */
  const [loaded, setLoaded] = useState(0);
  const sceneRef = useRef(onScene);
  sceneRef.current = onScene;

  const images = useMemo(() => {
    const load = (src: string) => {
      const img = new Image();
      img.onload = () => setLoaded((n) => n + 1);
      img.src = src;
      return img;
    };
    return { backgrounds: BACKGROUNDS.map((b) => load(b.src)), accessories: load(ACCESSORY_SHEET), couple: load(COUPLE_SHEET) };
  }, []);
  const look = useRef<Look | null>(null);
  look.current ??= outfitLook(outfit, assets.sprites, (l) => { look.current = l; setLoaded((n) => n + 1); });

  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = SCENE_W;
    canvas.height = SCENE_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    renderScene(ctx, {
      background: images.backgrounds[BACKGROUNDS.findIndex((b) => b.id === background)],
      accessories: images.accessories,
      couple: withCouple ? images.couple : null,
      look: look.current!,
      body: outfitOf(outfit).body,
      pose,
      accessory,
    });
    sceneRef.current(canvas);
  }, [background, pose, accessory, withCouple, loaded, images, outfit]);

  const choose = <T,>(set: (v: T) => void, v: T) => () => { audio.play('click'); set(v); };

  return (
    <div className="grid gap-4">
      <CoupleSwitch on={withCouple} onToggle={choose(setWithCouple, !withCouple)} />

      <div>
        <span className="label-cap mb-2 block">LATAR</span>
        <div className="grid grid-cols-3 gap-2">
          {BACKGROUNDS.map((b) => (
            <button key={b.id} type="button" aria-pressed={background === b.id} onClick={choose(setBackground, b.id)} className={pill(background === b.id)}>
              <span aria-hidden className="block h-12 w-full rounded-sm bg-cover bg-center" style={{ backgroundImage: `url(${b.src})` }} />
              {b.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="label-cap mb-2 block">GAYA</span>
        <div className="grid grid-cols-4 gap-2">
          {POSES.map((p) => (
            <button key={p.id} type="button" aria-pressed={pose === p.id} onClick={choose(setPose, p.id)} className={pill(pose === p.id)}>
              <span aria-hidden className="text-[22px] leading-7">{p.icon}</span>
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="label-cap mb-2 block">AKSESORI</span>
        <div className="grid grid-cols-4 gap-2">
          {ACCESSORIES.map((p) => (
            <button key={p.id} type="button" aria-pressed={accessory === p.id} onClick={choose(setAccessory, p.id)} className={pill(accessory === p.id)}>
              {p.src ? <PropIcon src={p.src} size={36} /> : <span aria-hidden className="grid h-9 place-items-center text-[18px]">∅</span>}
              {p.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
