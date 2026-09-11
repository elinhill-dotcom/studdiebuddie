"use client";

import { useState } from "react";
import { notifyDataChanged, useAppData } from "@/components/useAppData";
import { deleteNote, upsertNote } from "@/lib/store";
import type { Note } from "@/lib/types";

export default function AnteckningarPage() {
  const { data, ready, refresh } = useAppData();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  if (!ready) return <p className="text-muted">Laddar…</p>;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() && !body.trim()) return;
    const now = new Date().toISOString();
    const note: Note = {
      id: editingId || crypto.randomUUID(),
      title: title.trim() || "Anteckning",
      body: body.trim(),
      createdAt: editingId
        ? data.notes.find((n) => n.id === editingId)?.createdAt || now
        : now,
      updatedAt: now,
    };
    upsertNote(note);
    notifyDataChanged();
    refresh();
    setTitle("");
    setBody("");
    setEditingId(null);
  };

  const edit = (n: Note) => {
    setEditingId(n.id);
    setTitle(n.title);
    setBody(n.body);
  };

  const remove = (id: string) => {
    deleteNote(id);
    notifyDataChanged();
    refresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight sm:text-4xl">
          Anteckningar
        </h1>
        <p className="mt-1 text-muted">Skriv ner det du vill komma ihåg.</p>
      </div>

      <form onSubmit={save} className="panel space-y-3 p-5 sm:p-6">
        <input
          className="input-field border-0 bg-transparent px-0 text-xl font-medium shadow-none focus:shadow-none"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Rubrik…"
        />
        <textarea
          className="input-field min-h-36 border-0 bg-transparent px-0 text-base leading-relaxed shadow-none focus:shadow-none"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Skriv här…"
        />
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn-primary">
            {editingId ? "Uppdatera" : "Spara"}
          </button>
          {editingId && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setEditingId(null);
                setTitle("");
                setBody("");
              }}
            >
              Avbryt
            </button>
          )}
        </div>
      </form>

      <div className="grid gap-3 sm:grid-cols-2">
        {data.notes.map((n) => (
          <article key={n.id} className="panel p-5">
            <h2 className="font-display text-xl font-medium">{n.title}</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
              {n.body}
            </p>
            <div className="mt-4 flex gap-2">
              <button type="button" className="btn-ghost text-sm" onClick={() => edit(n)}>
                Redigera
              </button>
              <button
                type="button"
                className="btn-ghost text-sm text-danger"
                onClick={() => remove(n.id)}
              >
                Ta bort
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
