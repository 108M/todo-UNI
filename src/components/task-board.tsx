"use client";

import { useMemo, useState } from "react";
import type { TaskSource, TaskType } from "@/db/schema";

export type TaskDTO = {
  id: number;
  title: string;
  subject: string | null;
  dueDate: string | null;
  type: string;
  source: string;
  rawContent: string | null;
  done: boolean;
  externalId: string | null;
  createdAt: string;
};

const TYPE_LABEL: Record<TaskType, string> = {
  entrega: "Entrega",
  examen: "Examen",
  anuncio: "Anuncio",
  otro: "Otro",
};

const SOURCE_LABEL: Record<TaskSource, string> = {
  manual: "Manual",
  email: "Correo",
  aulario: "Aulario",
};

function bucketFor(dueDate: string | null): string {
  if (!dueDate) return "Sin fecha";
  const due = new Date(dueDate);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDue = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diffDays = Math.round((startOfDue.getTime() - startOfToday.getTime()) / 86_400_000);

  if (diffDays < 0) return "Vencidas";
  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Mañana";
  if (diffDays <= 7) return "Esta semana";
  return "Más adelante";
}

const BUCKET_ORDER = ["Vencidas", "Hoy", "Mañana", "Esta semana", "Más adelante", "Sin fecha"];

function formatDate(dueDate: string | null) {
  if (!dueDate) return null;
  const d = new Date(dueDate);
  return d.toLocaleString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TaskBoard({ initialTasks }: { initialTasks: TaskDTO[] }) {
  const [tasks, setTasks] = useState<TaskDTO[]>(initialTasks);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [type, setType] = useState<TaskType>("entrega");
  const [showDone, setShowDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { pending, done } = useMemo(() => {
    const pending = tasks.filter((t) => !t.done);
    const done = tasks.filter((t) => t.done);
    return { pending, done };
  }, [tasks]);

  const grouped = useMemo(() => {
    const groups = new Map<string, TaskDTO[]>();
    for (const task of pending) {
      const bucket = bucketFor(task.dueDate);
      if (!groups.has(bucket)) groups.set(bucket, []);
      groups.get(bucket)!.push(task);
    }
    return BUCKET_ORDER.filter((b) => groups.has(b)).map((b) => ({
      bucket: b,
      items: groups.get(b)!,
    }));
  }, [pending]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    setError(null);
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
      setTasks((prev) => [...prev, created]);
      setTitle("");
      setSubject("");
      setDueDate("");
      setType("entrega");
    } catch {
      setError("No se pudo añadir la tarea. Inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleDone(task: TaskDTO) {
    const next = !task.done;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: next } : t)));
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: next }),
    });
    if (!res.ok) {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: !next } : t)));
    }
  }

  async function removeTask(task: TaskDTO) {
    const prevTasks = tasks;
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    if (!res.ok) setTasks(prevTasks);
  }

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={handleAdd} className="panel flex flex-col gap-3 p-5">
        <h2 className="font-display text-2xl tracking-wide">AÑADIR TAREA</h2>
        <input
          className="panel-input px-3 py-2"
          placeholder="¿Qué hay que entregar?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            className="panel-input flex-1 px-3 py-2"
            placeholder="Asignatura (opcional)"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
          <input
            className="panel-input px-3 py-2"
            type="datetime-local"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
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
        <button
          type="submit"
          disabled={submitting}
          className="panel-btn self-start bg-ink px-5 py-2 font-display text-lg tracking-wide text-paper disabled:opacity-50"
        >
          {submitting ? "AÑADIENDO..." : "AÑADIR"}
        </button>
        {error && <p className="text-sm text-ink-soft">{error}</p>}
      </form>

      {grouped.length === 0 && (
        <p className="panel p-6 text-center text-ink-soft">
          No tienes tareas pendientes. Añade una arriba.
        </p>
      )}

      {grouped.map(({ bucket, items }) => (
        <section key={bucket} className="flex flex-col gap-3">
          <h3 className="font-display text-3xl tracking-wide">{bucket.toUpperCase()}</h3>
          <div className="flex flex-col gap-3">
            {items.map((task) => (
              <TaskRow key={task.id} task={task} onToggle={toggleDone} onDelete={removeTask} />
            ))}
          </div>
        </section>
      ))}

      {done.length > 0 && (
        <section className="flex flex-col gap-3">
          <button
            onClick={() => setShowDone((v) => !v)}
            className="panel-btn self-start px-4 py-1 text-sm font-semibold"
          >
            {showDone ? "OCULTAR HECHAS" : `VER HECHAS (${done.length})`}
          </button>
          {showDone && (
            <div className="flex flex-col gap-3">
              {done.map((task) => (
                <TaskRow key={task.id} task={task} onToggle={toggleDone} onDelete={removeTask} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function TaskRow({
  task,
  onToggle,
  onDelete,
}: {
  task: TaskDTO;
  onToggle: (task: TaskDTO) => void;
  onDelete: (task: TaskDTO) => void;
}) {
  const dateLabel = formatDate(task.dueDate);
  return (
    <div className="panel flex items-start gap-3 p-4">
      <button
        onClick={() => onToggle(task)}
        aria-label={task.done ? "Marcar como pendiente" : "Marcar como hecha"}
        className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center border-[3px] border-ink text-sm font-bold ${
          task.done ? "bg-ink text-paper" : "bg-paper"
        }`}
      >
        {task.done ? "✓" : ""}
      </button>
      <div className="flex-1">
        <p className={`font-semibold ${task.done ? "text-ink-soft line-through" : ""}`}>
          {task.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
          {task.subject && (
            <span className="border-2 border-ink px-2 py-0.5 font-semibold text-ink">
              {task.subject}
            </span>
          )}
          <span className="border-2 border-ink px-2 py-0.5 font-semibold text-ink">
            {TYPE_LABEL[task.type as TaskType] ?? task.type}
          </span>
          {dateLabel && <span>{dateLabel}</span>}
          <span>· {SOURCE_LABEL[task.source as TaskSource] ?? task.source}</span>
        </div>
      </div>
      <button
        onClick={() => onDelete(task)}
        aria-label="Borrar tarea"
        className="mt-1 shrink-0 text-lg font-bold text-ink-soft hover:text-ink"
      >
        ×
      </button>
    </div>
  );
}
