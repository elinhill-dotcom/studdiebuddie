-- PDF-stöd för läxor (kör i SQL Editor om tabellen redan finns)
alter table public.homeworks
  add column if not exists pdf_path text,
  add column if not exists pdf_file_name text;
