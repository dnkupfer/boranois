-- Idempotent schema; run with `npm run db:migrate -w @boranois/api`.

create table if not exists groups (
  id            text primary key,
  objective     text,
  created_at    timestamptz not null default now()
);

create table if not exists members (
  id          text primary key,
  group_id    text references groups(id),
  name        text not null,
  role        text not null check (role in ('host', 'member')),
  token_hash  text not null unique,
  created_at  timestamptz not null default now()
);

-- group_id is null for host codes: redeeming one creates a new group.
create table if not exists invites (
  code          text primary key,
  group_id      text references groups(id),
  role          text not null check (role in ('host', 'member')),
  contact_name  text,
  phone         text,
  used_by       text references members(id),
  used_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists invites_group_idx on invites (group_id);

create table if not exists checks (
  id                 text primary key,
  group_id           text not null references groups(id),
  member_id          text not null references members(id),
  objective          text not null,
  post_url           text,
  handle             text,
  caption            text not null,
  score              integer not null,
  decision           text not null check (decision in ('share', 'skip', 'unclear')),
  reason             text not null,
  suggested_comment  text,
  scorer             text not null,
  created_at         timestamptz not null default now()
);
create index if not exists checks_group_created_idx on checks (group_id, created_at desc);
