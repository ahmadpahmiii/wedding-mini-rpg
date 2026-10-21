import type { Gender } from '../game/types';
import { loadSheet } from '../services/assets';

export type OutfitId = 'batik' | 'suit' | 'koko' | 'kebaya' | 'hijab' | 'floral';

/**
 * Six outfits, all free, none locked. `body` is which of the two base bodies
 * an outfit is drawn on: it is what the RSVP stores and what the guest's
 * walker wears, and it comes from the guest's own pick, never from their name.
 *
 * Batik and kebaya are the base spritesheet itself. The others each have
 * their own 8 x 2 sheet in the base layout, built by scripts/prep-art.swift,
 * loaded only once chosen. outfit_previews.png holds one front frame per
 * outfit, in this order, so the picker does not download every sheet.
 */
export const OUTFITS: { id: OutfitId; label: string; sub: string; body: Gender; sheet?: string }[] = [
  { id: 'batik', label: 'BATIK', sub: 'Batik & Peci', body: 'pria' },
  { id: 'suit', label: 'JAS', sub: 'Jas & Dasi', body: 'pria', sheet: '/assets/characters/outfit_suit.png' },
  { id: 'koko', label: 'KOKO', sub: 'Koko Modern', body: 'pria', sheet: '/assets/characters/outfit_koko.png' },
  { id: 'kebaya', label: 'KEBAYA', sub: 'Kebaya & Sanggul', body: 'wanita' },
  { id: 'hijab', label: 'GAMIS', sub: 'Hijab & Gamis', body: 'wanita', sheet: '/assets/characters/outfit_hijab.png' },
  { id: 'floral', label: 'BLUS', sub: 'Blus & Rok Plisket', body: 'wanita', sheet: '/assets/characters/outfit_floral.png' },
];

export const DEFAULT_OUTFIT: OutfitId = 'batik';
export const OUTFIT_PREVIEWS = '/assets/characters/outfit_previews.png';

export const outfitOf = (id: OutfitId) => OUTFITS.find((o) => o.id === id) ?? OUTFITS[0];
export const isOutfit = (v: unknown): v is OutfitId => OUTFITS.some((o) => o.id === v);

/** Where a body's frames start on the base sheet: rows 0-1 for pria, 2-3 for wanita. */
export const baseRow = (body: Gender): number => (body === 'pria' ? 0 : 2);

/** What a guest looks like: a sheet, and the row their two rows of frames start on. */
export interface Look { sheet: CanvasImageSource; base: number }

/**
 * The base body straight away, so nothing ever waits on a download; `onSheet`
 * gets the outfit's own sheet if and when it arrives. If it never does, the
 * guest simply keeps the base body.
 */
export function outfitLook(id: OutfitId, baseSheet: CanvasImageSource, onSheet: (look: Look) => void): Look {
  const o = outfitOf(id);
  if (o.sheet) void loadSheet(o.sheet).then((sheet) => { if (sheet) onSheet({ sheet, base: 0 }); });
  return { sheet: baseSheet, base: baseRow(o.body) };
}
