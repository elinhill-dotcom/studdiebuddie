-- Återkommande läxor varje vecka (kör i SQL Editor om tabellen redan finns)
alter table public.homeworks
  add column if not exists recurring_weekly boolean not null default false;
