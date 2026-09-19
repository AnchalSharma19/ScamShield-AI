-- ScamShield AI database schema (Supabase / Postgres)
-- Run this in the Supabase SQL editor, or via `supabase db push`.

create extension if not exists "uuid-ossp";
create extension if not exists vector; -- pgvector, used by scam_patterns for RAG

-- users table mirrors auth.users; a row is created by the trigger below on signup.
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  name text,
  avatar_url text,
  zernio_profile_id text unique, -- one Zernio "profile" (workspace) per user, for connected channels
  created_at timestamptz not null default now()
);

create table if not exists public.scam_analyses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users (id) on delete cascade,
  input_type text not null check (input_type in ('text', 'email', 'whatsapp', 'job_offer', 'social_media', 'screenshot', 'url', 'sms')),
  input_text text not null,
  risk_score integer not null check (risk_score between 0 and 100),
  risk_level text not null check (risk_level in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  scam_category text not null,
  summary text,
  created_at timestamptz not null default now()
);

create table if not exists public.risk_indicators (
  id uuid primary key default uuid_generate_v4(),
  analysis_id uuid not null references public.scam_analyses (id) on delete cascade,
  indicator text not null,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  description text,
  score integer not null default 0
);

create table if not exists public.recommendations (
  id uuid primary key default uuid_generate_v4(),
  analysis_id uuid not null references public.scam_analyses (id) on delete cascade,
  recommendation text not null,
  priority integer not null default 0
);

create table if not exists public.url_scans (
  id uuid primary key default uuid_generate_v4(),
  analysis_id uuid not null references public.scam_analyses (id) on delete cascade,
  url text not null,
  domain text,
  https_enabled boolean,
  domain_age integer,
  redirect_count integer,
  reputation text,
  is_suspicious boolean
);

-- Messaging channels a user has connected — via Zernio (WhatsApp, Instagram,
-- Facebook, Telegram, SMS) or directly (Slack, Discord).
create table if not exists public.connected_channels (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users (id) on delete cascade,
  platform text not null check (platform in ('whatsapp', 'instagram', 'facebook', 'telegram', 'sms', 'slack', 'discord')),
  provider_account_id text not null, -- Zernio account id, "teamId:slackUserId" for Slack, or the Discord user id
  channel_id text, -- the platform's own DM-channel id (Slack/Discord only) — lets the inbox routes address the thread directly
  username text,
  display_name text,
  phone_number text,
  status text not null default 'active' check (status in ('active', 'disconnected')),
  connected_at timestamptz not null default now(),
  unique (platform, provider_account_id)
);

-- If you already ran an earlier version of this schema (pre Slack/Discord support), apply this instead of recreating the table:
--   alter table public.connected_channels rename column zernio_account_id to provider_account_id;
--   alter table public.connected_channels add column if not exists channel_id text;
--   alter table public.connected_channels drop constraint if exists connected_channels_platform_check;
--   alter table public.connected_channels add constraint connected_channels_platform_check check (platform in ('whatsapp', 'instagram', 'facebook', 'telegram', 'sms', 'slack', 'discord'));

create index if not exists connected_channels_user_id_idx on public.connected_channels (user_id);

alter table public.connected_channels enable row level security;

create policy "Users can view their own connected channels" on public.connected_channels
  for select using (auth.uid() = user_id);
create policy "Users can delete their own connected channels" on public.connected_channels
  for delete using (auth.uid() = user_id);
create policy "Users can insert their own connected channels" on public.connected_channels
  for insert with check (auth.uid() = user_id);
-- The webhook handler has no user session, so it reads/writes across all users via the service role.

-- Audit + idempotency log for inbound channel messages processed by the bot.
-- A row is inserted (claimed) before the slow analyze step runs and updated
-- (finalized) after, so a redelivered/retried webhook or Gateway event hits
-- the unique constraint below instead of racing a duplicate analysis+reply.
create table if not exists public.channel_messages (
  id uuid primary key default uuid_generate_v4(),
  external_message_id text not null, -- the provider's own message id (Zernio message id, "channel:ts" for Slack, Discord message snowflake) — used for idempotency
  platform_message_id text, -- wamid/mid/etc — what GET /v1/inbox/conversations/{id}/messages (or the Slack/Discord equivalent) returns as its own "id", for joining risk data onto that view
  user_id uuid references public.users (id) on delete cascade,
  platform text not null,
  conversation_id text not null,
  account_id text not null,
  analysis_id uuid references public.scam_analyses (id) on delete set null,
  replied boolean not null default false,
  processed_at timestamptz not null default now(),
  unique (platform, external_message_id)
);

-- If you already ran an earlier version of this schema, apply this instead of recreating the table:
--   alter table public.channel_messages rename column zernio_message_id to external_message_id;
--   alter table public.channel_messages drop constraint if exists channel_messages_zernio_message_id_key;
--   alter table public.channel_messages add constraint channel_messages_platform_external_message_id_key unique (platform, external_message_id);

create index if not exists channel_messages_user_id_idx on public.channel_messages (user_id);
create index if not exists channel_messages_platform_message_id_idx on public.channel_messages (platform_message_id);

alter table public.channel_messages enable row level security;

