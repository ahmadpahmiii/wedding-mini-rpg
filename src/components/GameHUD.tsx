import { useRef, useState } from 'react';
import type { Landmark } from '../game/types';

interface Props {
  musicOn: boolean;
  needsAudioTap: boolean;
  inRange: Landmark | null;
  /** The player is standing where the prompt sits — show it at the top instead. */
  promptHigh: boolean;
  onToggleMusic: () => void;
  onEnableAudio: () => void;
  onAction: () => void;
  onStick: (x: number, y: number) => void;
}

const DEAD = 0.12;
const MAX_R = 48;

export default function GameHUD({
  musicOn, needsAudioTap, inRange, promptHigh, onToggleMusic, onEnableAudio, onAction, onStick,
}: Props) {
  const pad = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const touchId = useRef<number | null>(null);

  const move = (cx: number, cy: number) => {
    const r = pad.current?.getBoundingClientRect();
    if (!r) return;
    let dx = cx - (r.left + r.width / 2);
    let dy = cy - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > MAX_R) { dx = (dx / d) * MAX_R; dy = (dy / d) * MAX_R; }
    setKnob({ x: dx, y: dy });
    const mag = Math.min(1, d / MAX_R);
    if (mag < DEAD) onStick(0, 0);
    else onStick((dx / MAX_R), (dy / MAX_R));
  };

  const release = () => { touchId.current = null; setKnob({ x: 0, y: 0 }); onStick(0, 0); };

  return (
    <>
      {/* Top bar — music lives away from the thumb because it is rarely pressed. */}
      <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center px-3">
        <div className="pointer-events-auto flex overflow-hidden rounded-sm border-[3px] border-gold-500 bg-wood-800 shadow-raised">
          <button
            type="button"
            onClick={onToggleMusic}
            aria-pressed={musicOn}
            className="min-h-tap px-4 py-2 text-left active:bg-wood-700"
          >
            <span className="mb-[3px] block font-pixel text-[8px] tracking-[1px] text-gold-400">♪ MUSIK</span>
            <span className={`block font-pixel text-[10px] ${musicOn ? 'text-ink-onwood' : 'text-wood-400'}`}>
              {musicOn ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>
      </div>

      {/* Open prompt. Anchored low rather than over the player — the canvas
          already marks the player, and a control down here is in reach of the
          thumb holding the phone. It clears the joystick and action-button row
          so a long label like "UCAPAN & RSVP" cannot collide with SENTUH. */}
      {inRange && (
        <div className={`pointer-events-none absolute inset-x-0 z-20 flex justify-center px-4 ${
          promptHigh ? 'top-[76px]' : 'bottom-[226px]'}`}>
          <button
            type="button"
            onClick={onAction}
            className="pointer-events-auto flex min-h-tap items-center gap-2 rounded-sm border-[3px]
                       border-gold-500 bg-wood-800 px-5 py-3 font-pixel text-[9px] leading-4
                       text-ink-onwood shadow-raised-gold active:translate-y-[3px] active:shadow-pressed"
            style={{ animation: 'wq-bob 1.6s ease-in-out infinite' }}
          >
            💬 BUKA {inRange.label} <span className="hidden sm:inline">(E)</span>
          </button>
        </div>
      )}

      {/* Joystick. It is placed where the thumb lands, not at a fixed spot. */}
      <div
        ref={pad}
        className="absolute bottom-[104px] left-4 z-20 h-[112px] w-[112px] touch-none select-none opacity-75 transition-opacity active:opacity-100"
        onPointerDown={(e) => { touchId.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); move(e.clientX, e.clientY); }}
        onPointerMove={(e) => { if (touchId.current === e.pointerId) move(e.clientX, e.clientY); }}
        // Only the finger that grabbed the stick lets go of it — a second finger
        // lifting (tapping A while walking) used to stop the player dead.
        onPointerUp={(e) => { if (touchId.current === e.pointerId) release(); }}
        onPointerCancel={(e) => { if (touchId.current === e.pointerId) release(); }}
        role="application"
        aria-label="Joystick untuk berjalan"
      >
        <img src="/assets/ui/joystick_pad.svg" alt="" className="pointer-events-none h-full w-full" />
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-11 w-11 -translate-x-1/2 -translate-y-1/2
                     rounded-full border-[3px] border-gold-500 bg-wood-600"
          style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
        />
        <span className="pointer-events-none absolute inset-x-0 -top-6 text-center font-pixel
                         text-[8px] tracking-[1px] text-ink-onwood [text-shadow:0_2px_0_#1b110d]">GERAK</span>
      </div>

      {/* Action button — the proximity state readout. */}
      <div className="absolute bottom-[104px] right-4 z-20 grid justify-items-center gap-2">
        <button
          type="button"
          onClick={onAction}
          disabled={!inRange}
          aria-label={inRange ? `Buka ${inRange.label}` : 'Tidak ada yang bisa dibuka di sini'}
          className={`grid h-[84px] w-[84px] place-items-center rounded-full border-[3px] font-pixel text-xl
                      active:translate-y-[3px] active:shadow-pressed ${
            inRange
              ? 'border-gold-500 bg-wood-800 text-gold-400 shadow-raised-gold'
              : 'border-wood-600 bg-wood-800 text-ink-onwood opacity-75 shadow-raised'
          }`}
        >
          A
        </button>
        <span className="font-pixel text-[8px] tracking-[1px] text-ink-onwood [text-shadow:0_2px_0_#1b110d]">
          {inRange ? 'SENTUH' : '—'}
        </span>
      </div>

      {needsAudioTap && (
        <button
          type="button"
          onClick={onEnableAudio}
          className="absolute bottom-[272px] right-4 z-20 flex min-h-tap items-center gap-2 rounded-full
                     border-[3px] border-wood-800 bg-gold-500 px-4 py-2 font-pixel text-[9px]
                     text-wood-800 shadow-raised"
        >
          🔊 NYALAKAN MUSIK
        </button>
      )}
    </>
  );
}
