-- The text Claude summarizes for a card, read on the user's device with their own key (PLAN.md
-- §6). Article text lives in the shared items table, which clients can't read: this returns it
-- only for items the user can see, in a followed topic's deck or in their lists.
create function public.summary_input(p_item_id uuid)
returns table (title text, url text, source_name text, text text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    i.title, i.url,
    coalesce(i.publisher, (
      select s.name from public.item_sources x join public.sources s on s.id = x.source_id
      where x.item_id = i.id order by x.seen_at limit 1
    )),
    coalesce(nullif(i.content_text, ''), i.excerpt)
  from public.items i
  where i.id = p_item_id
    and (
      exists (
        select 1 from public.user_items ui
        where ui.user_id = (select auth.uid()) and ui.item_id = i.id
      )
      or exists (
        select 1
        from public.user_topics ut
        cross join lateral public.my_active_sources(ut.topic_id) active(source_id)
        join public.item_sources x on x.source_id = active.source_id
        where ut.user_id = (select auth.uid()) and x.item_id = i.id
      )
    )
$$;

revoke all on function public.summary_input(uuid) from public, anon;
grant execute on function public.summary_input(uuid) to authenticated;
