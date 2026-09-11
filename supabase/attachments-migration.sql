-- Flera bilagor per läxa (kör i SQL Editor om tabellen redan finns)
alter table public.homeworks
  add column if not exists attachments jsonb not null default '[]'::jsonb;
