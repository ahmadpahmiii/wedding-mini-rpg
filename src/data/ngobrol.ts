/**
 * "Seberapa Kenal Kamu Sama Kami?" — the questions and replies live in the
 * `ngobrol` block of wedding.json.
 *
 * It is a conversation, not a quiz: whoever the guest points at answers back.
 * So option order carries meaning — always the bride, then the groom, then
 * both — and `by` is only set where the reply comes from someone other than the pick.
 */
import { wedding, type Speaker, type Verdict } from './weddingInfo';

export type { Speaker, Verdict };

export const ngobrol = wedding.ngobrol;

const BY_ORDER: readonly Speaker[] = ['bride', 'groom', 'both'];

export function speakerOf(q: number, pick: number): Speaker {
  return ngobrol.questions[q].options[pick].by ?? BY_ORDER[pick];
}

/** Picks per side: [bride, groom, both]. */
export function tally(picks: readonly number[]): [number, number, number] {
  return [0, 1, 2].map((k) => picks.filter((p) => p === k).length) as [number, number, number];
}

/**
 * The tug-of-war marker, 0 (all bride) to 100 (all groom). "Both" counts in
 * the denominator only, so it pulls the heart back toward the middle.
 */
export function tug(picks: readonly number[]): number {
  const [bride, groom] = tally(picks);
  return 50 + (50 * (groom - bride)) / Math.max(1, picks.length);
}

/** No score — a title, decided by which way the guest leaned. */
export function verdict(picks: readonly number[]): Verdict {
  const [bride, groom, both] = tally(picks);
  const v = ngobrol.verdicts;
  if (both >= bride && both >= groom) return v.both;
  if (bride === groom) return v.tie;
  return bride > groom ? v.bride : v.groom;
}
