/**
 * The salaman: who gets a handshake, how long it takes, and that a tap is not
 * a handshake. Run: node scripts/check-meet.mjs (part of npm run check)
 */
import './_register-ts.mjs';
import assert from 'node:assert/strict';

const { gestureFor, startMeet, stepMeet, beatOf, BEATS, HOLD_MS, NO_TOUCH_ACROSS_SEXES } = await import('../src/game/meet.ts');

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const FRAME = 1000 / 60;

// --- etiquette, by the body the guest chose
if (NO_TOUCH_ACROSS_SEXES) {
  ok(gestureFor('pria', 'groom') === 'jabat' && gestureFor('pria', 'bride') === 'salam', 'a man shakes the groom\'s hand and gives the bride a salam');
  ok(gestureFor('wanita', 'bride') === 'jabat' && gestureFor('wanita', 'groom') === 'salam', 'a woman shakes the bride\'s hand and gives the groom a salam');
}

const run = (m, ms, input) => { for (let t = 0; t < ms; t += FRAME) m = stepMeet(m, FRAME, input); return m; };
const idle = { holding: false, arrived: false };
const at = { holding: false, arrived: true };
const hold = { holding: true, arrived: true };

// --- the walk waits for the spot
let m = startMeet();
ok(beatOf(run(m, 5000, idle)).kind === 'walk', 'nothing happens until the guest reaches the couple');
m = stepMeet(m, FRAME, at);
ok(beatOf(m).kind === 'hold' && beatOf(m).who === 'groom', 'arriving brings the greeting with the groom');

// --- a tap is not a handshake
ok(beatOf(run(m, 120, hold)).kind === 'hold', 'a quick tap does not complete the greeting');
ok(beatOf(run(m, 60000, at)).kind === 'hold', 'not holding at all waits forever, never skips the couple');
const slipped = run(run(m, HOLD_MS * 0.6, hold), 100, at);
ok(slipped.hold > 0 && slipped.hold < 0.6, 'letting go briefly drains the hold rather than wiping it');
ok(beatOf(run(m, HOLD_MS + 50, hold)).kind === 'react', 'holding for a handshake\'s length completes it');

// --- the whole meeting, held properly, ends; and stays ended
m = startMeet();
let guard = 0;
while (beatOf(m).kind !== 'done' && guard++ < 2000) m = stepMeet(m, FRAME, hold);
ok(beatOf(m).kind === 'done', 'greeting both and saying the doa ends the meeting');
ok(guard * FRAME < 9000, `and takes a few seconds, not more (${Math.round(guard * FRAME)}ms)`);
ok(stepMeet(m, FRAME, hold) === m, 'a finished meeting does not move');
ok(BEATS.filter((b) => b.kind === 'hold').map((b) => b.who).join() === 'groom,bride', 'both are greeted, groom first');

console.log(`✓ salaman: ${n} checks passed`);
