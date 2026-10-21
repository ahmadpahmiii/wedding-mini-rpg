import type { GiftItem } from '../game/types';

/** The order matches the 128px cells of public/assets/gift/items.png. The emoji stands in if it fails to load. */
export const GIFTS: { id: GiftItem; name: string; emoji: string }[] = [
  { id: 'amplop', name: 'Amplop', emoji: '✉️' },
  { id: 'kado', name: 'Kado', emoji: '🎁' },
  { id: 'buket', name: 'Buket bunga', emoji: '💐' },
];

export const GIFT_SHEET = '/assets/gift/items.png';
export const GIFT_CELL = 128;

export const giftIndex = (id: GiftItem): number => GIFTS.findIndex((g) => g.id === id);
export const giftName = (id: GiftItem): string => GIFTS[giftIndex(id)].name;
