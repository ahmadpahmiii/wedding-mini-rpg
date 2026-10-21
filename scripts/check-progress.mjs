/**
 * The guest's saved progress: whatever storage hands back, the game must start,
 * and no quest may be completed — or celebrated — twice.
 * Run: node scripts/check-progress.mjs (part of npm run check)
 */
import './_register-ts.mjs';
import assert from 'node:assert/strict';

const { sanitize, award, has, loadProgress, saveProgress, FRESH, MILESTONES, QUESTS, CORE, allCore } =
  await import('../src/services/progress.ts');

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const same = (a, b) => { try { assert.deepStrictEqual(a, b); return true; } catch { return false; } };

// --- no storage at all, like a locked-down browser. Defined outright: Node's
// own localStorage getter warns when touched without --localstorage-file.
const storage = (value) => Object.defineProperty(globalThis, 'localStorage', { configurable: true, value });
storage(undefined);
ok(same(loadProgress(), FRESH), 'no storage: a fresh start, not a crash');
saveProgress({ done: ['welcome'], held: 'kado' });
n++; // reaching here means saving without storage did not throw

// --- whatever is stored is checked, field by field
for (const junk of [null, 'x', 42, [], { done: 'welcome' }, { held: 7 }]) {
  ok(same(sanitize(junk), FRESH), `junk ${JSON.stringify(junk)} starts fresh`);
}
const odd = sanitize({ v: 9, done: ['gift', 'paid', 'welcome', 'gift'], held: 'cash', extra: true });
ok(same(odd.done, ['welcome', 'gift']), 'unknown flags dropped, duplicates collapsed');
ok(odd.held === null, 'an unknown gift is not held');
ok(sanitize({ done: [], held: 'buket' }).held === 'buket', 'a real gift survives a reload');

// --- a fake browser storage: round trip, and a corrupt value
const store = new Map();
storage({ getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) });
const saved = { outfit: 'hijab', done: ['welcome', 'greeted'], held: 'amplop', buffetBest: 187 };
saveProgress(saved);
ok(same(loadProgress(), saved), 'progress survives a reload, outfit included');
ok(sanitize({ outfit: 'tuxedo' }).outfit === null, 'an unknown outfit falls back to the default pick');
for (const bad of [-5, 301, 12.5, '99', null]) {
  ok(sanitize({ buffetBest: bad }).buffetBest === 0, `a best score of ${JSON.stringify(bad)} is not trusted`);
}
store.set('wq.progress.v1', '{not json');
ok(same(loadProgress(), FRESH), 'a corrupt saved value starts fresh');

// --- completion is idempotent
const once = award(FRESH, 'greeted');
ok(once && has(once, 'greeted'), 'greeting the couple completes the quest');
ok(award(once, 'greeted') === null, 'greeting again awards nothing');
ok(!has(FRESH, 'greeted'), 'awarding never mutates the old progress');

// --- giving is voluntary: the gift quest completes on its own, and is never a milestone
const gifted = award(FRESH, 'gift');
ok(gifted && has(gifted, 'gift') && gifted.held === null, 'the gift quest completes with nothing else required');
ok(!MILESTONES.gift, 'giving is not a milestone');
ok(MILESTONES.foodie && !QUESTS.find((q) => q.flag === 'foodie')?.optional, 'the buffet is a milestone and a core quest');
ok(QUESTS.find((q) => q.flag === 'gift')?.optional === true, 'the gift quest is marked optional');

// --- the final celebration: every core quest, never the gift
{
  let p = FRESH;
  for (const f of CORE) p = award(p, f);
  ok(allCore(p) && !has(p, 'gift'), 'all core quests done without ever giving: All-Star is earned');
  ok(!CORE.includes('gift'), 'the gift is not a core quest');
  ok(!allCore(award(award(award(FRESH, 'welcome'), 'greeted'), 'gift')), 'a gift cannot stand in for a missing quest');
  ok(!QUESTS.some((q) => q.flag === 'allstar'), 'All-Star is the reward, not one more quest on the list');
  ok(MILESTONES.photo && MILESTONES.allstar, 'Picture Perfect and Wedding All-Star are milestones');
}

console.log(`✓ progress: ${n} checks passed`);
