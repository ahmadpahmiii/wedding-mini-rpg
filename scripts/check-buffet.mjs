/**
 * Recipe Rush rules: scoring, alternatives, wrong ingredients, the timer, and
 * that no order can ever be scored twice.
 * Run: node scripts/check-buffet.mjs (part of npm run check)
 */
import './_register-ts.mjs';
import assert from 'node:assert/strict';

const { RECIPES, INGREDIENTS, score, startRound, step, roundTotal, isCorrect, ROUND_MS, MAX_ORDERS, SPEED_MS } =
  await import('../src/game/buffet.ts');

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const { bakso, sate } = RECIPES;

// --- every recipe uses only ingredients that have an icon
const known = new Set(INGREDIENTS.map((i) => i.id));
for (const [id, r] of Object.entries(RECIPES)) {
  ok([...r.required.flat(), ...r.optional.flat()].every((i) => known.has(i)), `${id}: every ingredient has an icon`);
}
ok(new Set(INGREDIENTS.map((i) => i.cell)).size === INGREDIENTS.length, 'no two ingredients share an icon cell');

// --- scoring
const perfect = score(bakso, ['bakso', 'sayur', 'kuah', 'mi'], 0);
ok(perfect.points.total === 100 && perfect.verdict === 'sempurna', 'a complete bakso with mi, served at once, is 100');
ok(score(bakso, ['bakso', 'sayur', 'kuah', 'bihun'], 0).points.bonus === 20, 'bihun counts the same as mi');
ok(score(bakso, ['bakso', 'sayur', 'kuah', 'bihun', 'mi'], 0).points.total === 100, 'bihun and mi together are not a wrong ingredient');
ok(score(sate, ['sate', 'saus', 'nasi'], 0).verdict === 'pas', 'saus kacang stands in for kecap');
ok(score(sate, ['sate', 'kecap', 'nasi', 'bawang'], 0).points.bonus === 10, 'one of two sate extras is half the bonus');

const half = score(bakso, ['bakso', 'sayur'], 0);
ok(half.verdict === 'kurang' && half.points.recipe === 40, 'two of three required parts is 40');
ok(half.points.bonus === 0 && half.points.speed === 0, 'no bonus or speed for an incomplete dish');
ok(score(bakso, ['mi'], 0).points.total === 0, 'an extra alone is not a dish');

const messy = score(bakso, ['bakso', 'sayur', 'kuah', 'nasi'], 0);
ok(messy.verdict === 'campur' && messy.points.recipe === 50, 'a wrong ingredient costs 10 and spoils the verdict');
ok(!isCorrect(messy.verdict) && isCorrect('pas') && isCorrect('sempurna'), 'only a clean, complete dish counts as correct');
ok(score(bakso, ['sate', 'kecap', 'nasi', 'acar', 'bawang', 'saus', 'bakso'], 0).points.recipe === 0, 'the recipe part never goes below zero');

const full = ['bakso', 'sayur', 'kuah'];
ok(score(bakso, full, SPEED_MS / 2).points.speed === 10, 'speed bonus halves at half the speed window');
ok(score(bakso, full, SPEED_MS * 3).points.speed === 0, 'and runs out, never negative');
ok(score(bakso, full, 1234).points.total === score(bakso, full, 1234).points.total, 'scoring is deterministic');

// --- the round
const t0 = 1_000_000;
let r = startRound(t0, 'bakso');
ok(r.order.recipe === 'bakso' && r.endsAt === t0 + ROUND_MS, 'a round starts with the chosen order and a full clock');

r = step(r, { type: 'toggle', id: 'bakso' });
r = step(r, { type: 'toggle', id: 'nasi' });
r = step(r, { type: 'toggle', id: 'nasi' });
ok(r.order.picked.join() === 'bakso', 'tapping again takes an ingredient back off');
ok(step(r, { type: 'toggle', id: 'bakso' }).order.picked.length === 0, 'and the plate never holds one twice');

const empty = startRound(t0, 'sate');
ok(step(empty, { type: 'serve', now: t0 + 100 }) === empty, 'an empty plate cannot be served');

for (const id of ['sayur', 'kuah']) r = step(r, { type: 'toggle', id });
r = step(r, { type: 'serve', now: t0 + 3000 });
ok(r.served.length === 1 && r.order.recipe === 'sate' && r.order.picked.length === 0, 'serving brings the next order, alternating');
const again = step(r, { type: 'serve', now: t0 + 3010 });
ok(again === r && again.served.length === 1, 'a double tap on serve scores nothing twice');

ok(step(r, { type: 'tick', now: t0 + 4000 }).served.length === 1, 'a tick before time is up changes nothing but the clock');

// time runs out mid-order: the plate is served once, then the round is over
r = step(r, { type: 'toggle', id: 'sate' });
const out = step(r, { type: 'tick', now: t0 + ROUND_MS });
ok(out.phase === 'over' && out.served.length === 2 && out.served[1].verdict === 'kurang', 'time up serves the partial plate once');
ok(step(out, { type: 'tick', now: t0 + ROUND_MS + 250 }) === out, 'and later ticks do nothing');
ok(step(out, { type: 'toggle', id: 'nasi' }) === out && step(out, { type: 'serve', now: t0 + ROUND_MS + 300 }) === out,
  'nothing can be added or served after the round');
ok(roundTotal(out) === out.served[0].points.total + out.served[1].points.total, 'the round total is the sum of its orders');

const idle = step(startRound(t0, 'bakso'), { type: 'tick', now: t0 + ROUND_MS + 5 });
ok(idle.phase === 'over' && idle.served.length === 0, 'time up on an empty plate ends the round without an order');

// three orders end the round early
let fast = startRound(t0, 'bakso');
const dishes = { bakso: ['bakso', 'sayur', 'kuah'], sate: ['sate', 'kecap', 'nasi'] };
for (let i = 0; i < MAX_ORDERS; i++) {
  for (const id of dishes[fast.order.recipe]) fast = step(fast, { type: 'toggle', id });
  fast = step(fast, { type: 'serve', now: t0 + (i + 1) * 1000 });
}
ok(fast.phase === 'over' && fast.served.length === MAX_ORDERS, `${MAX_ORDERS} orders end the round before the clock does`);
ok(fast.served.every((s) => isCorrect(s.verdict)), 'and each was scored correct');

console.log(`✓ buffet: ${n} checks passed`);
