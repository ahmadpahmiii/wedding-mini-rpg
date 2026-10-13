import type { Wish } from '../game/types';
import { SEED_WISHES } from '../data/seedWishes';

const KEY = 'wq.wishes.v1';
const API = '/api/wishes';
/** Ids of wishes that never reached the server start with this. */
const PENDING_ID = 'me-';

/** What the guest is told when their wish is queued on the device. */
export const PENDING_NOTE = 'Koneksi terputus. Ucapanmu disimpan dan dikirim ulang otomatis saat undangan dibuka lagi.';

/**
 * Wishes live in Postgres behind /api/wishes. Shared by the game and /undangan.
 *
 * localStorage is the safety net, not the store. It holds this browser's own
 * wishes: the ones the server accepted (so they stay highlighted as "mine"),
 * and the ones a dropped connection never delivered — those are re-sent on
 * the next load, so the couple still receives them. A wish the server refused
 * (too long, too fast) is never kept: the guest still has their words in the
 * form, and storing it would show it as sent when it was not.
 *
 * The seed list only ever appears when the API cannot be reached at all. A
 * wedding invitation should never show an empty, broken page because a
 * database had a bad minute.
 */
function readLocal(): Wish[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Wish[]) : [];
  } catch {
    return []; // private mode, blocked storage, corrupt value — all the same to us
  }
}

function writeLocal(wishes: Wish[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(wishes.slice(0, 50)));
  } catch {
    /* nothing to do — the wish still shows this session */
  }
}

export const isPending = (w: Wish): boolean => w.id.startsWith(PENDING_ID);
const sameWords = (a: Wish, b: Wish): boolean => a.name === b.name && a.message === b.message;
const newestFirst = (a: Wish, b: Wish): number => b.at - a.at;
/** A hung request must not leave the guest staring at "Mengirim…" forever. */
const within = (ms: number): AbortSignal | undefined =>
  typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(ms) : undefined;

type Draft = Omit<Wish, 'id' | 'at' | 'mine'>;
/** `later`: refused only for now (rate limit), so a queued copy is kept for the next try. */
type Sent = { status: 'saved'; wish: Wish } | { status: 'refused'; error: string; later: boolean } | { status: 'offline' };

async function post(w: Draft): Promise<Sent> {
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(w),
      signal: within(10_000),
    });
    const data = (await res.json().catch(() => ({}))) as { wish?: Wish; error?: string };
    if (res.ok && data.wish) return { status: 'saved', wish: { ...data.wish, mine: true } };
    if (res.status >= 400 && res.status < 500) {
      // 429 means "not right now", not "never".
      return { status: 'refused', error: data.error ?? 'Ucapan tidak bisa dikirim', later: res.status === 429 };
    }
    return { status: 'offline' };
  } catch {
    return { status: 'offline' };
  }
}

const draftOf = ({ name, message, attending, guests, sticker, gender }: Wish): Draft =>
  ({ name, message, attending, guests, sticker, gender });

let offlineSeededAt = 0;
function offlineFallback(): Wish[] {
  if (!offlineSeededAt) offlineSeededAt = Date.now();
  const seeds = SEED_WISHES.map((w) => ({ ...w, at: offlineSeededAt + w.at }));
  return [...readLocal(), ...seeds].sort(newestFirst);
}

export interface LoadResult {
  wishes: Wish[];
  /** False when these came from the seed list because the server was unreachable. */
  live: boolean;
}

export async function load(): Promise<LoadResult> {
  let server: Wish[];
  try {
    const res = await fetch(API, { headers: { accept: 'application/json' }, signal: within(8_000) });
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as { wishes?: Wish[] };
    if (!Array.isArray(data.wishes)) throw new Error('bad payload');
    server = data.wishes;
  } catch {
    return { wishes: offlineFallback(), live: false };
  }

  // The server is reachable again: deliver whatever an earlier dropped
  // connection left queued. One that already arrived is just forgotten.
  const local = readLocal();
  const queued = local.filter((m) => isPending(m) && !server.some((s) => sameWords(s, m)));
  const retried = await Promise.all(queued.map(async (m) => ({ m, r: await post(draftOf(m)) })));
  const delivered = retried.flatMap(({ r }) => (r.status === 'saved' ? [r.wish] : []));
  const still = retried.flatMap(({ m, r }) => (r.status === 'offline' || (r.status === 'refused' && r.later) ? [m] : []));
  const mine = [...delivered, ...still, ...local.filter((m) => !isPending(m))].sort(newestFirst);
  writeLocal(mine);

  // Mark the guest's own wishes, and merge in any the server has not caught
  // up with yet (its list is cached for a few seconds), so they always see their words.
  const ids = new Set(mine.map((m) => m.id));
  const listed = server.map((s) => (ids.has(s.id) ? { ...s, mine: true } : s));
  const missing = mine.filter((m) => !server.some((s) => s.id === m.id));
  return { wishes: [...missing, ...listed].sort(newestFirst), live: true };
}

/**
 * `wish` is null when the server refused it — show `error`, keep the form.
 * When the connection dropped, the wish is queued locally (`saved: false`, no error).
 */
export async function add(w: Draft): Promise<{ wish: Wish | null; saved: boolean; error?: string }> {
  const r = await post(w);
  if (r.status === 'refused') return { wish: null, saved: false, error: r.error };

  const wish: Wish = r.status === 'saved' ? r.wish : { ...w, id: `${PENDING_ID}${Date.now()}`, at: Date.now(), mine: true };
  // Sending the same words twice (a retry after a failure) must not queue a duplicate.
  writeLocal([wish, ...readLocal().filter((m) => !(isPending(m) && sameWords(m, wish)))]);
  return { wish, saved: r.status === 'saved' };
}

export function relativeTime(at: number): string {
  const mins = Math.floor((Date.now() - at) / 60000);
  if (mins < 1) return 'baru saja';
  if (mins < 60) return `${mins} menit lalu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} jam lalu`;
  return new Date(at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Resolves a sticker id to its URL; SVG and GIF live in different folders. */
export function stickerUrl(id: string): string {
  return id.endsWith('.gif') ? `/assets/stickers/${id}` : `/assets/stickers/${id}.svg`;
}

/** Kept in step with STICKERS in api/_store.ts — the server rejects anything else. */
export const STICKERS = [
  'sticker_heart', 'sticker_pray', 'sticker_ring', 'sticker_bouquet', 'sticker_party', 'sticker_sparkles',
  'animated-wish-1-e48f1a48.gif', 'animated-wish-2-4ba9113d.gif', 'animated-wish-3-53c4dc87.gif',
  'animated-wish-4-4a8d624d.gif', 'animated-wish-5-2c364bb3.gif', 'animated-wish-6-67b768c9.gif',
  'animated-wish-7-48cee2f1.gif', 'animated-wish-8-f86a127a.gif',
];
