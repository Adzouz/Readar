-- Onboarding gets a last, skippable "Connect Claude" step (PLAN.md §6). The key itself never
-- reaches the server; only the step the user is on is saved, like the others.
alter table public.profiles drop constraint profiles_setup_step_check;
alter table public.profiles add constraint profiles_setup_step_check
  check (setup_step in ('style', 'topics', 'sources', 'claude', 'done'));
