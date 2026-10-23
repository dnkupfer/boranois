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

-- Product analytics. aid is a random per-device id created only after consent; never a member id, name or text.
create table if not exists events (
  id     text primary key,
  aid    text not null,
  name   text not null,
  path   text not null default '',
  props  jsonb not null default '{}',
  ts     timestamptz not null
);
create index if not exists events_ts_idx on events (ts);
create index if not exists events_aid_idx on events (aid, ts);

-- Casas de repouso: volunteers call care homes on Saturday and arrange company for Sunday.
-- Rows come from the Receita Federal registry (CNAE 8711-5). No resident data, ever: counts and staff notes only.
create table if not exists lares (
  id                text primary key,            -- CNPJ, or a generated id for manual rows
  name              text not null,
  legal_name        text,
  kind              text not null default 'privado',   -- publico / filantropico / privado
  address           text,
  neighbourhood     text,
  city              text not null,
  state             text not null,
  cep               text,                        -- 8 digits
  phone             text,                        -- digits with DDD, or null
  phone2            text,
  source            text not null,
  status            text not null default 'livre',    -- livre / ligando / telefone_errado / sem_interesse / interessados / ajudantes
  tries             int not null default 0,
  last_outcome      text,
  interested_count  int,
  notes             text,
  updated_at        timestamptz not null default now()
);
create index if not exists lares_state_city_idx on lares (state, city);
create index if not exists lares_status_idx on lares (status);

-- One active claim per home ("estou ligando"); released on outcome or after two hours without an update.
create table if not exists lares_claims (
  id               text primary key,
  home_id          text not null references lares(id) on delete cascade,
  volunteer_name   text not null,
  volunteer_email  text not null,
  claimed_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  released_at      timestamptz,
  outcome          text
);
create index if not exists lares_claims_home_idx on lares_claims (home_id) where released_at is null;

-- Neighbours who offer to accompany residents on Sunday. Contact shown to the volunteers organising that home.
create table if not exists lares_helpers (
  id             text primary key,
  name           text not null,
  contact        text not null,
  cep            text,
  neighbourhood  text,
  city           text,
  state          text,
  home_id        text references lares(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists lares_helpers_home_idx on lares_helpers (home_id);

-- Coordinates per CEP, so the list can rank homes by real distance. Filled by `lares:geocode`.
create table if not exists lares_geo (
  cep         text primary key,
  lat         double precision,
  lng         double precision,
  tried_at    timestamptz not null default now()
);
