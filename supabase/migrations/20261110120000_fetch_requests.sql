-- "Fetch now" after the user adds sources (PLAN.md §11): the app asks, the worker wakes within
-- seconds instead of waiting for its next minute, and the app watches until the pass is done.
-- One row per user: a newer request replaces the older one.
create table public.fetch_requests (
  user_id uuid primary key references auth.users (id) on delete cascade,
  requested_at timestamptz not null default now(),
  done_at timestamptz
);

alter table public.fetch_requests enable row level security;
revoke all on public.fetch_requests from public, anon, authenticated;

-- Asks the worker for a pass over the user's sources. Returns when the request was recorded.
create function public.request_fetch()
returns timestamptz
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.fetch_requests (user_id, requested_at, done_at)
  values ((select auth.uid()), now(), null)
  on conflict (user_id) do update set requested_at = excluded.requested_at, done_at = null
  returning requested_at
$$;

-- Where the user's last request stands, and whether a worker is running to answer it.
create function public.fetch_status()
returns table (requested_at timestamptz, done_at timestamptz, worker_active boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select r.requested_at, r.done_at, public.worker_active()
  from (select (select auth.uid()) as user_id) me
  left join public.fetch_requests r on r.user_id = me.user_id
$$;

revoke all on function public.request_fetch() from public, anon;
revoke all on function public.fetch_status() from public, anon;
grant execute on function public.request_fetch() to authenticated;
grant execute on function public.fetch_status() to authenticated;
