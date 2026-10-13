import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** Your own details in wedding.local.json (gitignored) win over the public sample. */
const CONFIG = existsSync('wedding.local.json') ? 'wedding.local.json' : 'wedding.json';

/** public/ files with {{tokens}} in them. Public files are otherwise copied untouched. */
const TEMPLATED = [
  'assets/ui/cover_envelope.svg',
  'assets/frames/frame_batik_gold.svg',
  'assets/frames/frame_botanical.svg',
  'assets/frames/frame_retro_rpg.svg',
];

const FILTERS: Record<string, (s: string) => string> = {
  upper: (s) => s.toUpperCase(),
  initial: (s) => s.charAt(0),
};
const xml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&${{ '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot', "'": 'apos' }[c]};`);

/**
 * Fills {{path.to.value}} and {{path|upper}} from the wedding JSON, in the two
 * HTML pages and the SVGs above. Done at build time so link previews
 * (WhatsApp never runs JS) and the SVG text both carry the couple's names.
 * Read on every call, so editing the JSON shows up on the next reload.
 */
function fill(src: string): string {
  const w = JSON.parse(readFileSync(CONFIG, 'utf8'));
  const at = new Date(`${w.events.akad.date}T00:00:00Z`);
  const fmt = (month: 'long' | 'short') =>
    new Intl.DateTimeFormat('id-ID', { day: 'numeric', month, year: 'numeric', timeZone: 'UTC' }).format(at);
  // "12 Juni 2027", "12 Jun 2027", "12 · 06 · 2027" — derived from the akad date.
  const vars = { ...w, date: { long: fmt('long'), short: fmt('short'), dots: w.events.akad.date.split('-').reverse().join(' · ') } };

  return src.replace(/\{\{\s*([\w.]+)\s*(?:\|\s*(\w+)\s*)?\}\}/g, (token, path: string, filter?: string) => {
    const v = path.split('.').reduce((o, k) => o?.[k], vars);
    if (typeof v !== 'string') throw new Error(`${token}: "${path}" is not a text field in ${CONFIG}`);
    if (filter && !FILTERS[filter]) throw new Error(`${token}: unknown filter "${filter}"`);
    return xml(filter ? FILTERS[filter](v) : v);
  });
}

function weddingTemplate(): Plugin {
  return {
    name: 'wedding-template',
    transformIndexHtml: fill,
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0].slice(1) ?? '';
        if (!TEMPLATED.includes(path)) return next();
        res.setHeader('content-type', 'image/svg+xml');
        res.end(fill(readFileSync(`public/${path}`, 'utf8')));
      });
    },
    writeBundle({ dir = 'dist' }) {
      for (const path of TEMPLATED) writeFileSync(`${dir}/${path}`, fill(readFileSync(`public/${path}`, 'utf8')));
    },
  };
}

export default defineConfig({
  plugins: [react(), weddingTemplate()],
  resolve: { alias: { '@wedding': resolve(CONFIG) } },
  // `npm run dev:api` serves the same handler over an in-process Postgres,
  // so the database path can be exercised locally. In production Vercel
  // serves api/wishes.ts itself and this proxy does not exist.
  server: { port: 3000, host: true, proxy: { '/api': 'http://localhost:3001' } },
  // `vite preview` serves the real build output; proxy it the same way so the
  // production bundle can be exercised against the local API.
  preview: { port: 4173, proxy: { '/api': 'http://localhost:3001' } },
  build: {
    target: 'es2020',
    assetsInlineLimit: 2048,
    rollupOptions: {
      // The game at /, the scrolling invitation at /undangan/
      input: { main: 'index.html', undangan: 'undangan/index.html' },
      output: { manualChunks: { react: ['react', 'react-dom'] } },
    },
  },
});
