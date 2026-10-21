/**
 * The trip to the venue: every run ends, every mode can be finished, and a
 * hit costs exactly one heart. Run: node scripts/check-travel.mjs (part of npm run check)
 */
import './_register-ts.mjs';
import assert from 'node:assert/strict';

const { createRun, tick, MODES, DURATION, HEARTS, playerBox, obstacleBox, speedAt } = await import('../src/game/travel.ts');

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const FRAME = 1000 / 60;
const modes = Object.keys(MODES);
const SEEDS = Array.from({ length: 25 }, (_, i) => 1000 + i * 7919);

/** Plays a run to its end; `pilot` decides when to jump. Returns the run and frames used. */
function play(mode, seed, pilot) {
  const r = createRun(mode, seed);
  let frames = 0;
  while (!r.outcome && frames < 60 * 60) {
    tick(r, FRAME, pilot(r));
    frames++;
  }
  return { r, frames };
}

/** Jumps when the next obstacle is a short hop away. A guest will do worse, but must be able to do this well. */
const autopilot = (r) => {
  const p = playerBox(r);
  const lead = speedAt(r.t) * 0.1 + 6;
  return r.obstacles.some((o) => !o.hit && obstacleBox(o).l - p.r >= 0 && obstacleBox(o).l - p.r <= lead);
};

for (const mode of modes) {
  // Fair: a well-timed player always gets there without a scratch.
  const clean = SEEDS.map((s) => play(mode, s, autopilot).r);
  ok(clean.every((r) => r.outcome === 'arrived'), `${mode}: a well-timed run always arrives`);
  ok(clean.every((r) => r.hearts === HEARTS), `${mode}: and every obstacle can be cleared (hearts left: ${clean.map((r) => r.hearts).join(',')})`);

  // Short: about 20 seconds, inside the PRD's 15-25.
  const secs = clean.map((r) => r.t / 1000);
  ok(secs.every((s) => s >= 15 && s <= 25), `${mode}: a run lasts ${Math.min(...secs).toFixed(1)}-${Math.max(...secs).toFixed(1)}s`);

  // Never stuck: doing nothing still ends the run, and soon.
  const idle = SEEDS.map((s) => play(mode, s, () => false));
  ok(idle.every(({ r }) => r.outcome !== null), `${mode}: a run with no input still ends`);
  // Without this the autopilot test proves nothing: obstacles that never hit are always "cleared".
  ok(idle.every(({ r }) => r.outcome === 'tumbled'), `${mode}: with no jumping, the obstacles really do hit`);
  ok(idle.every(({ r }) => r.t <= DURATION + 2000), `${mode}: and well before the clock would`);
  ok(idle.every(({ r }) => r.hearts >= 0 && (r.outcome === 'tumbled') === (r.hearts === 0)), `${mode}: tumbling means no hearts left, never fewer`);

  // Mashing jump is no exploit, and no crash.
  const mash = SEEDS.slice(0, 5).map((s) => play(mode, s, () => true).r);
  ok(mash.every((r) => r.outcome !== null), `${mode}: holding jump the whole way still ends`);
}

// One obstacle can only ever cost one heart, however long the traveller overlaps it.
{
  const r = createRun('mobil', 42);
  r.obstacles.push({ kind: 4, x: 60, hit: false });
  r.gapLeft = 1e9;
  for (let i = 0; i < 30; i++) tick(r, FRAME, false);
  ok(r.hearts === HEARTS - 1, 'a single obstacle takes a single heart');
  ok(r.hurt > 0, 'and the traveller blinks, unhurtable, for a moment after');
}

// A long frame (a tab coming back) must not fling anyone through the scenery.
{
  const r = createRun('motor', 7);
  tick(r, 5000, false);
  ok(r.t <= 48, 'a huge frame is clamped');
}

// The outcome is final.
{
  const r = createRun('jalan', 9);
  r.outcome = 'arrived';
  const before = JSON.stringify({ t: r.t, hearts: r.hearts });
  tick(r, FRAME, true);
  ok(JSON.stringify({ t: r.t, hearts: r.hearts }) === before, 'a finished run does not move');
}

console.log(`✓ travel: ${n} checks passed`);
