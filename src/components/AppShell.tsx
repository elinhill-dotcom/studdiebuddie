"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthProvider, useAuth } from "@/components/AuthProvider";
import { ReminderWatcher } from "@/components/ReminderWatcher";

const links = [
  { href: "/hem", label: "Hem", tone: "bg-sage-soft text-sage" },
  { href: "/laxor", label: "Läxor", tone: "bg-sky-soft text-sky" },
  { href: "/forhor", label: "Förhör", tone: "bg-coral-soft text-coral" },
  { href: "/glosor", label: "Glosor", tone: "bg-lilac-soft text-lilac" },
  { href: "/anteckningar", label: "Anteckningar", tone: "bg-brass-soft text-brass" },
  { href: "/paminnelser", label: "Påminnelser", tone: "bg-lilac-soft text-lilac" },
  { href: "/sammanfatta", label: "Repetera", tone: "bg-sage-soft text-sage" },
  { href: "/resultat", label: "Resultat", tone: "bg-sky-soft text-sky" },
];

function ShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading, syncing, signOut } = useAuth();
  const isAdmin = pathname.startsWith("/admin");
  const showAppNav = Boolean(user) && !isAdmin;

  return (
    <div className="flex min-h-screen flex-col">
      {user && <ReminderWatcher />}
      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[rgba(246,243,238,0.9)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <Link
              href={user ? "/hem" : "/"}
              className="group inline-flex items-center transition hover:opacity-90"
            >
              <Image
                src="/logo.png"
                alt="Studdiebuddie"
                width={280}
                height={130}
                className="h-11 w-auto sm:h-12"
                priority
              />
            </Link>
            <div className="flex items-center gap-2">
              {!isAdmin && (
                <>
                  <Link
                    href="/konto"
                    className="nav-pill bg-white/70 text-ink-soft hover:bg-white"
                  >
                    {loading
                      ? "…"
                      : user
                        ? syncing
                          ? "Synkar…"
                          : "Konto"
                        : "Logga in"}
                  </Link>
                  {user && (
                    <button
                      type="button"
                      className="nav-pill bg-coral-soft/80 text-coral hover:bg-coral-soft"
                      onClick={async () => {
                        await signOut();
                        window.location.href = "/";
                      }}
                    >
                      Logga ut
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {showAppNav && (
            <nav
              className="flex flex-wrap items-center gap-1.5"
              aria-label="Huvudmeny"
            >
              {links.map((l) => {
                const active =
                  l.href === "/hem"
                    ? pathname === "/hem"
                    : pathname.startsWith(l.href);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={`nav-pill ${
                      active
                        ? `${l.tone} ring-1 ring-black/5`
                        : "bg-white/70 text-ink-soft hover:bg-white"
                    }`}
                  >
                    {l.label}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-10 sm:px-5 sm:py-8">
        {children}
      </main>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ShellInner>{children}</ShellInner>
    </AuthProvider>
  );
}
