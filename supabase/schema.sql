-- Studdiebuddie × Supabase
-- Kör detta i Supabase SQL Editor (Dashboard → SQL → New query)

-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Buddie',
  home_modules jsonb not null default '["shortcuts","calendar","homework","reminders","focus"]'::jsonb,
  notifications_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', 'Buddie')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Homeworks
create table if not exists public.homeworks (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  subject text not null,
  due_date date not null,
  status text not null default 'todo',
  description text not null default '',
  help_needed text not null default '',
  page_hints text not null default '',
  photo_path text,
  pdf_path text,
  pdf_file_name text,
  extracted_text text not null default '',
  reminder_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists homeworks_user_id_idx on public.homeworks (user_id);
alter table public.homeworks enable row level security;

create policy "homeworks_select_own" on public.homeworks
  for select using (auth.uid() = user_id);
create policy "homeworks_insert_own" on public.homeworks
  for insert with check (auth.uid() = user_id);
create policy "homeworks_update_own" on public.homeworks
  for update using (auth.uid() = user_id);
create policy "homeworks_delete_own" on public.homeworks
  for delete using (auth.uid() = user_id);

-- Notes
create table if not exists public.notes (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body text not null default '',
  subject text,
  homework_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notes enable row level security;
create policy "notes_all_own" on public.notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Calendar events
create table if not exists public.calendar_events (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  type text not null,
  date date not null,
  time text,
  subject text,
  notes text,
  homework_id uuid,
  homework_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.calendar_events enable row level security;
create policy "calendar_all_own" on public.calendar_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Reminders
create table if not exists public.reminders (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  message text not null default '',
  at timestamptz not null,
  enabled boolean not null default true,
  notified boolean not null default false,
  event_id uuid,
  homework_id uuid,
  link_url text,
  created_at timestamptz not null default now()
);

alter table public.reminders enable row level security;
create policy "reminders_all_own" on public.reminders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Vocab lists
create table if not exists public.vocab_lists (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  language_from text not null default 'engelska',
  language_to text not null default 'svenska',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vocab_lists enable row level security;
create policy "vocab_lists_all_own" on public.vocab_lists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.vocab_pairs (
  id uuid primary key,
  list_id uuid not null references public.vocab_lists (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  term text not null default '',
  translation text not null default ''
);

alter table public.vocab_pairs enable row level security;
create policy "vocab_pairs_all_own" on public.vocab_pairs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Quiz sessions (JSON for questions/answers)
create table if not exists public.quiz_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  homework_ids jsonb not null default '[]'::jsonb,
  vocab_list_id uuid,
  mode text not null,
  title text not null,
  questions jsonb not null default '[]'::jsonb,
  answers jsonb not null default '[]'::jsonb,
  started_at timestamptz not null,
  finished_at timestamptz,
  score_percent int
);

alter table public.quiz_sessions enable row level security;
create policy "quiz_sessions_all_own" on public.quiz_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Exam results
create table if not exists public.exam_results (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  subject text not null,
  date date not null,
  score_percent int not null default 0,
  reflection text not null default '',
  weak_topics jsonb not null default '[]'::jsonb,
  related_homework_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.exam_results enable row level security;
create policy "exam_results_all_own" on public.exam_results
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Storage bucket for homework photos
insert into storage.buckets (id, name, public)
values ('homework-photos', 'homework-photos', false)
on conflict (id) do nothing;

create policy "homework_photos_select_own"
on storage.objects for select
using (
  bucket_id = 'homework-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "homework_photos_insert_own"
on storage.objects for insert
with check (
  bucket_id = 'homework-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "homework_photos_update_own"
on storage.objects for update
using (
  bucket_id = 'homework-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "homework_photos_delete_own"
on storage.objects for delete
using (
  bucket_id = 'homework-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);
