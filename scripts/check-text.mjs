/**
 * Wish card text layout.
 *
 * Guests type their own ucapan, and a pasted link is one word with nothing to
 * break on. The old wrapper only split on spaces, so a 40-character URL ran
 * past the card and off the side of the phone. No line may ever be wider than
 * the box it is drawn in.
 */
import './_register-ts.mjs';
import assert from 'node:assert/strict';

// Dynamic: the resolver hook above has to be registered before text.ts loads.
const { splitWord, wrap } = await import('../src/game/text.ts');

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };

// A monospace stand-in for the canvas: every glyph is 6px wide.
const CH = 6;
const measurer = { measureText: (t) => ({ width: t.length * CH }) };
const drawn = [];
const ctx = { ...measurer, fillText: (t) => drawn.push(t) };

// The real card: 174px wide, 7px of padding each side, two lines of 10px text.
const MAX_W = 174 - 14;
const FITS = Math.floor(MAX_W / CH);

ok(splitWord(measurer, 'selamat', MAX_W).join('|') === 'selamat', 'a short word is left alone');

for (const word of ['https://instagram.com/inki.fahmi.wedding.2026', 'a'.repeat(52), 'x'.repeat(FITS + 1)]) {
  const parts = splitWord(measurer, word, MAX_W);
  ok(parts.join('') === word, `${word.slice(0, 12)}…: nothing is lost in the split`);
  ok(parts.every((p) => p.length * CH <= MAX_W), `${word.slice(0, 12)}…: every piece fits the card`);
  ok(parts.every((p) => p.length > 0), `${word.slice(0, 12)}…: no empty pieces`);
}

ok(splitWord(measurer, 'y'.repeat(FITS), MAX_W).length === 1, 'a word that exactly fills the line is not split');

for (const msg of [
  'Barakallahu lakuma wa baraka alaikuma wa jamaa',
  'https://instagram.com/inki.fahmi.wedding.2026',
  'a'.repeat(52),
  'Selamat https://maps.app.goo.gl/QzRtY7bM sampai jumpa',
  '',
  '   ',
]) {
  drawn.length = 0;
  wrap(ctx, msg, 7, 19, MAX_W, 11, 2);
  ok(drawn.length <= 2, `"${msg.slice(0, 16)}…": never more than the two lines that fit`);
  for (const line of drawn) {
    ok(line.length * CH <= MAX_W, `"${msg.slice(0, 16)}…": "${line}" stays inside the card`);
  }
}

// Plain sentences must still break on spaces, not mid-word.
drawn.length = 0;
wrap(ctx, 'Barakallahu lakuma wa baraka alaikuma', 7, 19, MAX_W, 11, 2);
ok(drawn[0] === 'Barakallahu lakuma wa', 'words are still kept whole when they fit');

console.log(`✓ text: ${n} checks passed`);
