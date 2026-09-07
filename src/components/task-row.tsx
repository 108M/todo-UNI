"use client";

import { useState, Fragment } from "react";
import type { TaskDTO } from "@/lib/types";
import type { TaskSource, TaskType } from "@/db/schema";
import { colorForSubject } from "@/lib/courses";

const URL_RE = /(https?:\/\/[^\s)\]]+)/g;

function linkify(text: string) {
  return text.split(URL_RE).map((part, i) =>
    part.startsWith("http://") || part.startsWith("https://") ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-ink"
      >
        {part}
      </a>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

function DetailBody({ text }: { text: string }) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="space-y-3 text-sm leading-relaxed text-ink-soft">
      {paragraphs.map((p, i) => (
        <p key={i} className="whitespace-pre-wrap">
          {linkify(p)}
        </p>
      ))}
    </div>
  );
}

export const TYPE_LABEL: Record<TaskType, string> = {
  entrega: "Entrega",
  examen: "Examen",
  anuncio: "Anuncio",
  otro: "Otro",
};

export const SOURCE_LABEL: Record<TaskSource, string> = {
  manual: "Manual",
  email: "Correo",
  aulario: "Aulario",
};

export function formatDate(dueDate: string | null) {
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

// Paleta de estado (fija, nunca de asignatura): roja = atrasada, naranja =
// hoy, amarilla = pronto. Siempre con icono + etiqueta, nunca solo color.
function urgencyFor(task: TaskDTO): { label: string; bg: string; fg: string } | null {
  if (task.done || !task.dueDate) return null;
  const due = new Date(task.dueDate).getTime();
  const now = Date.now();
  const diffHours = (due - now) / 3_600_000;

  if (diffHours < 0) return { label: "¡ATRASADA!", bg: "#d03b3b", fg: "#ffffff" };
  if (diffHours <= 24) return { label: "¡HOY!", bg: "#ec835a", fg: "#ffffff" };
  if (diffHours <= 72) return { label: "PRONTO", bg: "#fab219", fg: "#0b0b0b" };
  return null;
}

export default function TaskRow({
  task,
  onToggle,
  onDelete,
}: {
  task: TaskDTO;
  onToggle: (task: TaskDTO) => void;
  onDelete: (task: TaskDTO) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const dateLabel = formatDate(task.dueDate);
  const color = colorForSubject(task.subject);
  const urgency = urgencyFor(task);
  const hasDetail = Boolean(task.rawContent?.trim());

  return (
    <div className="panel flex flex-col overflow-hidden p-0">
      <div className="flex items-stretch gap-0">
        <span
          className="w-2 shrink-0 border-r-[3px] border-ink"
          style={{ background: color }}
          aria-hidden
        />
        <div className="flex flex-1 items-start gap-3 p-4">
          <button
            onClick={() => onToggle(task)}
            aria-label={task.done ? "Marcar como pendiente" : "Marcar como hecha"}
            className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center border-[3px] border-ink text-sm font-bold ${
              task.done ? "bg-ink text-paper" : "bg-paper"
            }`}
          >
            {task.done ? "✓" : ""}
          </button>
          <div
            className={`flex-1 ${hasDetail ? "cursor-pointer" : ""}`}
            onClick={() => hasDetail && setExpanded((v) => !v)}
          >
            <p className={`font-semibold ${task.done ? "text-ink-soft line-through" : ""}`}>
              {task.title}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
              {urgency && (
                <span
                  className="border-2 border-ink px-2 py-0.5 font-bold"
                  style={{ background: urgency.bg, color: urgency.fg }}
                >
                  {urgency.label}
                </span>
              )}
              {task.subject && (
                <span className="flex items-center gap-1.5 border-2 border-ink px-2 py-0.5 font-semibold text-ink">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: color }}
                    aria-hidden
                  />
                  {task.subject}
                </span>
              )}
              <span className="border-2 border-ink px-2 py-0.5 font-semibold text-ink">
                {TYPE_LABEL[task.type as TaskType] ?? task.type}
              </span>
              {dateLabel && <span className="text-sm">{dateLabel}</span>}
              <span className="text-sm">· {SOURCE_LABEL[task.source as TaskSource] ?? task.source}</span>
              {hasDetail && (
                <span className="font-semibold underline">
                  {expanded ? "ocultar detalle ▾" : "ver detalle ▸"}
                </span>
              )}
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
      </div>
      {expanded && hasDetail && (
        <div className="border-t-[3px] border-ink bg-[#f9f9f7] p-4">
          <DetailBody text={task.rawContent!} />
        </div>
      )}
    </div>
  );
}
