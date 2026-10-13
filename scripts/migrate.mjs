/**
 * Applies the schema to DATABASE_URL by hand.
 *
 * Usually unnecessary: api/wishes.ts applies it itself on first use, which is
 * the only option when the connection string is marked Sensitive on Vercel
 * and so cannot be pulled locally. Kept for a database you do hold the URL to.
 *
 *   DATABASE_URL='postgresql://…' npm run db:migrate
 */
import { readFileSync, existsSync } from 'node:fs';
import pg from 'pg';
import { SCHEMA_SQL } from '../api/_schema.ts';

for (const file of ['.env.local', '.env']) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString || connectionString === '[SENSITIVE]') {
  console.error(
    connectionString === '[SENSITIVE]'
      ? 'DATABASE_URL is marked Sensitive on Vercel, so its value cannot be pulled.\n' +
        'Nothing to do: the API applies the schema itself on first request.\n' +
        'To apply it by hand, paste `npm run db:sql` into your database console.'
      : 'DATABASE_URL is not set. See .env.example.',
  );
  process.exit(1);
}

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
await client.connect();
await client.query(SCHEMA_SQL);
const { rows } = await client.query('select count(*)::int as n from wishes');
await client.end();
console.log(`✓ schema applied — wishes table holds ${rows[0].n} row(s)`);
