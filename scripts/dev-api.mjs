/**
 * Local stand-in for the Vercel function: serves /api/wishes from an
 * in-process Postgres (PGlite) so the full path can be exercised without a
 * hosted database. Dev only — never deployed.
 */
import http from 'node:http';
import { SCHEMA_SQL } from '../api/_schema.ts';
import { PGlite } from '@electric-sql/pglite';
import { insertWish, isRateLimited, listWishes, parseWish, senderHash } from '../api/_store.ts';

const db = new PGlite();
await db.exec(SCHEMA_SQL);

const json = (res, code, body) => {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

http.createServer(async (req, res) => {
  try {
    if (!req.url.startsWith('/api/wishes')) return json(res, 404, { error: 'not found' });
    if (req.method === 'GET') return json(res, 200, { wishes: await listWishes(db) });
    if (req.method === 'POST') {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const parsed = parseWish(JSON.parse(Buffer.concat(chunks).toString() || '{}'));
      if (!parsed.ok) return json(res, 400, { error: parsed.error });
      const sender = senderHash(req.socket.remoteAddress ?? 'local', 'dev');
      // Rate limiting is off here: every request from a dev machine looks like
      // one sender, which makes the app untestable. It is verified against the
      // real handler in scripts/check-api.mjs.
      if (process.env.DEV_RATE_LIMIT && (await isRateLimited(db, sender))) {
        return json(res, 429, { error: 'Sabar ya, ucapanmu sudah terkirim 🙏' });
      }
      return json(res, 201, { wish: await insertWish(db, parsed.wish, sender) });
    }
    json(res, 405, { error: 'method not allowed' });
  } catch (e) {
    console.error(e);
    json(res, 500, { error: 'server error' });
  }
}).listen(3001, () => console.log('dev api on http://localhost:3001'));
