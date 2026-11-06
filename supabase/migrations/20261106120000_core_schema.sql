-- Readar core schema (PLAN.md §8).
--
-- Access model:
--   * Shared content (topics, sources, items) is written by the worker, which connects as the
--     database owner. Clients never read those tables directly: they go through the
--     security-definer functions `deck` and `list_items`, which only return what the signed-in
--     user follows. That keeps the links a user added (possibly private feeds) to themselves.
--   * Per-user tables (profiles, user_topics, user_sources, user_items, summaries) are read and
--     written by the client under RLS: a user only sees and changes their own rows.
--   * The project does not expose new tables automatically, so every grant is explicit.

-- Embeddings (ranking) come in a later migration once the embedding model is chosen.
create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------------------------
-- Shared content
-- ---------------------------------------------------------------------------------------------

create table public.topics (
  id text primary key,
  kind text not null check (kind in ('catalog', 'keyword')),
  name text not null,
  -- The watched keyword, for kind = 'keyword'.
  keyword text,
  created_at timestamptz not null default now()
);

comment on table public.topics is
  'Catalog topics (seeded by the worker from @readar/core) and keyword watches users follow.';

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  -- Catalog source id or keyword search id (gnews:<kw>, hn:<kw>). Null for links users added.
  slug text unique,
  -- The feed URL, or the link a user added.
  url text not null unique,
  -- The feed actually read. Null until the worker finds the feed of a user link.
  feed_url text,
  kind text not null check (kind in ('feed', 'youtube', 'podcast', 'search', 'link')),
  name text not null,
  site text not null,
  etag text,
  last_modified text,
  next_fetch_at timestamptz not null default now(),
  fetch_interval interval not null default interval '30 minutes',
  last_fetched_at timestamptz,
  last_status integer,
  last_error text,
  error_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index sources_next_fetch_at_idx on public.sources (next_fetch_at);

create table public.topic_sources (
  topic_id text not null references public.topics (id) on delete cascade,
  source_id uuid not null references public.sources (id) on delete cascade,
  primary key (topic_id, source_id)
);

create index topic_sources_source_id_idx on public.topic_sources (source_id);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  -- sha256 of the canonical URL (@readar/core canonicalUrl); the dedupe key.
  url_hash text not null unique,
  title text not null,
  author text,
  published_at timestamptz,
  fetched_at timestamptz not null default now(),
  image_url text,
  excerpt text,
  -- Extracted article text, kept only until it has been summarized (retention to set).
  content_text text,
  content_type text not null default 'article'
    check (content_type in ('article', 'video', 'thread', 'podcast')),
  language text,
  reading_minutes integer,
  -- Site that published it, for items found through search feeds that mix many sites.
  publisher text
);

create index items_recency_idx on public.items ((coalesce(published_at, fetched_at)) desc);

-- The same article can come from several sources ("also covered by").
create table public.item_sources (
  item_id uuid not null references public.items (id) on delete cascade,
  source_id uuid not null references public.sources (id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (item_id, source_id)
);

create index item_sources_source_id_idx on public.item_sources (source_id, item_id);

-- Other links that lead to an item (a Google News wrapper link, for instance), so the worker
-- recognizes them without decoding them again.
create table public.item_aliases (
  alias_hash text primary key,
  item_id uuid not null references public.items (id) on delete cascade
);

create index item_aliases_item_id_idx on public.item_aliases (item_id);

alter table public.topics enable row level security;
alter table public.sources enable row level security;
alter table public.topic_sources enable row level security;
alter table public.items enable row level security;
alter table public.item_sources enable row level security;
alter table public.item_aliases enable row level security;
-- No policies and no grants: clients reach shared content only through the functions below.
-- Revoke anyway in case the project's default privileges still expose new tables.
revoke all on public.topics, public.sources, public.topic_sources, public.items,
  public.item_sources, public.item_aliases from anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Per-user data
-- ---------------------------------------------------------------------------------------------

create table public.profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  style text check (style in ('glass', 'editorial', 'playful')),
  mode text check (mode in ('system', 'light', 'dark')),
  setup_step text not null default 'style'
    check (setup_step in ('style', 'topics', 'sources', 'done')),
  setup_completed boolean not null default false,
  -- Suggested sources (catalog or keyword search slugs) the user switched off.
  disabled_source_ids text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table public.user_topics (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Catalog topic id, or kw-<slug> for a keyword watch. The worker creates keyword topics.
  topic_id text not null,
  keyword text,
  position integer not null,
  primary key (user_id, topic_id)
);

create index user_topics_topic_id_idx on public.user_topics (topic_id);

-- Links a user added to a topic. The worker turns each URL into a source.
create table public.user_sources (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  topic_id text not null,
  url text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, topic_id, url)
);

