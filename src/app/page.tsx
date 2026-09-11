import Link from "next/link";

const features = [
  {
    title: "Läxor",
    tone: "panel-tint-sky",
    accent: "text-sky",
    body: "Lägg in läxor, fota häftet och håll koll på vad som ska vara klart.",
  },
  {
    title: "Förhör",
    tone: "panel-tint-coral",
    accent: "text-coral",
    body: "Buddie ställer frågor utifrån ditt material — du får tips, inte facit direkt.",
  },
  {
    title: "Glosor",
    tone: "panel-tint-lilac",
    accent: "text-lilac",
    body: "Skapa ordlistor och öva glosor i eget tempo.",
  },
  {
    title: "Anteckningar",
    tone: "panel-tint-brass",
    accent: "text-brass",
    body: "Spara korta anteckningar kopplade till ämnen och läxor.",
  },
  {
    title: "Påminnelser",
    tone: "panel-tint-lilac",
    accent: "text-lilac",
    body: "Sätt påminnelser så du inte missar inlämning eller pluggpass.",
  },
  {
    title: "Repetera",
    tone: "panel-tint-sage",
    accent: "text-sage",
    body: "Se vad du behöver öva mer på under terminen.",
  },
  {
    title: "Resultat",
    tone: "panel-tint-sky",
    accent: "text-sky",
    body: "Spara provresultat och reflektera över vad som gick bra.",
  },
];

export default function LandingPage() {
  return (
    <div className="space-y-10">
      <section className="animate-rise relative overflow-hidden rounded-[1.5rem] border border-[var(--line)] bg-[linear-gradient(145deg,#eef6f0_0%,#f7f3ec_45%,#f3e8e4_100%)] px-6 py-12 sm:px-10 sm:py-16">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-sage/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 left-10 h-48 w-48 rounded-full bg-coral/10 blur-2xl" />
        <div className="relative max-w-xl">
          <p className="font-display text-5xl font-semibold tracking-tight text-ink sm:text-6xl">
            Studdiebuddie
          </p>
          <p className="mt-4 text-base text-ink-soft sm:text-lg">
            Plugghjälpen för dig i åk 5–9. Planera läxor, öva med förhör och håll
            koll på kalendern — allt på ett ställe.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/konto?mode=signup" className="btn-primary">
              Skapa konto
            </Link>
            <Link href="/konto" className="btn-secondary">
              Logga in
            </Link>
          </div>
        </div>
      </section>

      <section className="animate-rise-2 space-y-4">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            Vad kan du göra?
          </h2>
          <p className="mt-1 text-muted">
            Logga in för att använda flikarna. Här är en snabb översikt.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {features.map((f) => (
            <div key={f.title} className={`panel ${f.tone} p-5`}>
              <h3 className={`font-display text-xl font-semibold ${f.accent}`}>
                {f.title}
              </h3>
              <p className="mt-2 text-sm text-ink-soft">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <p className="text-center text-xs text-muted">
        <Link href="/admin" className="hover:text-ink">
          Admin
        </Link>
      </p>
    </div>
  );
}
