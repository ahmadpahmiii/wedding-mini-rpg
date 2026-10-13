/**
 * The browser side of the wishes store, against a fake network and storage:
 * refused vs dropped sends, the retry queue, and the calendar links.
 * Run: node scripts/check-wishes.mjs (part of npm run check)
 */
import './_register-ts.mjs';
import assert from 'node:assert/strict';

const store = new Map();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  },
});

/** Each test sets `net` to decide what the "server" does. */
let net;
let posts = 0;
globalThis.fetch = async (_url, init = {}) => {
  if (init.method === 'POST') posts++;
  const r = net(init.method ?? 'GET', init.body ? JSON.parse(init.body) : null);
  if (r === 'down') throw new TypeError('Failed to fetch');
  return { ok: r.status < 300, status: r.status, json: async () => r.body };
};

const { add, load, isPending } = await import('../src/services/wishes.ts');
const { calendarUrl } = await import('../src/services/calendar.ts');

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const local = () => JSON.parse(store.get('wq.wishes.v1') ?? '[]');
const draft = (message) => ({ name: 'Rina', message, attending: true, guests: 2, sticker: null, gender: 'wanita' });
let id = 100;
const accept = (_m, body) => ({ status: 201, body: { wish: { ...body, id: String(id++), at: Date.now() } } });

// --- sending
net = accept;
let r = await add(draft('Barakallah'));
ok(r.saved && r.wish && !isPending(r.wish) && r.wish.mine, 'accepted wish comes back saved and marked mine');
ok(local().length === 1, 'accepted wish is remembered locally');

net = () => ({ status: 400, body: { error: 'Ucapan terlalu panjang' } });
r = await add(draft('x'));
ok(r.wish === null && r.error === 'Ucapan terlalu panjang', 'refused wish returns the server reason and no wish');
ok(local().length === 1, 'refused wish is never stored as if sent');

net = () => ({ status: 429, body: { error: 'Sabar ya' } });
r = await add(draft('cepat'));
ok(r.wish === null && r.error === 'Sabar ya', 'rate-limited send is shown as refused');

net = () => 'down';
r = await add(draft('lewat sinyal jelek'));
ok(!r.saved && r.wish && isPending(r.wish) && !r.error, 'dropped connection queues the wish');
await add(draft('lewat sinyal jelek'));
ok(local().filter(isPending).length === 1, 'retrying the same words does not queue a duplicate');

// --- loading delivers the queue
r = await load();
ok(!r.live && r.wishes.some((w) => w.id.startsWith('seed-')), 'offline load falls back to the seed list');

const serverRows = [{ id: '1', name: 'Budi', message: 'Selamat', attending: true, guests: 1, sticker: null, gender: 'pria', at: 1 }];
posts = 0;
net = (m, body) => (m === 'GET' ? { status: 200, body: { wishes: serverRows } } : accept(m, body));
r = await load();
ok(r.live && posts === 1, 'queued wish is re-sent once the server is reachable');
ok(local().filter(isPending).length === 0, 'delivered wish leaves the queue');
ok(r.wishes.some((w) => w.message === 'lewat sinyal jelek' && w.mine && !isPending(w)), 'delivered wish is listed as mine');

// already on the server (the response was lost, not the request): forget, never re-post
net = () => 'down';
await add(draft('sudah sampai'));
posts = 0;
net = (m, body) => (m === 'GET'
  ? { status: 200, body: { wishes: [...serverRows, { ...draft('sudah sampai'), id: '7', at: 2 }] } }
  : accept(m, body));
r = await load();
ok(posts === 0 && local().filter(isPending).length === 0, 'a queued wish the server already has is not sent twice');
ok(r.wishes.filter((w) => w.message === 'sudah sampai').length === 1, 'and is listed once');

// rate-limited during retry: kept for next time; refused for good: dropped
net = () => 'down';
await add(draft('nanti saja'));
net = (m) => (m === 'GET' ? { status: 200, body: { wishes: serverRows } } : { status: 429, body: { error: 'Sabar ya' } });
await load();
ok(local().some((w) => isPending(w) && w.message === 'nanti saja'), 'a 429 on retry keeps the wish queued');
net = (m) => (m === 'GET' ? { status: 200, body: { wishes: serverRows } } : { status: 400, body: { error: 'x' } });
await load();
ok(!local().some(isPending), 'a hard refusal on retry drops the wish instead of retrying forever');

// own wish stays highlighted once the server lists it
const saved = local().find((w) => w.message === 'Barakallah');
net = () => ({ status: 200, body: { wishes: [{ ...saved, mine: undefined }] } });
r = await load();
ok(r.wishes.find((w) => w.id === saved.id)?.mine === true, 'server copy of my own wish is marked mine');

// --- calendar: both ends from the event's own time, converted from WIB
const dates = (e) => new URL(calendarUrl(e)).searchParams.get('dates');
// A fixed event, not wedding.json: the maths is under test, not the couple's date.
const ev = { title: 'Akad', date: '2027-06-12', time: '09:00 - 11:00 WIB', venue: 'v', address: 'a', dresscode: 'd' };
ok(dates(ev) === '20270612T020000Z/20270612T040000Z', 'akad 09:00-11:00 WIB');
ok(dates({ ...ev, time: '12:30 - 17:00 WIB' }) === '20270612T053000Z/20270612T100000Z', 'resepsi 12:30-17:00 WIB, not start + 2h');
ok(dates({ ...ev, time: '19.30 WIB' }) === '20270612T123000Z/20270612T143000Z', 'single time, dot separator: two hours');

console.log(`✓ wishes client + calendar: ${n} checks passed`);