create index user_sources_url_idx on public.user_sources (url);

-- What the user did with each item. No row means the item is still in their deck.
create table public.user_items (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete cascade,
  topic_id text not null,
  state text not null check (state in ('liked', 'later', 'dismissed', 'read')),
  decided_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create index user_items_state_idx on public.user_items (user_id, state, decided_at);

-- Summaries written on the user's device with their own Claude key. Private to that user.
create table public.summaries (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete cascade,
  prompt_version integer not null,
  model text not null,
  tldr text not null,
  points text[] not null default '{}',
  content_type text,
  reading_minutes integer,
  created_at timestamptz not null default now(),
  primary key (user_id, item_id, prompt_version)
);

create index summaries_item_id_idx on public.summaries (item_id);

alter table public.profiles enable row level security;
alter table public.user_topics enable row level security;
alter table public.user_sources enable row level security;
alter table public.user_items enable row level security;
alter table public.summaries enable row level security;

create policy "Own profile" on public.profiles for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own topics" on public.user_topics for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own sources" on public.user_sources for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own items" on public.user_items for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own summaries" on public.summaries for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.profiles, public.user_topics, public.user_sources, public.user_items,
  public.summaries from anon;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.user_topics to authenticated;
grant select, insert, update, delete on public.user_sources to authenticated;
grant select, insert, update, delete on public.user_items to authenticated;
grant select, insert, update, delete on public.summaries to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Functions the client calls
-- ---------------------------------------------------------------------------------------------

-- The user's whole setup in one call: theme, onboarding state, topics, links.
create function public.get_setup()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'profile', (
      select to_jsonb(p) - 'user_id' from public.profiles p where p.user_id = (select auth.uid())
    ),
    'topics', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.topic_id, 'keyword', t.keyword) order by t.position)
      from public.user_topics t where t.user_id = (select auth.uid())
    ), '[]'::jsonb),
    'sources', coalesce((
      select jsonb_agg(jsonb_build_object('topicId', s.topic_id, 'url', s.url) order by s.created_at)
      from public.user_sources s where s.user_id = (select auth.uid())
    ), '[]'::jsonb)
  )
$$;

