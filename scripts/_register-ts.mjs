/**
 * Lets the check scripts import app source directly.
 *
 * Node's ESM resolver wants an explicit extension, but the app is written for
 * a bundler and says `from './landmarks'`. Rather than litter the source with
 * `.ts` suffixes to suit the tests, resolve them here.
 */
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';

// Same choice as vite.config.ts: the real details when present, else the sample.
const WEDDING = new URL(existsSync('wedding.local.json') ? '../wedding.local.json' : '../wedding.json', import.meta.url).href;

registerHooks({
  resolve(spec, ctx, next) {
    if (spec === '@wedding') return next(WEDDING, ctx);
    try {
      return next(spec, ctx);
    } catch (err) {
      if (spec.startsWith('.') && !/\.[cm]?[jt]sx?$/.test(spec)) return next(`${spec}.ts`, ctx);
      throw err;
    }
  },
});
