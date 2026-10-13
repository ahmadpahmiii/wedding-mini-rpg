import type { Destination } from '../game/types';
import { audio } from '../services/audio';

interface Props { active: Destination | null; unread: number; onPick: (d: Destination) => void }

/** Five destinations. Galeri, Cerita, Sapa Tamu and Hadiah were removed by decision. */
const ITEMS: { id: Destination; label: string; icon: string }[] = [
  { id: 'pasangan',  label: 'PASANGAN', icon: 'nav_pasangan' },
  { id: 'acara',     label: 'ACARA',    icon: 'nav_acara' },
  { id: 'rsvp',      label: 'RSVP',     icon: 'nav_rsvp' },
  { id: 'ngobrol',   label: 'NGOBROL',  icon: 'nav_ngobrol' },
  { id: 'photobox',  label: 'PHOTOBOX', icon: 'nav_photobox' },
];

export default function BottomNav({ active, unread, onPick }: Props) {
  return (
    <nav
      aria-label="Menu undangan"
      className="absolute inset-x-0 bottom-0 z-30 px-3 pb-3"
      style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
    >
      <ul className="flex items-end gap-[2px] overflow-x-auto rounded-sm border-[3px] border-gold-500
                     bg-wood-800 p-[6px] shadow-modal [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {ITEMS.map((it) => {
          const on = active === it.id;
          const cta = it.id === 'rsvp';
          return (
            <li key={it.id} className="min-w-0 flex-1">
              <button
                type="button"
                aria-current={on ? 'page' : undefined}
                onClick={() => { audio.play('click'); onPick(it.id); }}
                className={`relative grid min-h-tap min-w-[50px] flex-1 justify-items-center gap-1 rounded-sm
                            px-[2px] py-2 active:bg-wood-700 ${
                  cta ? '-mt-[18px] border-[3px] border-wood-800 bg-gold-500 pt-[10px] shadow-raised-gold active:translate-y-[3px] active:shadow-pressed' : ''
                }`}
              >
                {cta && unread > 0 && (
                  <span className="absolute -top-2 right-[2px] grid h-5 min-w-[20px] place-items-center rounded-full
                                   border-2 border-wood-800 bg-wax-500 px-1 text-[10px] font-bold text-parchment-100">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
                <img
                  src={`/assets/icons/${it.icon}.svg`}
                  alt=""
                  width={22}
                  height={22}
                  className={cta || on ? 'opacity-100' : 'opacity-[.85]'}
                />
                <span className={`text-center font-pixel text-[6px] leading-[10px] tracking-0 ${
                  cta ? 'text-wood-800' : on ? 'text-gold-400' : 'text-parchment-300'
                }`}>
                  {it.label}
                </span>
                {on && !cta && (
                  <span aria-hidden className="absolute inset-x-[22%] bottom-0 h-[3px] rounded-[2px] bg-gold-500" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
