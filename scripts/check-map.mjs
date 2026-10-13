/**
 * Map geometry self-check. Run: npm run check
 *
 * Every one of these caught a real bug during the build:
 *  - landmark centres sat inside their own collision boxes, so half the
 *    destinations were impossible to reach on foot
 *  - the documented spawn point was the middle of the fountain
 *  - a stand point drifted inside the photobox kiosk
 */
import './_register-ts.mjs';
import assert from 'node:assert/strict';
import { LANDMARKS, SPAWN, blocked, nearest, WORLD_W, WORLD_H } from '../src/game/landmarks.ts';

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };

ok(!blocked(SPAWN.x, SPAWN.y), 'spawn point must be walkable');
ok(SPAWN.x > 0 && SPAWN.x < WORLD_W && SPAWN.y > 0 && SPAWN.y < WORLD_H, 'spawn inside the map');

for (const lm of LANDMARKS) {
  ok(!blocked(lm.sx, lm.sy), `${lm.id}: stand point is inside a collision box`);
  ok(lm.sx > 16 && lm.sx < WORLD_W - 16, `${lm.id}: stand point off the map horizontally`);
  ok(lm.sy > 120 && lm.sy < WORLD_H - 26, `${lm.id}: stand point outside the walkable band`);

  // Standing on the spot must actually trigger that landmark, not a neighbour.
  const hit = nearest(lm.sx, lm.sy);
  ok(hit?.lm.id === lm.id, `${lm.id}: standing on its own spot resolves to ${hit?.lm.id ?? 'nothing'}`);

  // Signs are drawn on the canvas at 8px Press Start 2P, which has a 1em
  // advance, plus a "+ " prefix and 16px of padding. Assert the rendered
  // width rather than a character count: the real constraint is fitting the
  // narrowest phone (320px CSS), not an arbitrary cap.
  const signWidth = (lm.label.length + 2) * 8 + 16;
  ok(signWidth <= 180, `${lm.id}: sign "+ ${lm.label}" renders ${signWidth}px — too wide for a 320px phone`);
}

// Two landmarks must never claim the same ground.
for (const a of LANDMARKS) {
  for (const b of LANDMARKS) {
    if (a.id >= b.id) continue;
    const d = Math.hypot(a.sx - b.sx, a.sy - b.sy);
    ok(d > 90, `${a.id} and ${b.id} stand points are ${Math.round(d)}px apart — they overlap`);
  }
}

const targets = new Set(LANDMARKS.map((l) => l.target));
ok(targets.size === 5, 'five destinations — Galeri, Cerita, Sapa Tamu and Hadiah were removed by decision');
ok(LANDMARKS.length === 6, 'six landmarks — Ngobrol opens from both the gazebo and the old gift table');
// Keys 1-5 open LANDMARKS[0..4], so those five must cover every destination once.
ok(new Set(LANDMARKS.slice(0, 5).map((l) => l.target)).size === 5, 'keys 1-5 reach all five destinations');
ok(LANDMARKS.find((l) => l.target === 'ngobrol')?.id === 'gazebo', 'the nav walks to the gazebo, not the chests');

// The guest roster is fixed at three men and two women.
const { NPC_MALE, NPC_FEMALE, chooseGuests } = await import('../src/game/roster.ts');
ok(NPC_MALE === 3 && NPC_FEMALE === 2, 'roster is three men and two women');

const pool = Array.from({ length: 40 }, (_, i) => ({
  id: `w${i}`, name: `G${i}`, message: 'x', attending: i % 7 !== 3,
  guests: 1, sticker: null, gender: i % 2 === 0 ? 'pria' : 'wanita', at: Date.now() - i,
}));
const cast = chooseGuests(pool);
ok(cast.length === 5, `five guests walk the garden, got ${cast.length}`);
ok(cast.filter((n) => n.gender === 'pria').length === 3, 'three of them are men');
ok(cast.filter((n) => n.gender === 'wanita').length === 2, 'two of them are women');
ok(cast.every((w) => w.attending), 'only guests who said they are coming walk the garden');

