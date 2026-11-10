-- Why a working feed brings nothing (PLAN.md §11): the worker records how many entries the feed
-- had and the date of its newest one, so the app can say "Articles too old" or "no articles".
alter table public.sources
  add column feed_entries integer,
  add column newest_entry_at timestamptz;

-- Same as 20261109120000_source_health.sql, plus the two facts above.
drop function public.my_source_health();

create function public.my_source_health()
returns table (
  topic_id text,
  slug text,
  url text,
  fetched_at timestamptz,
  last_status integer,
  last_error text,
  error_count integer,
  items integer,
  latest_item_at timestamptz,
  feed_entries integer,
  newest_entry_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    ts.topic_id, s.slug, null::text, s.last_fetched_at, s.last_status, s.last_error,
    s.error_count, counts.items, counts.latest, s.feed_entries, s.newest_entry_at
  from public.user_topics ut
  join public.topic_sources ts on ts.topic_id = ut.topic_id
  join public.sources s on s.id = ts.source_id and s.slug is not null
  cross join lateral (
    select count(*)::integer as items, max(coalesce(i.published_at, i.fetched_at)) as latest
    from public.item_sources x
    join public.items i on i.id = x.item_id
    where x.source_id = s.id
  ) counts
  where ut.user_id = (select auth.uid())
  union all
  select
    us.topic_id, null::text, us.url, s.last_fetched_at, s.last_status, s.last_error,
    coalesce(s.error_count, 0), coalesce(counts.items, 0), counts.latest, s.feed_entries,
    s.newest_entry_at
  from public.user_sources us
  left join public.sources s on s.url = us.url
  left join lateral (
    select count(*)::integer as items, max(coalesce(i.published_at, i.fetched_at)) as latest
    from public.item_sources x
    join public.items i on i.id = x.item_id
    where x.source_id = s.id
  ) counts on true
  where us.user_id = (select auth.uid())
$$;

revoke all on function public.my_source_health() from public, anon;
grant execute on function public.my_source_health() to authenticated;
