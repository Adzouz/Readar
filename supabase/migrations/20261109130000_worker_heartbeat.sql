-- The worker records when it last did something, so the app can tell "a fetch is coming" from
-- "nothing is fetching right now" for sources not fetched yet (PLAN.md §11).
create table public.worker_heartbeat (
  id smallint primary key default 1 check (id = 1),
  beat_at timestamptz not null default now()
);

alter table public.worker_heartbeat enable row level security;
revoke all on public.worker_heartbeat from public, anon, authenticated;

-- True while a worker beat in the last 3 minutes. The loop beats at least every minute or so:
-- at the start of each pass, after each batch, and at the end.
create function public.worker_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.worker_heartbeat where beat_at > now() - interval '3 minutes'
  )
$$;

revoke all on function public.worker_active() from public, anon;
grant execute on function public.worker_active() to authenticated;
