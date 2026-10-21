import type { Gender } from './types';

/**
 * Meeting the couple on the pelaminan, the way a guest does at a real
 * resepsi: walk up, greet each of them in turn — holding the greeting, as
 * long as a handshake lasts — say the doa, hear "aamiin" back. Pure, so the
 * pacing is tested headless (scripts/check-meet.mjs); the engine walks and
 * draws it.
 */
export type Who = 'groom' | 'bride';
export type Gesture = 'jabat' | 'salam';

/**
 * Pesantren etiquette, the default here: a handshake with someone of the same
 * sex, and with anyone else a salam — the hand to the chest, no touch. Set to
 * false for a wedding where everyone shakes hands.
 */
export const NO_TOUCH_ACROSS_SEXES = true;

/** By the body the guest picked for themselves — never guessed from their name. */
export function gestureFor(guest: Gender, who: Who): Gesture {
  if (!NO_TOUCH_ACROSS_SEXES) return 'jabat';
  return (guest === 'pria') === (who === 'groom') ? 'jabat' : 'salam';
}

export type Beat =
  | { kind: 'walk'; to: Who }
  | { kind: 'hold'; who: Who }
  | { kind: 'react'; who: Who }
  | { kind: 'doa' }
  | { kind: 'done' };

export const BEATS: Beat[] = [
  { kind: 'walk', to: 'groom' },
  { kind: 'hold', who: 'groom' },
  { kind: 'react', who: 'groom' },
  { kind: 'walk', to: 'bride' },
  { kind: 'hold', who: 'bride' },
  { kind: 'react', who: 'bride' },
  { kind: 'doa' },
  { kind: 'done' },
];

/** About as long as a handshake: long enough to mean it, short enough not to drag. */
export const HOLD_MS = 700;
const REACT_MS = 1300;
const DOA_MS = 2200;

export interface Meet { i: number; t: number; hold: number }

export const startMeet = (): Meet => ({ i: 0, t: 0, hold: 0 });
export const beatOf = (m: Meet): Beat => BEATS[m.i];

/**
 * One tick. `arrived`: the walk reached its spot. `holding`: the action button
 * is held down. Letting go drains the hold rather than resetting it outright,
 * so a thumb that slips for a moment is forgiven.
 */
export function stepMeet(m: Meet, dt: number, input: { holding: boolean; arrived: boolean }): Meet {
  const b = BEATS[m.i];
  const next = (): Meet => ({ i: Math.min(m.i + 1, BEATS.length - 1), t: 0, hold: 0 });
  switch (b.kind) {
    case 'walk':
      return input.arrived ? next() : m;
    case 'hold': {
      const hold = input.holding ? Math.min(1, m.hold + dt / HOLD_MS) : Math.max(0, m.hold - dt / (HOLD_MS * 2));
      return hold >= 1 ? next() : { ...m, hold };
    }
    case 'react':
    case 'doa': {
      const t = m.t + dt;
      return t >= (b.kind === 'react' ? REACT_MS : DOA_MS) ? next() : { ...m, t };
    }
    case 'done':
      return m;
  }
}
