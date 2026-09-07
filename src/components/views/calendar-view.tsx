"use client";

import { useMemo, useState } from "react";
import type { TaskDTO } from "@/lib/types";
import { colorForSubject } from "@/lib/courses";
import TaskRow from "../task-row";

const WEEKDAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];
const MONTH_LABEL = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" });

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function isSameDay(a: Date, b: Date) {
  return dateKey(a) === dateKey(b);
}

function buildWeeks(monthStart: Date) {
  const firstOfMonth = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1);
  // lunes=0 ... domingo=6
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - mondayOffset);

  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push(d);
  }

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

export default function CalendarView({
  tasks,
  onToggle,
  onDelete,
}: {
  tasks: TaskDTO[];
  onToggle: (task: TaskDTO) => void;
  onDelete: (task: TaskDTO) => void;
}) {
  const today = new Date();
  const [monthStart, setMonthStart] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, TaskDTO[]>();
    for (const task of tasks) {
      if (!task.dueDate) continue;
      const key = dateKey(new Date(task.dueDate));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(task);
    }
    return map;
  }, [tasks]);

  const weeks = useMemo(() => buildWeeks(monthStart), [monthStart]);
  const selectedTasks = selectedKey ? tasksByDay.get(selectedKey) ?? [] : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="panel flex items-center justify-between p-3">
        <button
          onClick={() => setMonthStart(new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1))}
          className="panel-btn px-3 py-1 font-display text-xl"
          aria-label="Mes anterior"
        >
          ←
        </button>
        <h3 className="font-display text-2xl tracking-wide capitalize">
          {MONTH_LABEL.format(monthStart)}
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setMonthStart(new Date(today.getFullYear(), today.getMonth(), 1));
              setSelectedKey(null);
            }}
            className="panel-btn px-3 py-1 text-sm font-semibold"
          >
            HOY
          </button>
          <button
            onClick={() => setMonthStart(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1))}
            className="panel-btn px-3 py-1 font-display text-xl"
            aria-label="Mes siguiente"
          >
            →
          </button>
        </div>
      </div>

      <div className="panel overflow-hidden p-0">
        <div className="grid grid-cols-7 border-b-[3px] border-ink">
          {WEEKDAY_LABELS.map((d, i) => (
            <div
              key={d}
              className={`border-r-[3px] border-ink py-1 text-center text-xs font-bold last:border-r-0 ${
                i >= 5 ? "bg-[#dcefdc]" : ""
              }`}
            >
              {d}
            </div>
          ))}
        </div>
        {weeks.map((week, i) => (
          <div key={i} className="grid grid-cols-7 border-b-[3px] border-ink last:border-b-0">
            {week.map((day) => {
              const key = dateKey(day);
              const dayTasks = tasksByDay.get(key) ?? [];
              const inMonth = day.getMonth() === monthStart.getMonth();
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              const isToday = isSameDay(day, today);
              const isSelected = key === selectedKey;

              // Prioridad de color: hoy (amarillo) > finde (verde) > normal.
              // Los días fuera de mes se atenúan con opacidad, sin perder el
              // tinte de finde/hoy, para que se note que son de otro mes.
              const bg = isToday ? "bg-[#fff2b8]" : isWeekend ? "bg-[#dcefdc]" : "bg-paper";

              return (
                <button
                  key={key}
                  onClick={() => setSelectedKey(isSelected ? null : key)}
                  className={`flex min-h-14 flex-col items-stretch gap-1 border-r-[3px] border-ink p-0.5 text-left last:border-r-0 sm:min-h-20 sm:p-1 ${bg} ${
                    inMonth ? "" : "opacity-40"
                  } ${isSelected ? "outline outline-[3px] outline-offset-[-3px] outline-ink" : ""}`}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center text-xs font-bold ${
                      isToday ? "rounded-full border-2 border-ink bg-ink text-paper" : ""
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    {dayTasks.slice(0, 2).map((t) => (
                      <span
                        key={t.id}
                        className={`truncate rounded-sm px-1 text-[10px] font-semibold text-paper ${
                          t.done ? "opacity-40 line-through" : ""
                        }`}
                        style={{ background: colorForSubject(t.subject) }}
                      >
                        {t.title}
                      </span>
                    ))}
                    {dayTasks.length > 2 && (
                      <span className="text-[10px] font-semibold text-ink-soft">
                        +{dayTasks.length - 2} más
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {selectedKey && (
        <section className="flex flex-col gap-3">
          <h3 className="font-display text-2xl tracking-wide">
            {new Date(selectedKey).toLocaleDateString("es-ES", {
              weekday: "long",
              day: "numeric",
              month: "long",
            }).toUpperCase()}
          </h3>
          {selectedTasks.length === 0 ? (
            <p className="panel p-4 text-sm text-ink-soft">No hay tareas ese día.</p>
          ) : (
            selectedTasks.map((task) => (
              <TaskRow key={task.id} task={task} onToggle={onToggle} onDelete={onDelete} />
            ))
          )}
        </section>
      )}
    </div>
  );
}
