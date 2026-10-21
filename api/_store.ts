import { createHash } from 'node:crypto';

/**
 * Query interface, so the handler can be exercised against an in-process
 * Postgres in tests without pulling in a real connection.
 */
export interface Db {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

export interface WishRow {
  id: string;
  name: string;
  message: string;
  attending: boolean;
  guests: number;
  sticker: string | null;
  gender: 'pria' | 'wanita';
  at: number;
}

/** Kept in step with STICKERS in src/services/wishes.ts. */
export const STICKERS = new Set([
  'sticker_heart', 'sticker_pray', 'sticker_ring', 'sticker_bouquet', 'sticker_party', 'sticker_sparkles',
  'animated-wish-1-e48f1a48.gif', 'animated-wish-2-4ba9113d.gif', 'animated-wish-3-53c4dc87.gif',
  'animated-wish-4-4a8d624d.gif', 'animated-wish-5-2c364bb3.gif', 'animated-wish-6-67b768c9.gif',
  'animated-wish-7-48cee2f1.gif', 'animated-wish-8-f86a127a.gif',
]);

export const MAX_NAME = 40;
export const MAX_MESSAGE = 200;
export const RATE_WINDOW_SEC = 120;
export const RATE_MAX = 3;

export interface ParsedWish {
  name: string;
  message: string;
  attending: boolean;
  guests: number;
  sticker: string | null;
  gender: 'pria' | 'wanita';
}

/**
 * Validates untrusted request bodies. The client validates too, but that is a
 * convenience for the guest — this is the boundary that actually has to hold.
 */
export function parseWish(body: unknown): { ok: true; wish: ParsedWish } | { ok: false; error: string } {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'Body tidak valid' };
  const b = body as Record<string, unknown>;

  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (!name) return { ok: false, error: 'Nama belum diisi' };
  if (name.length > MAX_NAME) return { ok: false, error: 'Nama terlalu panjang' };

  const message = typeof b.message === 'string' ? b.message.trim() : '';
  if (!message) return { ok: false, error: 'Ucapan belum diisi' };
  if (message.length > MAX_MESSAGE) return { ok: false, error: 'Ucapan terlalu panjang' };

  if (typeof b.attending !== 'boolean') return { ok: false, error: 'Konfirmasi kehadiran belum dipilih' };

  const guests = b.attending ? Number(b.guests) : 0;
  if (!Number.isInteger(guests) || guests < 0 || guests > 10) {
    return { ok: false, error: 'Jumlah tamu tidak valid' };
  }
  if (b.attending && guests < 1) return { ok: false, error: 'Jumlah tamu tidak valid' };

  const gender = b.gender === 'wanita' ? 'wanita' : 'pria';

  const sticker = typeof b.sticker === 'string' && STICKERS.has(b.sticker) ? b.sticker : null;

  return { ok: true, wish: { name, message, attending: b.attending, guests, sticker, gender } };
}

/**
 * A salted hash of the caller's address. Enough to rate-limit one sender;
 * not enough to identify a guest, and useless if the table ever leaks.
 */
export function senderHash(ip: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}

function toRow(r: Record<string, unknown>): WishRow {
  return {
    id: String(r.id),
    name: String(r.name),
    message: String(r.message),
    attending: Boolean(r.attending),
    guests: Number(r.guests),
    sticker: r.sticker === null || r.sticker === undefined ? null : String(r.sticker),
    gender: r.gender === 'wanita' ? 'wanita' : 'pria',
    at: new Date(r.created_at as string).getTime(),
  };
}

/** What anyone with the link may read. Party size is for the couple (rsvp_summary), not the other guests. */
export type PublicWish = Omit<WishRow, 'guests'>;

export async function listWishes(db: Db, limit = 200): Promise<PublicWish[]> {
  const { rows } = await db.query(
    `select id, name, message, attending, sticker, gender, created_at
       from wishes order by created_at desc limit $1`,
    [Math.min(Math.max(limit, 1), 500)],
  );
  return rows.map((r) => {
    const { guests: _, ...w } = toRow(r);
    return w;
  });
}

/** True when this sender has already posted RATE_MAX times in the window. */
export async function isRateLimited(db: Db, sender: string): Promise<boolean> {
  const { rows } = await db.query(
    `select count(*)::int as n from wishes
      where sender = $1 and created_at > now() - ($2 || ' seconds')::interval`,
    [sender, String(RATE_WINDOW_SEC)],
  );
  return Number(rows[0]?.n ?? 0) >= RATE_MAX;
}

export async function insertWish(db: Db, w: ParsedWish, sender: string): Promise<WishRow> {
  const { rows } = await db.query(
    `insert into wishes (name, message, attending, guests, sticker, gender, sender)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning id, name, message, attending, guests, sticker, gender, created_at`,
    [w.name, w.message, w.attending, w.guests, w.sticker, w.gender, sender],
  );
  return toRow(rows[0]);
}
