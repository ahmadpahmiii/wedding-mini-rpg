/**
 * The whole schema, as one idempotent statement block.
 *
 * It lives in TypeScript rather than a .sql file so the serverless function
 * can apply it itself: Vercel marks the Neon connection string Sensitive,
 * which means `vercel env pull` returns "[SENSITIVE]" and a migration cannot
 * be run from a laptop at all. Applying it on first use also means a redeploy
 * to a fresh database needs no separate step.
 *
 * To read it by hand (e.g. to paste into Neon's SQL editor): npm run db:sql
 */
export const SCHEMA_SQL = `
create table if not exists wishes (
  id         bigint generated always as identity primary key,
  name       text        not null,
  message    text        not null,
  attending  boolean     not null,
  guests     smallint    not null default 0,
  sticker    text,
  gender     text        not null,
  created_at timestamptz not null default now(),
  -- A salted hash, never a raw address: enough to rate-limit one sender,
  -- not enough to identify a guest. See senderHash in _store.ts.
  sender     text,

  constraint wishes_name_len    check (char_length(name) between 1 and 40),
  constraint wishes_message_len check (char_length(message) between 1 and 200),
  constraint wishes_guests_rng  check (guests between 0 and 10),
  constraint wishes_gender_ok   check (gender in ('pria', 'wanita'))
);

create index if not exists wishes_created_at_idx on wishes (created_at desc);
create index if not exists wishes_sender_idx     on wishes (sender, created_at desc);

-- The couple's headcount.
create or replace view rsvp_summary as
select
  count(*) filter (where attending)                 as parties_attending,
  coalesce(sum(guests) filter (where attending), 0) as seats_taken,
  count(*) filter (where not attending)             as parties_declined,
  count(*)                                          as wishes_total
from wishes;
`;
