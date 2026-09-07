"use client";

import { useEffect, useRef, useState } from "react";

const WEEKDAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];
const MONTH_LABEL = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" });

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function buildWeeks(monthStart: Date) {
  const firstOfMonth = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1);
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

// Selector de fecha/hora propio, con el mismo estilo de viñeta que el resto
// de la app — el <input type="datetime-local"> nativo abre un desplegable
// del navegador que no se puede re-estilar y desentona con el diseño.
export default function DatePicker({
  value,
  onChange,
}: {
  value: string; // "YYYY-MM-DDTHH:mm" o ""
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [datePart, timePart] = value ? value.split("T") : ["", ""];
  const selectedDate = datePart ? new Date(`${datePart}T00:00:00`) : null;
  const [viewMonth, setViewMonth] = useState(() => selectedDate ?? new Date());
  const today = new Date();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function selectDay(d: Date) {
    onChange(`${toDateKey(d)}T${timePart || "23:59"}`);
  }

  function changeTime(t: string) {
    if (!datePart) return;
    onChange(`${datePart}T${t}`);
  }

  const label = selectedDate
    ? selectedDate.toLocaleDateString("es-ES", {
        weekday: "short",
        day: "numeric",
        month: "short",
      }) + (timePart ? `, ${timePart}` : "")
    : "Fecha y hora (opcional)";

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`panel-input w-full px-3 py-2 text-left ${selectedDate ? "" : "text-ink-soft"}`}
      >
        {label}
      </button>
      {open && (
        <div className="panel absolute z-10 mt-2 w-72 bg-paper p-3">
          <div className="flex items-center justify-between pb-2">
            <button
              type="button"
              onClick={() =>
                setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))
              }
              className="panel-btn px-2 py-0.5 font-display text-lg"
              aria-label="Mes anterior"
            >
              ←
            </button>
            <span className="font-display text-lg tracking-wide capitalize">
              {MONTH_LABEL.format(viewMonth)}
            </span>
            <button
              type="button"
              onClick={() =>
                setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))
              }
              className="panel-btn px-2 py-0.5 font-display text-lg"
              aria-label="Mes siguiente"
            >
              →
            </button>
          </div>
          <div className="grid grid-cols-7 text-center text-[10px] font-bold text-ink-soft">
            {WEEKDAY_LABELS.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          {buildWeeks(viewMonth).map((week, i) => (
            <div key={i} className="grid grid-cols-7">
              {week.map((day) => {
                const key = toDateKey(day);
                const inMonth = day.getMonth() === viewMonth.getMonth();
                const isSelected = selectedDate && key === toDateKey(selectedDate);
                const isToday = key === toDateKey(today);
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => selectDay(day)}
                    className={`m-0.5 flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                      isSelected
                        ? "bg-ink text-paper"
                        : isToday
                          ? "border-2 border-ink"
                          : isWeekend
                            ? "bg-[#dcefdc]"
                            : ""
                    } ${!inMonth ? "opacity-30" : ""}`}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
          ))}
          {datePart && (
            <div className="mt-3 flex items-center gap-2 border-t-2 border-ink pt-3">
              <input
                type="time"
                value={timePart || "23:59"}
                onChange={(e) => changeTime(e.target.value)}
                className="panel-input flex-1 px-2 py-1 text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="panel-btn px-2 py-1 text-xs font-semibold"
              >
                QUITAR
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
