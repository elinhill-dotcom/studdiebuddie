# Studdiebuddie × Supabase

## 1. Skapa projekt
1. Gå till https://supabase.com och skapa ett projekt
2. Under **Project Settings → API** kopiera:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 2. Kör databasen
1. Öppna **SQL Editor** i Supabase
2. Klistra in hela innehållet från `schema.sql` och kör det
3. Det skapar tabeller, RLS-policies och storage-bucket `homework-photos`

## 3. Auth-inställningar
1. **Authentication → Providers**: behåll Email på
2. För enklare test: **Authentication → Providers → Email** → stäng av "Confirm email" tillfälligt
3. **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/auth/callback`

## 4. Appen
Lägg nycklarna i `.env.local` och starta om `npm run dev`.
Öppna **Logga in** (`/konto`).

När du är inloggad sparas läxor (inkl. foton), anteckningar, kalender, glosor m.m. automatiskt i molnet.

## 5. Admin
I `.env.local` (och Vercel Environment Variables):

```env
ADMIN_PASSWORD=Studdiebuddieadmin
SUPABASE_SERVICE_ROLE_KEY=din_service_role_nyckel
```

`service_role` hittar du under **Project Settings → API** (Secret). Den får aldrig exponeras i frontend.

Admin-sida: `/admin`

## 6. PDF-stöd
Om databasen redan körts utan PDF-kolumner, kör även `pdf-migration.sql` i SQL Editor.

## 7. Provplan + påminnelser
Kör `exam-plan-migration.sql` för kolumnerna `homework_ids` och `link_url`.

Pushnotiser i mobilen: lägg till Studdiebuddie på hemskärmen (PWA), tillåt notiser när appen frågar, och håll appen installerad. Påminnelserna skickas via service worker när tiden är inne.
