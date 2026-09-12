"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useAppData, notifyDataChanged } from "@/components/useAppData";
import { HomeworkCard } from "@/components/HomeworkCard";
import { HomeCalendar } from "@/components/HomeCalendar";
import { ModulePicker } from "@/components/ModulePicker";
import { weakTopicsFromResults } from "@/lib/helpers";
import { ensureHomeworkOnCalendar, setProfileName } from "@/lib/store";
import type { HomeModuleId } from "@/lib/types";
import { DEFAULT_HOME_MODULES } from "@/lib/types";

export default function HomePage() {
  const { data, ready, refresh } = useAppData();
  const { user } = useAuth();
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  // Spegla befintliga läxor in i kalendern (fristående läxhändelser)
  useEffect(() => {
    if (!ready || !user) return;
    let changed = false;
    for (const hw of data.homeworks) {
      if (hw.status === "done") continue;
      const has = data.calendarEvents.some(
        (e) => e.homeworkId === hw.id && e.type === "homework",
      );
      if (!has) {
        ensureHomeworkOnCalendar(hw);
        changed = true;
      }
    }
    if (changed) {
      notifyDataChanged();
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- kör när data är redo / user byts
  }, [ready, user?.id]);

  if (!ready) {
    return <p className="text-muted">Laddar…</p>;
  }

  const metaName = String(user?.user_metadata?.display_name || "").trim();
  const greetingName =
    data.profileName && data.profileName !== "Buddie"
      ? data.profileName
      : metaName || data.profileName || "där";

  const modules: HomeModuleId[] =
    data.homeModules?.length > 0 ? data.homeModules : DEFAULT_HOME_MODULES;
  const show = (id: HomeModuleId) => modules.includes(id);

  const open = data.homeworks.filter((h) => h.status !== "done");
  const weak = weakTopicsFromResults(data.examResults, data.quizSessions);
  const upcomingReminders = data.reminders
    .filter((r) => r.enabled && !r.notified)
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(0, 3);

  const saveName = () => {
    setProfileName(nameDraft);
    notifyDataChanged();
    refresh();
    setEditingName(false);
  };

  return (
    <div className="space-y-6">
      <section className="animate-rise flex flex-wrap items-start justify-between gap-4">
        <div>
          {editingName ? (
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                saveName();
              }}
            >
              <span className="font-logo text-4xl font-semibold text-ink sm:text-5xl">
                Hej
              </span>
              <input
                className="input-field font-logo max-w-[12rem] text-2xl font-semibold sm:text-3xl"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                autoFocus
                placeholder="ditt namn"
              />
              <button type="submit" className="btn-primary text-sm">
                Spara
              </button>
              <button
                type="button"
                className="btn-ghost text-sm"
                onClick={() => setEditingName(false)}
              >
                Avbryt
              </button>
            </form>
          ) : (
            <button
              type="button"
              className="group text-left"
              onClick={() => {
                setNameDraft(greetingName === "där" ? "" : greetingName);
                setEditingName(true);
              }}
              title="Byt namn"
            >
              <h1 className="font-logo text-4xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-5xl">
                Hej <span className="text-sage">{greetingName}</span>!
              </h1>
            </button>
          )}
          <p className="mt-2 max-w-sm text-sm text-ink-soft sm:text-base">
            Vad vill du göra idag? Välj här nedanför. I kalendern ser du när läxorna ska vara klara.
          </p>
        </div>
        <ModulePicker active={modules} onChange={refresh} />
      </section>

      {show("shortcuts") && (
        <section className="animate-rise-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { href: "/laxor/ny", label: "Lägg till läxa", hint: "Fota eller skriv in din läxa.", tint: "panel-tint-sage", accent: "text-sage" },
            { href: "/forhor", label: "Träna läxan", hint: "Chatta, gör övningsprov eller frågekort.", tint: "panel-tint-coral", accent: "text-coral" },
            { href: "/glosor", label: "Spela med glosor", hint: "Vanligt glosförhör och tre spel.", tint: "panel-tint-lilac", accent: "text-lilac" },
            { href: "/paminnelser", label: "Påminn mig", hint: "Välj vad du vill komma ihåg och när.", tint: "panel-tint-brass", accent: "text-brass" },
          ].map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className={`panel ${s.tint} px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-md`}
            >
              <p className={`font-display text-lg font-semibold ${s.accent}`}>
                {s.label}
              </p>
              <p className="mt-1 text-sm text-ink-soft">{s.hint}</p>
            </Link>
          ))}
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        {show("calendar") && (
          <div className="animate-rise-2">
            <HomeCalendar
              events={data.calendarEvents}
              homeworks={data.homeworks}
              reminders={data.reminders}
              onChange={refresh}
            />
          </div>
        )}

        <div className="space-y-4">
          {show("reminders") && (
            <section className="panel panel-tint-lilac animate-rise-3 p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="module-dot bg-lilac" />
                  <h2 className="font-display text-lg font-semibold">Påminnelser</h2>
                </div>
                <Link href="/paminnelser" className="text-xs font-semibold text-lilac">
                  Visa alla
                </Link>
              </div>
              {upcomingReminders.length === 0 ? (
                <p className="text-sm text-muted">Inga kommande just nu.</p>
              ) : (
                <ul className="space-y-1.5">
                  {upcomingReminders.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between gap-2 rounded-lg bg-white/70 px-3 py-2 text-sm"
                    >
                      <span className="font-medium">{r.title}</span>
                      <span className="shrink-0 text-xs text-muted">
                        {new Date(r.at).toLocaleString("sv-SE", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {show("homework") && (
            <section className="animate-rise-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="module-dot bg-sage" />
                  <h2 className="font-display text-lg font-semibold">Läxor</h2>
                </div>
                <Link href="/laxor" className="text-xs font-semibold text-sage">
                  Alla
                </Link>
              </div>
              {open.length === 0 ? (
                <div className="panel panel-tint-sage px-4 py-5 text-center">
                  <p className="text-sm text-muted">Inga öppna läxor.</p>
                  <Link href="/laxor/ny" className="btn-primary mt-3 inline-flex text-sm">
                    Ny läxa
                  </Link>
                </div>
              ) : (
                <div className="grid gap-2">
                  {open.slice(0, 3).map((hw) => (
                    <HomeworkCard key={hw.id} hw={hw} />
                  ))}
                </div>
              )}
            </section>
          )}

          {show("focus") && weak.length > 0 && (
            <section className="panel panel-tint-brass p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="module-dot bg-brass" />
                <h2 className="font-display text-lg font-semibold">Träna lite extra</h2>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {weak.map((w) => (
                  <span
                    key={w.topic}
                    className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-medium text-ink-soft"
                  >
                    {w.topic}
                  </span>
                ))}
              </div>
              <Link href="/sammanfatta" className="btn-secondary mt-3 inline-flex text-sm">
                Repetera
              </Link>
            </section>
          )}
        </div>
      </div>

      {!show("calendar") && show("homework") === false && show("reminders") === false && (
        <p className="text-center text-sm text-muted">
          Välj vad du vill se med knappen Anpassa startsida.
        </p>
      )}
    </div>
  );
}