create policy "Users can view their own channel messages" on public.channel_messages
  for select using (auth.uid() = user_id);

-- Per-channel secrets (e.g. a Slack workspace's bot token). RLS is enabled
-- with NO policies at all, so only the service-role client can ever read or
-- write this table — not even the owning user's own session, unlike
-- connected_channels (which has an owner-SELECT policy and must never hold
-- a live credential as a plain column for that reason).
create table if not exists public.channel_credentials (
  id uuid primary key default uuid_generate_v4(),
  connected_channel_id uuid not null unique references public.connected_channels (id) on delete cascade,
  token text not null,
  created_at timestamptz not null default now()
);

alter table public.channel_credentials enable row level security;

-- Discord connect flow (self-hosted equivalent of Zernio's Telegram access-code flow):
-- the user requests a code in-app, then DMs it to the bot to link their Discord account.
create table if not exists public.discord_link_codes (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique,
  user_id uuid not null references public.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'used', 'expired')),
  discord_user_id text,
  discord_username text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.discord_link_codes enable row level security;
-- No policies here either — the connect/status API routes always use the
-- service-role client, after confirming the caller's own session server-side.

-- Scam pattern library used for RAG similarity search (Prompt 8).
create table if not exists public.scam_patterns (
  id uuid primary key default uuid_generate_v4(),
  category text not null,
  pattern text not null,
  description text,
  embedding vector(768), -- gemini-embedding-001, requested at 768 dims via outputDimensionality
  created_at timestamptz not null default now()
);

-- No ivfflat/HNSW index yet: ivfflat needs a real amount of data to build
-- meaningful clusters (pgvector's own guidance is roughly rows/1000 lists,
-- so `lists = 100` needs ~100k+ rows to behave correctly) — with a
-- starter-sized pattern library, an ivfflat index returns WRONG nearest
-- neighbors, not just slow ones. match_scam_patterns() does an exact scan
-- until then, which is plenty fast below a few hundred thousand rows. Add
-- an index (ivfflat with lists sized to the row count, or HNSW) once the
-- library actually grows that large.

create index if not exists scam_analyses_user_id_idx on public.scam_analyses (user_id);
create index if not exists risk_indicators_analysis_id_idx on public.risk_indicators (analysis_id);
create index if not exists recommendations_analysis_id_idx on public.recommendations (analysis_id);
create index if not exists url_scans_analysis_id_idx on public.url_scans (analysis_id);

-- Auto-create a public.users row whenever someone signs up via Supabase Auth.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'avatar_url')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Row Level Security: every user can only see/manage their own analyses.
alter table public.users enable row level security;
alter table public.scam_analyses enable row level security;
alter table public.risk_indicators enable row level security;
alter table public.recommendations enable row level security;
alter table public.url_scans enable row level security;
alter table public.scam_patterns enable row level security;

create policy "Users can view their own profile" on public.users
  for select using (auth.uid() = id);
create policy "Users can update their own profile" on public.users
  for update using (auth.uid() = id);

create policy "Users can view their own analyses" on public.scam_analyses
  for select using (auth.uid() = user_id);
create policy "Users can insert their own analyses" on public.scam_analyses
  for insert with check (auth.uid() = user_id);
create policy "Users can delete their own analyses" on public.scam_analyses
  for delete using (auth.uid() = user_id);

create policy "Users can view indicators for their analyses" on public.risk_indicators
  for select using (
    exists (select 1 from public.scam_analyses a where a.id = analysis_id and a.user_id = auth.uid())
  );
create policy "Users can insert indicators for their analyses" on public.risk_indicators
  for insert with check (
    exists (select 1 from public.scam_analyses a where a.id = analysis_id and a.user_id = auth.uid())
  );

create policy "Users can view recommendations for their analyses" on public.recommendations
  for select using (
    exists (select 1 from public.scam_analyses a where a.id = analysis_id and a.user_id = auth.uid())
  );
create policy "Users can insert recommendations for their analyses" on public.recommendations
  for insert with check (
    exists (select 1 from public.scam_analyses a where a.id = analysis_id and a.user_id = auth.uid())
  );

create policy "Users can view url scans for their analyses" on public.url_scans
  for select using (
    exists (select 1 from public.scam_analyses a where a.id = analysis_id and a.user_id = auth.uid())
  );
create policy "Users can insert url scans for their analyses" on public.url_scans
  for insert with check (
    exists (select 1 from public.scam_analyses a where a.id = analysis_id and a.user_id = auth.uid())
  );

-- scam_patterns is a shared read-only reference table; only the service role writes to it.
create policy "Anyone can read scam patterns" on public.scam_patterns
  for select using (true);

-- Similarity search RPC used by the RAG pipeline (Prompt 8).
create or replace function public.match_scam_patterns(
  query_embedding vector(768),
  match_threshold float default 0.75,
  match_count int default 5
)
returns table (id uuid, category text, pattern text, description text, similarity float)
language sql stable
as $$
  select
    sp.id,
    sp.category,
    sp.pattern,
    sp.description,
    1 - (sp.embedding <=> query_embedding) as similarity
  from public.scam_patterns sp
  where 1 - (sp.embedding <=> query_embedding) > match_threshold
  order by sp.embedding <=> query_embedding
  limit match_count;
$$;
