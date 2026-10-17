-- Idempotent schema; run with `npm run db:migrate -w @boranois/api`.
-- Nothing here identifies the pessoas: their names, phones and notes stay on the member's device.

create table if not exists groups (
  id          text primary key,
  created_at  timestamptz not null default now()
);

create table if not exists members (
  id          text primary key,
  group_id    text not null references groups(id),
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

create table if not exists contacts (
  id                 text primary key,
  member_id          text not null references members(id),
  group_id           text not null references groups(id),
  chips              jsonb not null,
  persona_id         text not null,
  match              jsonb not null,
  priority           jsonb not null,
  state              text not null,
  steps_done         jsonb not null default '[]',
  last_saying        text,
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