-- Replaces the user's setup atomically. Payload:
--   { style, mode, step, completed, disabledSourceIds: [..],
--     topics: [{ id, keyword? }], sources: [{ topicId, url }] }
create function public.save_setup(payload jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  insert into public.profiles as p
    (user_id, style, mode, setup_step, setup_completed, disabled_source_ids, updated_at)
  values (
    uid,
    payload ->> 'style',
    payload ->> 'mode',
    coalesce(payload ->> 'step', 'style'),
    coalesce((payload ->> 'completed')::boolean, false),
    coalesce(
      array(select jsonb_array_elements_text(coalesce(payload -> 'disabledSourceIds', '[]'))),
      '{}'
    ),
    now()
  )
  on conflict (user_id) do update set
    style = excluded.style,
    mode = excluded.mode,
    setup_step = excluded.setup_step,
    setup_completed = excluded.setup_completed,
    disabled_source_ids = excluded.disabled_source_ids,
    updated_at = excluded.updated_at;

  delete from public.user_topics where user_id = uid;
  insert into public.user_topics (user_id, topic_id, keyword, position)
  select uid, t ->> 'id', nullif(t ->> 'keyword', ''), (ord - 1)::integer
  from jsonb_array_elements(coalesce(payload -> 'topics', '[]')) with ordinality as x (t, ord)
  where coalesce(t ->> 'id', '') <> ''
  on conflict do nothing;

  delete from public.user_sources where user_id = uid;
  insert into public.user_sources (user_id, topic_id, url)
  select uid, s ->> 'topicId', s ->> 'url'
  from jsonb_array_elements(coalesce(payload -> 'sources', '[]')) as x (s)
  where coalesce(s ->> 'topicId', '') <> '' and coalesce(s ->> 'url', '') <> ''
  on conflict do nothing;
end
$$;

-- Sources the signed-in user reads for a topic: the topic's sources they didn't switch off,
-- plus the links they added to it. Empty when they don't follow the topic.
create function public.my_active_sources(p_topic_id text)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id
  from public.topic_sources ts
  join public.sources s on s.id = ts.source_id
  where ts.topic_id = p_topic_id
    and exists (
      select 1 from public.user_topics ut
      where ut.user_id = (select auth.uid()) and ut.topic_id = p_topic_id
    )
    and not coalesce(
      s.slug = any (
        select unnest(p.disabled_source_ids) from public.profiles p
        where p.user_id = (select auth.uid())
      ),
      false
    )
  union
  select s.id
  from public.user_sources us
  join public.sources s on s.url = us.url
  where us.user_id = (select auth.uid()) and us.topic_id = p_topic_id
$$;

-- Cards still to review in a topic, newest first. Ranking replaces the order once embeddings land.
create function public.deck(p_topic_id text, p_limit integer default 30)
returns table (
  id uuid,
  url text,
  title text,
  author text,
  published_at timestamptz,
  image_url text,
  excerpt text,
  content_type text,
  reading_minutes integer,
  source_name text,
  coverage integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with active as (select public.my_active_sources(p_topic_id) as source_id)
  select
    i.id, i.url, i.title, i.author, i.published_at, i.image_url, i.excerpt, i.content_type,
    i.reading_minutes,
    coalesce(i.publisher, (
      select s.name from public.item_sources x join public.sources s on s.id = x.source_id
      where x.item_id = i.id and x.source_id in (select source_id from active)
      order by x.seen_at limit 1
    )),
    (select count(*)::integer from public.item_sources x where x.item_id = i.id)
  from public.items i
  where exists (
      select 1 from public.item_sources x
      where x.item_id = i.id and x.source_id in (select source_id from active)
    )
    and not exists (
      select 1 from public.user_items ui
      where ui.user_id = (select auth.uid()) and ui.item_id = i.id
    )
  order by coalesce(i.published_at, i.fetched_at) desc
  limit least(greatest(p_limit, 1), 100)
$$;

-- Items in the user's lists (liked, read later, dismissed), oldest decision first.
create function public.list_items()
returns table (
  id uuid,
  url text,
  title text,
  author text,
  published_at timestamptz,
  image_url text,
  excerpt text,
  content_type text,
  reading_minutes integer,
  source_name text,
  coverage integer,
  topic_id text,
  state text,
  decided_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    i.id, i.url, i.title, i.author, i.published_at, i.image_url, i.excerpt, i.content_type,
    i.reading_minutes,
    coalesce(i.publisher, (
      select s.name from public.item_sources x join public.sources s on s.id = x.source_id
      where x.item_id = i.id order by x.seen_at limit 1
    )),
    (select count(*)::integer from public.item_sources x where x.item_id = i.id),
    ui.topic_id, ui.state, ui.decided_at
  from public.user_items ui
  join public.items i on i.id = ui.item_id
  where ui.user_id = (select auth.uid()) and ui.state in ('liked', 'later', 'dismissed')
  order by ui.decided_at
$$;

revoke all on function public.get_setup() from public, anon;
revoke all on function public.save_setup(jsonb) from public, anon;
revoke all on function public.my_active_sources(text) from public, anon, authenticated;
revoke all on function public.deck(text, integer) from public, anon;
revoke all on function public.list_items() from public, anon;

grant execute on function public.get_setup() to authenticated;
grant execute on function public.save_setup(jsonb) to authenticated;
grant execute on function public.deck(text, integer) to authenticated;
grant execute on function public.list_items() to authenticated;
