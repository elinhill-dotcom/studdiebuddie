"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { HomeModuleId } from "@/lib/types";
import { DEFAULT_HOME_MODULES, HOME_MODULE_META } from "@/lib/types";
import { setHomeModules } from "@/lib/store";
import { notifyDataChanged } from "@/components/useAppData";

const ALL: HomeModuleId[] = [...DEFAULT_HOME_MODULES];

const dots: Record<HomeModuleId, string> = {
  shortcuts: "bg-coral",
  calendar: "bg-sky",
  homework: "bg-sage",
  reminders: "bg-lilac",
  focus: "bg-brass",
};

export function ModulePicker({
  active,
  onChange,
}: {
  active: HomeModuleId[];
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  const placeMenu = () => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      top: r.bottom + 8,
      right: window.innerWidth - r.right,
    });
  };

  useEffect(() => {
    if (!open) return;
    placeMenu();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onScroll = () => placeMenu();
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onScroll);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const toggle = (id: HomeModuleId) => {
    const next = active.includes(id)
      ? active.filter((m) => m !== id)
      : [...active, id];
    const safe = next.length === 0 ? (["shortcuts"] as HomeModuleId[]) : next;
    const ordered = ALL.filter((m) => safe.includes(m));
    setHomeModules(ordered);
    notifyDataChanged();
    onChange();
  };

  const menu =
    open && mounted
      ? createPortal(
          <>
            <button
              type="button"
              className="fixed inset-0 z-[200] cursor-default bg-ink/15"
              aria-label="Stäng"
              onClick={() => setOpen(false)}
            />
            <div
              className="fixed z-[210] w-64 rounded-2xl border border-[var(--line)] bg-white p-3 shadow-xl"
              style={{ top: pos.top, right: pos.right }}
              role="dialog"
              aria-label="Visa moduler"
            >
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Visa moduler
              </p>
              <ul className="space-y-1">
                {ALL.map((id) => {
                  const on = active.includes(id);
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() => toggle(id)}
                        className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm transition ${
                          on ? "bg-sage-soft/70" : "hover:bg-pearl"
                        }`}
                      >
                        <span className={`module-dot ${dots[id]}`} />
                        <span className="flex-1">
                          <span className="font-medium">
                            {HOME_MODULE_META[id].label}
                          </span>
                          <span className="block text-xs text-muted">
                            {HOME_MODULE_META[id].hint}
                          </span>
                        </span>
                        <span
                          className={`text-xs font-semibold ${
                            on ? "text-sage" : "text-muted"
                          }`}
                        >
                          {on ? "På" : "Av"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                className="btn-ghost mt-2 w-full text-xs"
                onClick={() => setOpen(false)}
              >
                Stäng
              </button>
            </div>
          </>,
          document.body,
        )
      : null;

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        className="btn-secondary text-sm"
        onClick={() => {
          if (!open) placeMenu();
          setOpen((v) => !v);
        }}
        aria-expanded={open}
      >
        Anpassa startsida
      </button>
      {menu}
    </div>
  );
}
