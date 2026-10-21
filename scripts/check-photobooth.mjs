/**
 * Photobooth group layout.
 *
 * The guest stands beside their own — a man next to the groom, a woman next
 * to the bride — and never between the two of them. Standing in the middle
 * separates the couple in their own wedding photo, which is not what anyone
 * does at a resepsi. Same etiquette the salaman follows.
 */
import './_register-ts.mjs';
import assert from 'node:assert/strict';

// Dynamic: the resolver hook above has to be registered before photobooth.ts
// pulls in its own extensionless imports.
const { groupLayout } = await import('../src/game/photobooth.ts');

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };

for (const body of ['pria', 'wanita']) {
  const { guest, groom, bride } = groupLayout(body);
  const between = (guest > Math.min(groom, bride)) && (guest < Math.max(groom, bride));
  ok(!between, `${body}: the guest never stands between the bride and the groom`);

  // The couple stay next to each other: nothing sits between them.
  const lo = Math.min(groom, bride), hi = Math.max(groom, bride);
  ok(!(guest > lo && guest < hi), `${body}: the couple are not separated`);

  if (body === 'pria') {
    ok(Math.abs(guest - groom) < Math.abs(guest - bride), 'a man stands nearer the groom');
    ok(guest < groom && groom < bride, 'order is guest, groom, bride');
  } else {
    ok(Math.abs(guest - bride) < Math.abs(guest - groom), 'a woman stands nearer the bride');
    ok(groom < bride && bride < guest, 'order is groom, bride, guest');
  }

  // Three distinct spots, evenly spaced, centred on the scene.
  const xs = [guest, groom, bride].sort((a, b) => a - b);
  ok(new Set(xs).size === 3, `${body}: nobody is standing on top of anyone`);
  ok(Math.abs((xs[1] - xs[0]) - (xs[2] - xs[1])) < 0.001, `${body}: evenly spaced`);
  ok(Math.abs(xs[0] + xs[2]) < 0.001, `${body}: the trio is centred on the scene`);
}

console.log(`✓ photobooth: ${n} checks passed`);
