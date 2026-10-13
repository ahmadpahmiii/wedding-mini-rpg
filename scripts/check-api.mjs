/**
 * Exercises the wishes store against a real Postgres running in-process
 * (PGlite), so the schema, the queries and every validation rule are checked
 * without needing a database. Run: npm run check:api
 */
import assert from 'node:assert/strict';
import { SCHEMA_SQL } from '../api/_schema.ts';
import { PGlite } from '@electric-sql/pglite';
import {
  parseWish, senderHash, listWishes, insertWish, isRateLimited, RATE_MAX, MAX_MESSAGE,
} from '../api/_store.ts';

const db = new PGlite();
await db.exec(SCHEMA_SQL);

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const good = { name: 'Rizal', message: 'Barakallahu lakuma', attending: true, guests: 2, sticker: 'sticker_heart', gender: 'pria' };

// --- validation: the boundary that actually has to hold
ok(parseWish(good).ok, 'a well-formed wish is accepted');
ok(!parseWish(null).ok, 'null body rejected');
ok(!parseWish({ ...good, name: '   ' }).ok, 'blank name rejected');
ok(!parseWish({ ...good, name: 'x'.repeat(41) }).ok, 'over-long name rejected');
ok(!parseWish({ ...good, message: '' }).ok, 'blank message rejected');
ok(!parseWish({ ...good, message: 'x'.repeat(MAX_MESSAGE + 1) }).ok, 'over-long message rejected');
ok(!parseWish({ ...good, attending: 'yes' }).ok, 'non-boolean attendance rejected');
ok(!parseWish({ ...good, guests: 99 }).ok, 'guest count above 10 rejected');
ok(!parseWish({ ...good, guests: 0 }).ok, 'attending with zero guests rejected');
ok(parseWish({ ...good, attending: false, guests: 7 }).wish.guests === 0, 'declining forces guests to 0');
ok(parseWish({ ...good, sticker: '../../etc/passwd' }).wish.sticker === null, 'unknown sticker dropped, not stored');
ok(parseWish({ ...good, gender: 'x' }).wish.gender === 'pria', 'unknown gender falls back rather than breaking the check constraint');
ok(parseWish({ ...good, name: '  Siti  ' }).wish.name === 'Siti', 'name is trimmed');

// --- the salt must actually change the hash, or it is decoration
const a = senderHash('1.2.3.4', 'salt-one');
ok(a !== senderHash('1.2.3.4', 'salt-two'), 'sender hash depends on the salt');
ok(a !== senderHash('5.6.7.8', 'salt-one'), 'sender hash depends on the address');
ok(!a.includes('1.2.3.4'), 'raw address never survives into the stored value');

// --- round trip
const sender = senderHash('9.9.9.9', 'test');
const saved = await insertWish(db, parseWish(good).wish, sender);
ok(saved.name === 'Rizal' && saved.guests === 2, 'insert returns the stored row');
ok(typeof saved.at === 'number' && saved.at > 0, 'created_at comes back as a timestamp');

let list = await listWishes(db);
ok(list.length === 1 && list[0].id === saved.id, 'the wish is listed');

// --- newest first, which the feed relies on
await db.query("insert into wishes (name, message, attending, guests, gender, created_at) values ('Older','x',true,1,'pria', now() - interval '1 hour')");
list = await listWishes(db);
ok(list[0].name === 'Rizal' && list[1].name === 'Older', 'listed newest first');

// --- rate limiting
ok(!(await isRateLimited(db, sender)), `one post is under the limit of ${RATE_MAX}`);
for (let i = 1; i < RATE_MAX; i++) await insertWish(db, parseWish(good).wish, sender);
ok(await isRateLimited(db, sender), `${RATE_MAX} posts from one sender trips the limit`);
ok(!(await isRateLimited(db, senderHash('4.4.4.4', 'test'))), 'a different sender is unaffected');

// --- the database rejects bad data even if the validator is bypassed
await assert.rejects(
  db.query("insert into wishes (name, message, attending, guests, gender) values ('x','y',true,99,'pria')"),
  'guests above 10 rejected by the check constraint',
);
await assert.rejects(
  db.query("insert into wishes (name, message, attending, guests, gender) values ('x','y',true,1,'other')"),
  'unknown gender rejected by the check constraint',
);
n += 2;

// --- the couple's guest list
const { rows } = await db.query('select * from rsvp_summary');
ok(Number(rows[0].seats_taken) > 0, 'rsvp_summary totals the seats');

console.log(`✓ wishes store: ${n} checks passed`);
