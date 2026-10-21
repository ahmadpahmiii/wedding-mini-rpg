/**
 * Recipe Rush rules: scoring, alternatives, wrong ingredients, the timer, and
 * that no order can ever be scored twice.
 * Run: node scripts/check-buffet.mjs (part of npm run check)
 */
import './_register-ts.mjs';
import assert from 'node:assert/strict';

const { RECIPES, INGREDIENTS, shelfOrder, orderQueue, score, startRound, step, roundTotal, isCorrect, ROUND_MS, MAX_ORDERS, SPEED_MS } =
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
let r = startRound(t0, 'bakso', () => 0.9); // queue: bakso, sate, sate
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
ok(r.served.length === 1 && r.order.recipe === 'sate' && r.order.picked.length === 0, 'serving brings the next order off the queue');
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

// --- the shelf is shuffled, and shuffled properly
// A fixed shelf turns into muscle memory, so the trays move each round. The risk
// in hand-rolling a shuffle is a biased one: the classic off-by-one
// (rand() * i instead of rand() * (i + 1)) silently pins index 0.
const ALL = INGREDIENTS.map((i) => i.id);
const seeded = (seed) => () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;

for (const seed of [1, 7, 42, 999]) {
  const shelf = shelfOrder(seeded(seed));
  ok(shelf.length === ALL.length, `seed ${seed}: the shelf holds every tray`);
  ok(new Set(shelf).size === ALL.length, `seed ${seed}: no tray appears twice`);
  ok(ALL.every((id) => shelf.includes(id)), `seed ${seed}: no tray goes missing`);
}
ok(
  shelfOrder(seeded(42)).join() === shelfOrder(seeded(42)).join(),
  'the same seed lays the shelf out the same way',
);

// Every ingredient must be able to reach every slot, or the shuffle is biased.
const seen = new Map(ALL.map((id) => [id, new Set()]));
for (let i = 0; i < 4000; i++) {
  shelfOrder(seeded(i * 7919 + 1)).forEach((id, pos) => seen.get(id).add(pos));
}
for (const [id, slots] of seen) {
  ok(slots.size === ALL.length, `${id} can land in any of the ${ALL.length} slots`);
}

// And it is actually shuffled, not returned in INGREDIENTS order.
let identical = 0;
for (let i = 0; i < 300; i++) if (shelfOrder(seeded(i + 1)).join() === ALL.join()) identical++;
ok(identical <= 1, `the shelf is not just INGREDIENTS order (${identical}/300 identical)`);

const fresh = startRound(0, 'bakso', seeded(5));
ok(fresh.shelf.length === ALL.length, 'a new round starts with a full shelf');
ok(new Set(fresh.shelf).size === ALL.length, 'and no tray on it twice');
// The shelf must hold still once the round is running.
const after = step(step(fresh, { type: 'toggle', id: 'bakso' }), { type: 'tick', now: 1000 });
ok(after.shelf.join() === fresh.shelf.join(), 'the shelf does not move under the guest mid-round');

// --- the dish order is drawn, not alternated
// bakso -> sate -> bakso told the guest the next order before the plate was
// cleared. The queue is rolled when the round starts so serve() stays pure.
const IDS = Object.keys(RECIPES);
const low = () => 0, high = () => 0.9;

for (const first of IDS) {
  const q = orderQueue(first, high);
  ok(q.length === MAX_ORDERS, `${first}: the queue holds all ${MAX_ORDERS} orders`);
  ok(q[0] === first, `${first}: the round opens with the dish it was given`);
  ok(q.every((id) => IDS.includes(id)), `${first}: every order is a real recipe`);
}

// The whole point: a dish may now follow itself, which alternating forbade.
ok(orderQueue(IDS[0], low).every((id) => id === IDS[0]), 'the same dish can come up three times');
ok(new Set(orderQueue(IDS[0], high)).size === 2, 'and a different one can follow it');

// Both dishes must be reachable in every slot after the first.
const slots = Array.from({ length: MAX_ORDERS }, () => new Set());
for (let i = 0; i < 2000; i++) {
  const seed = seeded(i * 7919 + 3);
  orderQueue(IDS[i % IDS.length], seed).forEach((id, pos) => slots[pos].add(id));
}
for (let pos = 1; pos < MAX_ORDERS; pos++) {
  ok(slots[pos].size === IDS.length, `order ${pos + 1} can be either dish`);
}

// And the queue actually drives what gets served.
let q = startRound(t0, 'sate', low); // queue: sate, bakso, bakso
ok(q.queue.join() === ['sate', IDS[0], IDS[0]].join(), 'the queue is laid out at the start of the round');
q = step(q, { type: 'toggle', id: 'sate' });
q = step(q, { type: 'serve', now: t0 + 500 });
ok(q.order.recipe === q.queue[1], 'the second order is the one the queue named');
ok(q.queue.join() === startRound(t0, 'sate', low).queue.join(), 'and serving does not rewrite the queue');

console.log(`✓ buffet: ${n} checks passed`);
