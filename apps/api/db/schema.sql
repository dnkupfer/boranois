-- Idempotent schema; run with `npm run db:migrate -w @boranois/api`.
-- Nothing here identifies the pessoas: their names, phones and notes stay on the member's device.

-- email is null for an anonymous session; the tool works without an account.
create table if not exists members (
  id          text primary key,
  email       text unique,
  name        text,
  created_at  timestamptz not null default now()
);

-- Magic-link sign-in. Tokens are stored hashed; a login is single-use and short-lived.
create table if not exists logins (
  token_hash  text primary key,
  email       text not null,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

create table if not exists sessions (
  token_hash  text primary key,
  member_id   text not null references members(id),
  created_at  timestamptz not null default now()
);

create table if not exists contacts (
  id                 text primary key,
  member_id          text not null references members(id),
  chips              jsonb not null,
  persona_id         text not null,
  match              jsonb not null,
  priority           jsonb not null,
  state              text not null,
  steps_done         jsonb not null default '[]',
  last_saying        text,
  last_sent_at       timestamptz,
  catalogue_version  text not null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists contacts_member_idx on contacts (member_id);

create table if not exists interactions (
  id                 text primary key,
  contact_id         text not null references contacts(id) on delete cascade,
  member_id          text not null references members(id),
  step_id            text not null,
  outcome            text not null,
  saying             text,
  catalogue_version  text not null,
  created_at         timestamptz not null default now()
);
create index if not exists interactions_contact_idx on interactions (contact_id);

-- Which chips people choose, and which they type in. Counts only: never linked to a member or a pessoa.
create table if not exists chip_usage (
  question_id  text not null,
  option_id    text not null,
  count        integer not null default 0,
  primary key (question_id, option_id)
);

create table if not exists chip_proposals (
  question_id  text not null,
  text         text not null,
  count        integer not null default 0,
  mapped       text,
  primary key (question_id, text)
);
