-- Provplan: flera läxor + länk i påminnelser
alter table public.calendar_events
  add column if not exists homework_ids jsonb not null default '[]'::jsonb;

alter table public.reminders
  add column if not exists link_url text;
