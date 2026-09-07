"use client";

import { useMemo, useState } from "react";
import type { TaskDTO } from "@/lib/types";
import TaskRow from "../task-row";

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

export default function AgendaView({
  tasks,
  onToggle,
  onDelete,
}: {
  tasks: TaskDTO[];
  onToggle: (task: TaskDTO) => void;
  onDelete: (task: TaskDTO) => void;
}) {
  const [showDone, setShowDone] = useState(false);

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

  return (
    <div className="flex flex-col gap-8">
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
              <TaskRow key={task.id} task={task} onToggle={onToggle} onDelete={onDelete} />
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
                <TaskRow key={task.id} task={task} onToggle={onToggle} onDelete={onDelete} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