// Fewer wishes than seats must not throw or over-fill.
ok(chooseGuests(pool.slice(0, 2)).length <= 2, 'a short guest list yields fewer walkers, not a crash');
ok(chooseGuests([]).length === 0, 'an empty guest list yields an empty garden');

// --- guests must never spawn inside scenery, and must never animate in place
const { freeSpot, spawnNpcs } = await import('../src/game/Npc.ts');

ok(!blocked(freeSpot(179, 1093).x, freeSpot(179, 1093).y), 'freeSpot pushes a point out of the gift table');
ok(!blocked(freeSpot(384, 650).x, freeSpot(384, 650).y), 'freeSpot pushes a point out of the fountain');
const keep = freeSpot(384, 1180);
ok(keep.x === 384 && keep.y === 1180, 'freeSpot leaves an already-walkable point alone');

const walkers = spawnNpcs(pool);
ok(walkers.length === 5, 'five walkers spawn');
walkers.forEach((n, i) => ok(!blocked(n.x, n.y), `walker ${i} spawns on walkable ground`));

// Wedge one against scenery and run it: a guest who cannot move must not play
// the walk cycle. This is the bug that made a stationary guest look glitched.
const stuck = walkers[0];
stuck.x = 262; stuck.y = 470;          // hard against the gamelan gazebo
for (let i = 0; i < 400; i++) stuck.update(16);
const before = { x: stuck.x, y: stuck.y };
let animatedWhileStill = 0;
for (let i = 0; i < 600; i++) {
  const x0 = stuck.x, y0 = stuck.y;
  stuck.update(16);
  const moved = Math.hypot(stuck.x - x0, stuck.y - y0);
  if (moved < 0.01 && stuck.moving) animatedWhileStill++;
}
ok(animatedWhileStill === 0, `a stationary guest never reports moving (saw ${animatedWhileStill} frames)`);
ok(!blocked(stuck.x, stuck.y), 'a wedged guest never ends up inside scenery');
void before;

// Submitting an RSVP must not push the garden over the five-guest cap.
const { admit, NPC_CAP } = await import('../src/game/roster.ts');
ok(NPC_CAP === 5, 'the cap is five');
{
  const garden = spawnNpcs(pool);
  ok(garden.length === NPC_CAP, 'the garden starts at the cap');
  ok(admit(garden, 'newcomer').length === NPC_CAP, 'a new guest keeps it at the cap');
  ok(garden.at(-1) === 'newcomer', 'the new guest is the one who stayed');
  ok(admit(admit(garden, 'a'), 'b').length === NPC_CAP, 'repeated arrivals keep it at the cap');
  ok(admit([], 'first').length === 1, 'an empty garden accepts the first guest');
}

// A focused form field must own the keyboard. The world's key handler calls
// preventDefault on w/a/s/d, so without this every one of those letters was
// swallowed before it reached the RSVP name and message fields.
const { ownsKeyboard } = await import('../src/game/input.ts');
const el = (tagName, extra = {}) => ({ tagName, ...extra });
ok(ownsKeyboard(el('INPUT')), 'an input owns the keyboard');
ok(ownsKeyboard(el('TEXTAREA')), 'a textarea owns the keyboard');
ok(ownsKeyboard(el('SELECT')), 'a select owns the keyboard');
ok(ownsKeyboard(el('input')), 'tag name casing does not matter');
ok(ownsKeyboard(el('DIV', { isContentEditable: true })), 'a contenteditable owns the keyboard');
ok(!ownsKeyboard(el('DIV')), 'a plain div does not');
ok(!ownsKeyboard(el('BUTTON')), 'a button does not — 1-5 must still open destinations');
ok(!ownsKeyboard(el('CANVAS')), 'the map does not');
ok(!ownsKeyboard(null), 'a null target does not throw');
ok(!ownsKeyboard({}), 'a target with no tagName does not throw');

