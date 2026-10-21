/**
 * Recipe Rush: the buffet minigame, as pure data and pure functions. The modal
 * only draws a Round and feeds it actions, so every rule — scoring, timeouts,
 * double taps — is testable without a browser (scripts/check-buffet.mjs).
 *
 * The menu is game data, not the real catering list. Edit RECIPES to match
 * your own menu, using only INGREDIENTS: each one needs an icon in
 * public/assets/buffet/items.png, a 4 x 4 sheet whose cells are numbered
 * left to right, top to bottom.
 */
export type IngredientId =
  | 'bakso' | 'sayur' | 'kuah' | 'bihun' | 'mi'
  | 'sate' | 'kecap' | 'saus' | 'nasi' | 'bawang' | 'acar';

export const INGREDIENTS: { id: IngredientId; name: string; cell: number }[] = [
  { id: 'bakso', name: 'Bakso', cell: 0 },
  { id: 'sayur', name: 'Sayur', cell: 1 },
  { id: 'kuah', name: 'Kuah', cell: 2 },
  { id: 'bihun', name: 'Bihun', cell: 3 },
  { id: 'mi', name: 'Mi', cell: 4 },
  { id: 'sate', name: 'Sate', cell: 5 },
  { id: 'kecap', name: 'Kecap', cell: 6 },
  { id: 'saus', name: 'Saus kacang', cell: 7 },
  { id: 'nasi', name: 'Nasi', cell: 8 },
  { id: 'bawang', name: 'Bawang', cell: 9 },
  { id: 'acar', name: 'Acar', cell: 10 },
];
export const ICED_TEA_CELL = 15;
export const BUFFET_SHEET = '/assets/buffet/items.png';

/** Each slot is satisfied by any one of its ingredients: kecap OR saus kacang. */
type Slot = IngredientId[];
export interface Recipe { name: string; dish: number; vessel: number; required: Slot[]; optional: Slot[] }

export type RecipeId = 'bakso' | 'sate';
export const RECIPES: Record<RecipeId, Recipe> = {
  bakso: { name: 'Bakso Komplit', dish: 13, vessel: 11, required: [['bakso'], ['sayur'], ['kuah']], optional: [['bihun', 'mi']] },
  sate: { name: 'Sate Kecap + Nasi', dish: 14, vessel: 12, required: [['sate'], ['kecap', 'saus'], ['nasi']], optional: [['bawang'], ['acar']] },
};

export const ROUND_MS = 45_000;
export const MAX_ORDERS = 3;
/** The speed bonus runs down to nothing over this long, per order. */
export const SPEED_MS = 15_000;

export type Verdict = 'sempurna' | 'pas' | 'campur' | 'kurang';
export const VERDICTS: Record<Verdict, string> = {
  sempurna: 'Sempurna!',
  pas: 'Pas!',
  campur: 'Kecampur bahan lain',
  kurang: 'Belum lengkap',
};
/** A correct dish: every required part, nothing that does not belong. */
export const isCorrect = (v: Verdict): boolean => v === 'sempurna' || v === 'pas';

export interface Points { recipe: number; bonus: number; speed: number; total: number }

/**
 * Out of 100: up to 60 for the required parts, less 10 per wrong ingredient;
 * the bonus (20) and speed (20) only count once the dish is complete, or a
 * fast empty bowl would outscore a slow correct one.
 */
export function score(r: Recipe, picked: IngredientId[], elapsedMs: number): { points: Points; verdict: Verdict } {
  const has = (slot: Slot) => slot.some((i) => picked.includes(i));
  const belongs = new Set([...r.required.flat(), ...r.optional.flat()]);
  const filled = r.required.filter(has).length;
  const wrong = picked.filter((i) => !belongs.has(i)).length;
  const complete = filled === r.required.length;

  const recipe = Math.max(0, Math.round((60 * filled) / r.required.length) - 10 * wrong);
  const bonus = complete ? Math.round((20 * r.optional.filter(has).length) / r.optional.length) : 0;
  const speed = complete ? Math.round(20 * Math.max(0, 1 - elapsedMs / SPEED_MS)) : 0;
  const verdict: Verdict = !complete ? 'kurang' : wrong ? 'campur' : bonus === 20 ? 'sempurna' : 'pas';
  return { points: { recipe, bonus, speed, total: recipe + bonus + speed }, verdict };
}

export interface Served { recipe: RecipeId; picked: IngredientId[]; points: Points; verdict: Verdict }
export interface Order { recipe: RecipeId; picked: IngredientId[]; startedAt: number }

export interface Round {
  phase: 'play' | 'over';
  endsAt: number;
  /** The clock as of the last action, for drawing the timer. */
  now: number;
  served: Served[];
  order: Order | null;
}

export type Action =
  | { type: 'toggle'; id: IngredientId }
  | { type: 'serve'; now: number }
  | { type: 'tick'; now: number };

export function startRound(now: number, first: RecipeId): Round {
  return { phase: 'play', endsAt: now + ROUND_MS, now, served: [], order: { recipe: first, picked: [], startedAt: now } };
}

export const roundTotal = (r: Round): number => r.served.reduce((s, o) => s + o.points.total, 0);

/** Scores the order on the plate and moves on: the next order, or the end. */
function serve(r: Round, now: number, last: boolean): Round {
  const o = r.order!;
  const result = score(RECIPES[o.recipe], o.picked, now - o.startedAt);
  const served = [...r.served, { recipe: o.recipe, picked: o.picked, ...result }];
  if (last || served.length >= MAX_ORDERS) return { ...r, now, served, order: null, phase: 'over' };
  const next: RecipeId = o.recipe === 'bakso' ? 'sate' : 'bakso';
  return { ...r, now, served, order: { recipe: next, picked: [], startedAt: now } };
}

/**
 * Returns the same object when an action changes nothing: a second tap on
 * SAJIKAN reaches a fresh, empty plate and is ignored, so no order is ever
 * scored twice. Ingredients toggle, so a plate never holds one twice.
 */
export function step(r: Round, a: Action): Round {
  if (r.phase !== 'play' || !r.order) return r;
  switch (a.type) {
    case 'toggle': {
      const { picked } = r.order;
      const next = picked.includes(a.id) ? picked.filter((i) => i !== a.id) : [...picked, a.id];
      return { ...r, order: { ...r.order, picked: next } };
    }
    case 'serve':
      return r.order.picked.length ? serve(r, a.now, a.now >= r.endsAt) : r;
    case 'tick':
      if (a.now < r.endsAt) return { ...r, now: a.now };
      // Time is up: whatever is on the plate is served, once; an empty plate is not an order.
      return r.order.picked.length ? serve(r, a.now, true) : { ...r, now: a.now, order: null, phase: 'over' };
  }
}
