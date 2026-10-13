/**
 * The photobox frames, and the window inside each where the guest's photo goes.
 *
 * Every frame paints its window opaque — white in two of them, the page
 * background in the third — so the photo is drawn ON TOP of the frame, not
 * under it. Drawn under, the result was an empty white box.
 *
 * These coordinates are read off the SVGs, in their own 600x800 units, and
 * `npm run check` re-reads the SVGs to make sure they still agree.
 */
export interface PhotoFrame {
  id: string;
  name: string;
  win: { x: number; y: number; w: number; h: number };
}

export const FRAME_W = 600;
export const FRAME_H = 800;

export const PHOTO_FRAMES: PhotoFrame[] = [
  { id: 'frame_batik_gold', name: 'BATIK GOLD', win: { x: 60, y: 95, w: 480, h: 520 } },
  { id: 'frame_botanical', name: 'BOTANICAL', win: { x: 60, y: 90, w: 480, h: 560 } },
  { id: 'frame_retro_rpg', name: 'RETRO RPG', win: { x: 70, y: 115, w: 460, h: 490 } },
];