// The photobox window coordinates must still match the frame SVGs. Every frame
// paints its window opaque, so if these drift the photo lands in the wrong
// place — or, as shipped once, behind the frame entirely.
{
  const { readFileSync } = await import('node:fs');
  const { PHOTO_FRAMES, FRAME_W, FRAME_H } = await import('../src/data/photoFrames.ts');
  ok(PHOTO_FRAMES.length === 3, 'three photobox frames');
  for (const f of PHOTO_FRAMES) {
    const svg = readFileSync(`public/assets/frames/${f.id}.svg`, 'utf8');
    ok(svg.includes(`viewBox="0 0 ${FRAME_W} ${FRAME_H}"`), `${f.id}: still ${FRAME_W}x${FRAME_H}`);
    // The window must correspond to a real rect in the art.
    const rects = [...svg.matchAll(/<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"/g)]
      .map((m) => ({ x: +m[1], y: +m[2], w: +m[3], h: +m[4] }));
    const hit = rects.some((r) => r.x === f.win.x && r.y === f.win.y && r.w === f.win.w && r.h === f.win.h);
    ok(hit, `${f.id}: window ${f.win.x},${f.win.y} ${f.win.w}x${f.win.h} matches a rect in the SVG`);
    ok(f.win.x > 0 && f.win.y > 0 && f.win.x + f.win.w <= FRAME_W && f.win.y + f.win.h <= FRAME_H,
      `${f.id}: window sits inside the frame`);
  }
}

// Ngobrol: whoever the guest points at answers back, so option order is the
// speaker. A reordered option in the content would put words in the wrong mouth.
{
  const { ngobrol, speakerOf, tug, verdict } = await import('../src/data/ngobrol.ts');
  const v = ngobrol.verdicts;
  const plain = ngobrol.questions.findIndex((q) => q.options.every((o) => !o.by));
  if (plain >= 0) ok(speakerOf(plain, 0) === 'bride' && speakerOf(plain, 1) === 'groom' && speakerOf(plain, 2) === 'both', 'the pick speaks');
  ok(tug([]) === 50 && tug([0, 0]) === 0 && tug([1]) === 100 && tug([0, 1, 2, 2]) === 50, 'the tug-of-war');
  ok(tug([0, 2]) === 25, '"both" pulls the heart back toward the middle');
  ok(verdict([2, 2, 0]) === v.both, 'mostly both: diplomat');
  ok(verdict([0, 0, 1, 2]) === v.bride, 'mostly bride');
  ok(verdict([1, 1, 0, 2]) === v.groom, 'mostly groom');
  ok(verdict([0, 1, 0, 1, 2]) === v.tie, 'bride and groom tied above both: neutral');
  ok(verdict([0, 1, 2]) === v.both, 'a three-way tie goes to the diplomat');
}

// A guest must be reachable by thumb: the tap target is wider than the sprite.
const { DRAW_W } = await import('../src/game/sprites.ts');
const TAP_REACH = 46;
ok(TAP_REACH * 2 > DRAW_W, `tap target (${TAP_REACH * 2}px) is wider than the sprite (${DRAW_W}px)`);
ok(TAP_REACH * 2 >= 88, 'tap target clears the 44px minimum on both sides of centre');

// --- navigation: a guest must be able to walk anywhere, from anywhere
// Walking straight and sliding along whatever it hit left eleven of these
// thirty routes unfinishable, pinned in the corners of the fountain, the gift
// table and the photobox kiosk. This is why there is a pathfinder.
{
  const { Player } = await import('../src/game/Player.ts');
  const starts = [{ id: 'SPAWN', x: SPAWN.x, y: SPAWN.y },
    ...LANDMARKS.map((l) => ({ id: l.label, x: l.sx, y: l.sy }))];

  const walk = (from, to, cap = 2500) => {
    const p = new Player({ x: from.x, y: from.y }, 'pria');
    p.walkTo({ x: to.x, y: to.y });
    for (let i = 0; i < cap; i++) {
      p.update();
      if (Math.hypot(p.x - to.x, p.y - to.y) < 10) return i;
      if (!p.destination) break;
    }
    return Math.hypot(p.x - to.x, p.y - to.y) < 10 ? cap : -1;
  };

  let slowest = 0;
  for (const a of starts) {
    for (const b of starts) {
      if (a.id === b.id) continue;
      const frames = walk(a, b);
      ok(frames >= 0, `${a.id} -> ${b.id}: the walk completes`);
      slowest = Math.max(slowest, frames);
    }
  }
  ok(slowest < 1200, `the longest walk is under 20s (${(slowest / 60).toFixed(1)}s)`);

  // Tapping anywhere walkable must also work, not just the destinations.
  let unreachable = 0;
  for (let y = 160; y <= 1320; y += 96) {
    for (let x = 32; x <= 736; x += 96) {
      if (blocked(x, y)) continue;
      if (walk(starts[0], { x, y }) < 0) unreachable++;
    }
  }
  ok(unreachable === 0, `every walkable tap is reachable from spawn (${unreachable} were not)`);

  // The walk cycle must mean real motion, and the sprite must not flicker.
  const watch = (p, frames, input) => {
    let inPlace = 0, flips = 0, face = p.facing;
    for (let i = 0; i < frames; i++) {
      input?.(p, i);
      const x0 = p.x, y0 = p.y;
      p.update();
      if (p.moving && Math.hypot(p.x - x0, p.y - y0) < 0.05) inPlace++;
      if (p.facing !== face) { flips++; face = p.facing; }
    }
    return { inPlace, flips };
  };
  {
    const p = new Player({ x: 384, y: 830 }, 'pria');
    const r = watch(p, 300, (pl) => { pl.stick = { x: 0, y: -1 }; });
    ok(r.inPlace === 0, `joystick pushed into the fountain does not stride on the spot (${r.inPlace} frames)`);
    ok(p.facing === 'up', 'and the guest faces the fountain they are pushing into');
  }
  {
    const p = new Player({ x: 384, y: 1100 }, 'pria');
    const r = watch(p, 120, (pl, i) => {
      const a = Math.PI / 4 + Math.sin(i * 1.7) * 0.08; // a thumb wobbling on the diagonal
      pl.stick = { x: Math.cos(a) * 0.9, y: -Math.sin(a) * 0.9 };
    });
    ok(r.flips <= 1, `a wobbling diagonal does not flicker the sprite (${r.flips} facing changes in 2s)`);
  }
  {
    const p = new Player({ x: SPAWN.x, y: SPAWN.y }, 'pria');
    p.walkTo({ x: 384, y: 680 }); // the middle of the fountain
    ok(!blocked(p.destination.x, p.destination.y), 'a tap on scenery puts the marker on open ground');
    ok(p.destination.y > 680, 'tapping the fountain from below stops on the near side, not round the back');
    const r = watch(p, 900);
    ok(r.inPlace === 0 && !p.destination, `and the walk ends cleanly (${r.inPlace} frames on the spot)`);
  }
}

// The ring the engine draws is the trigger zone itself, so the prompt can
// never fire while the guest stands visibly outside it.
{
  const { ZONE_SQUASH } = await import('../src/game/landmarks.ts');
  for (const lm of LANDMARKS) {
    const ry = lm.radius * ZONE_SQUASH;
    ok(nearest(lm.sx + lm.radius * 0.98, lm.sy)?.lm.id === lm.id, `${lm.id}: just inside the ring's side triggers`);
    ok(nearest(lm.sx, lm.sy - ry * 0.98)?.lm.id === lm.id, `${lm.id}: just inside the ring's top triggers`);
    ok(nearest(lm.sx, lm.sy - ry * 1.05)?.lm.id !== lm.id, `${lm.id}: just outside the ring's top does not`);
  }
  const { landmarkAt } = await import('../src/game/landmarks.ts');
  for (const lm of LANDMARKS) {
    ok(landmarkAt(lm.x, lm.y)?.id === lm.id, `${lm.id}: tapping its scenery walks to it`);
    ok(landmarkAt(lm.x, lm.y - lm.signOffset - 10)?.id === lm.id, `${lm.id}: so does tapping its sign`);
  }
  ok(landmarkAt(384, 680) === null, 'the fountain is scenery with no landmark — a tap there just walks');
  const acara = LANDMARKS.find((l) => l.target === 'acara');
  ok(acara.sx > 110 && acara.sx < 216 && acara.sy > 610 && acara.sy < 660, 'ACARA stands at the foot of the stage steps');
}

console.log(`✓ map geometry: ${checks} checks passed`);
