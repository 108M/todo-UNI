"use client";

import { useState } from "react";
import type { TaskDTO } from "@/lib/types";
import type { TaskType } from "@/db/schema";
import { TYPE_LABEL } from "./task-row";
import { COURSES } from "@/lib/courses";
import DatePicker from "./date-picker";

const OTHER = "__otra__";

export default function AddTaskForm({
  onCreated,
}: {
  onCreated: (task: TaskDTO) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [subjectChoice, setSubjectChoice] = useState<string>(COURSES[0].name);
  const [customSubject, setCustomSubject] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [type, setType] = useState<TaskType>("entrega");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    setError(null);
    const subject = subjectChoice === OTHER ? customSubject.trim() : subjectChoice;
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          subject: subject || undefined,
          dueDate: dueDate || undefined,
          type,
        }),
      });
      if (!res.ok) throw new Error("No se pudo crear la tarea");
      const created: TaskDTO = await res.json();
      onCreated(created);
      setTitle("");
      setCustomSubject("");
      setDueDate("");
      setType("entrega");
      setOpen(false);
    } catch {
      setError("No se pudo añadir la tarea. Inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="panel-btn w-full bg-paper p-4 text-left font-display text-xl tracking-wide"
      >
        + AÑADIR TAREA MANUAL
      </button>
    );
  }

  return (
    <form onSubmit={handleAdd} className="panel flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl tracking-wide">AÑADIR TAREA</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Cerrar"
          className="text-lg font-bold text-ink-soft hover:text-ink"
        >
          ×
        </button>
      </div>
      <input
        className="panel-input px-3 py-2"
        placeholder="¿Qué hay que entregar?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        autoFocus
      />
      <div className="flex flex-col gap-3 sm:flex-row">
        <select
          className="panel-input flex-1 px-3 py-2"
          value={subjectChoice}
          onChange={(e) => setSubjectChoice(e.target.value)}
        >
          {COURSES.map((c) => (
            <option key={c.slug} value={c.name}>
              {c.name}
            </option>
          ))}
          <option value={OTHER}>Otra asignatura…</option>
        </select>
        <div className="flex-1">
          <DatePicker value={dueDate} onChange={setDueDate} />
        </div>
        <select
          className="panel-input px-3 py-2"
          value={type}
          onChange={(e) => setType(e.target.value as TaskType)}
        >
          {Object.entries(TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {subjectChoice === OTHER && (
        <input
          className="panel-input px-3 py-2"
          placeholder="Nombre de la asignatura"
          value={customSubject}
          onChange={(e) => setCustomSubject(e.target.value)}
        />
      )}
      <button
        type="submit"
        disabled={submitting}
        className="panel-btn self-start bg-ink px-5 py-2 font-display text-lg tracking-wide text-paper disabled:opacity-50"
      >
        {submitting ? "AÑADIENDO..." : "AÑADIR"}
      </button>
      {error && <p className="text-sm text-ink-soft">{error}</p>}
    </form>
  );
}
