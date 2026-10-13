/**
 * Validates the wedding JSON in use — wedding.local.json when it exists, else
 * wedding.json — against the shape of the public sample. Run: npm run check
 *
 * tsc only ever sees the sample, so without this a missing field in the real
 * file would build cleanly and render as a blank on the invitation.
 * Messages are in Indonesian: this is the check people editing the JSON meet.
 */
import { existsSync, readFileSync } from 'node:fs';

const FILE = existsSync('wedding.local.json') ? 'wedding.local.json' : 'wedding.json';
const read = (f) => {
  try { return JSON.parse(readFileSync(f, 'utf8')); }
  catch (e) { console.error(`✗ ${f} bukan JSON yang valid: ${e.message}`); process.exit(1); }
};
const sample = read('wedding.json');
const w = read(FILE);
const errors = [];
const kind = (v) => (Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v);

// Every field in the sample must exist with the same type. Extra fields are fine.
(function same(want, got, path) {
  if (kind(want) !== kind(got)) return errors.push(`${path}: harus ${kind(want)}, ternyata ${kind(got)}`);
  if (kind(want) === 'array') {
    if (!got.length) return errors.push(`${path}: tidak boleh kosong`);
    got.forEach((g, i) => same(want[0], g, `${path}[${i}]`));
  } else if (kind(want) === 'object') {
    for (const k of Object.keys(want)) {
      const at = path ? `${path}.${k}` : k;
      if (!(k in got)) errors.push(`${at}: belum diisi`);
      else same(want[k], got[k], at);
    }
  } else if (kind(want) === 'string' && !got.trim()) errors.push(`${path}: masih kosong`);
})(sample, w, '');

/** A rule on a field the shape check may already have reported missing: skip it then, it is listed. */
const rule = (path, pass, msg) => {
  try { if (!pass()) errors.push(`${path}: ${msg}`); } catch { /* reported above */ }
};

for (const key of ['akad', 'resepsi']) {
  const e = w.events?.[key];
  rule(`events.${key}.date`, () => /^\d{4}-\d{2}-\d{2}$/.test(e.date) && !isNaN(Date.parse(e.date)), 'format harus YYYY-MM-DD, contoh "2027-06-12"');
  rule(`events.${key}.time`, () => /\d{1,2}[:.]\d{2}/.test(e.time), 'tulis jamnya, contoh "08:00 - 10:00 WIB"');
  rule(`events.${key}.mapsUrl`, () => /^https?:\/\//.test(e.mapsUrl), 'harus link lengkap (https://...)');
}
rule('ceremonyStart', () => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?[+-]\d{2}:\d{2}$/.test(w.ceremonyStart) && !isNaN(Date.parse(w.ceremonyStart)),
  'format harus "YYYY-MM-DDTHH:MM:SS+07:00" (WIB +07:00, WITA +08:00, WIT +09:00)');
for (const who of ['bride', 'groom']) {
  rule(`couple.${who}.instagram`, () => !w.couple[who].instagram.startsWith('@'), 'tulis tanpa "@"');
}
rule('bgmUrl', () => existsSync(`public${w.bgmUrl}`), `file public${w.bgmUrl} tidak ditemukan`);
rule('invitationBgm.url', () => existsSync(`public${w.invitationBgm.url}`), `file public${w.invitationBgm?.url} tidak ditemukan`);
(w.ngobrol?.questions ?? []).forEach((q, i) => {
  const at = `ngobrol.questions[${i}]`;
  rule(at, () => q.options.length === 3, `harus tepat 3 pilihan (mempelai wanita, pria, dua-duanya), ada ${q.options?.length}`);
  (q.options ?? []).forEach((o, k) => {
    rule(`${at}.options[${k}].by`, () => o.by === undefined || ['bride', 'groom', 'both'].includes(o.by), 'hanya boleh "bride", "groom", atau "both"');
  });
});

if (errors.length) {
  console.error(`✗ ${FILE} perlu dibenahi:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  process.exit(1);
}
console.log(`✓ wedding config: ${FILE} valid`);
