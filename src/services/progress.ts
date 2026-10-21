import type { GiftItem } from '../game/types';
import { GIFTS } from '../data/gifts';
import { isOutfit, type OutfitId } from '../data/outfits';

/**
 * The guest's own progress: which quests are done, and the gift in hand.
 *
 * Personal only. It lives in this browser and is never sent anywhere, and no
 * flag here has anything to do with payment. Storage can be blocked, full or
 * hand-edited, so whatever comes back is checked field by field; anything
 * unrecognised starts fresh rather than breaking the garden. With no storage
 * at all the game simply forgets on reload.
 */
export type Flag = 'welcome' | 'greeted' | 'foodie' | 'photo' | 'gift' | 'allstar';
const FLAGS: readonly Flag[] = ['welcome', 'greeted', 'foodie', 'photo', 'gift', 'allstar'];

/**
 * What it takes to be a Wedding All-Star. The gift is not on it: the final
 * celebration never waits on giving, virtual or real.
 */
export const CORE: readonly Flag[] = ['welcome', 'greeted', 'foodie', 'photo'];
export const allCore = (p: Progress): boolean => CORE.every((f) => p.done.includes(f));

export interface Progress {
  done: Flag[];
  held: GiftItem | null;
  /** Best Recipe Rush round, out of 300. */
  buffetBest: number;
  /** The last outfit picked, offered again on the next visit. */
  outfit: OutfitId | null;
}

const KEY = 'wq.progress.v1';
export const FRESH: Progress = { done: [], held: null, buffetBest: 0, outfit: null };

export function sanitize(raw: unknown): Progress {
  if (typeof raw !== 'object' || raw === null) return FRESH;
  const { done, held, buffetBest, outfit } = raw as Record<string, unknown>;
  return {
    done: Array.isArray(done) ? FLAGS.filter((f) => done.includes(f)) : [],
    held: GIFTS.some((g) => g.id === held) ? (held as GiftItem) : null,
    buffetBest: Number.isInteger(buffetBest) && (buffetBest as number) >= 0 && (buffetBest as number) <= 300
      ? (buffetBest as number) : 0,
    outfit: isOutfit(outfit) ? outfit : null,
  };
}

export function loadProgress(): Progress {
  try {
    return sanitize(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
  } catch {
    return FRESH; // blocked storage, or a value that is not JSON
  }
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, ...p }));
  } catch {
    /* private mode: this visit still remembers */
  }
}

export const has = (p: Progress, f: Flag): boolean => p.done.includes(f);

/** Null when the flag is already set: completing twice must never celebrate twice. */
export function award(p: Progress, f: Flag): Progress | null {
  return has(p, f) ? null : { ...p, done: [...p.done, f] };
}

/** Milestones are the flags worth a celebration. Giving is not one of them. */
export const MILESTONES: Partial<Record<Flag, { name: string; text: string }>> = {
  welcome: { name: 'Welcome Guest', text: 'kamu sudah tiba di taman!' },
  greeted: { name: 'First Greeting', text: 'kamu sudah salaman dengan mempelai!' },
  foodie: { name: 'Foodie Moment', text: 'menu racikanmu pas banget!' },
  photo: { name: 'Picture Perfect', text: 'fotomu sudah tersimpan!' },
  allstar: { name: 'Wedding All-Star', text: 'semua misi selesai!' },
};

/** The quest log, in the order a guest would naturally do them. `place` is a landmark id. */
export const QUESTS: { flag: Flag; title: string; hint: string; place?: string; optional?: boolean }[] = [
  { flag: 'welcome', title: 'Tiba di taman', hint: 'Selamat datang di pernikahan kami!' },
  { flag: 'greeted', title: 'Salaman dengan mempelai', hint: 'Naik ke pelaminan, lalu tahan A untuk bersalaman.', place: 'pelaminan' },
  {
    flag: 'foodie', title: 'Racik menu di prasmanan', place: 'prasmanan',
    hint: 'Sajikan satu pesanan dengan bahan yang pas.',
  },
  {
    flag: 'photo', title: 'Berfoto di photobox', place: 'kios-photobox',
    hint: 'Buat foto karaktermu atau foto kamu, lalu simpan.',
  },
  {
    flag: 'gift', title: 'Antar hadiah ke pelaminan', optional: true, place: 'meja-hadiah',
    hint: 'Ambil hadiah di meja hadiah, lalu bawa ke pelaminan.',
  },
];
