"use client";

import { useState } from "react";
import type { TaskDTO } from "@/lib/types";
import AddTaskForm from "./add-task-form";
import AgendaView from "./views/agenda-view";
import SubjectsView from "./views/subjects-view";
import CalendarView from "./views/calendar-view";
import EnableNotificationsButton from "./enable-notifications-button";

const TABS = [
  { id: "agenda", label: "AGENDA" },
  { id: "asignaturas", label: "ASIGNATURAS" },
  { id: "calendario", label: "CALENDARIO" },
] as const;

type Tab = (typeof TABS)[number]["id"];

export default function TaskBoard({ initialTasks }: { initialTasks: TaskDTO[] }) {
  const [tasks, setTasks] = useState<TaskDTO[]>(initialTasks);
  const [tab, setTab] = useState<Tab>("agenda");
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  function handleCreated(task: TaskDTO) {
    setTasks((prev) => [...prev, task]);
  }

  async function handleRefresh() {
    setSyncing(true);
    setSyncError(null);
    try {
      const authHeaders = process.env.NEXT_PUBLIC_CRON_SECRET
        ? { Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET}` }
        : undefined;
      const [emailRes, aularioRes] = await Promise.all([
        fetch("/api/cron/email", { headers: authHeaders }),
        fetch("/api/cron/aulario", { headers: authHeaders }),
      ]);
      if (!emailRes.ok || !aularioRes.ok) throw new Error("sync failed");
      const listRes = await fetch("/api/tasks");
      if (!listRes.ok) throw new Error("list failed");
      setTasks(await listRes.json());
    } catch {
      setSyncError("No se pudo actualizar. Inténtalo de nuevo.");
    } finally {
      setSyncing(false);
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

  const pendingCount = tasks.filter((t) => !t.done).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`panel-btn px-4 py-2 font-display text-lg tracking-wide ${
                tab === t.id ? "bg-ink text-paper" : "bg-paper"
              }`}
            >
              {t.label}
              {t.id === "agenda" && pendingCount > 0 ? ` (${pendingCount})` : ""}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <EnableNotificationsButton />
          <button
            onClick={handleRefresh}
            disabled={syncing}
            className="panel-btn bg-paper px-4 py-2 font-display text-lg tracking-wide disabled:opacity-50"
          >
            {syncing ? "ACTUALIZANDO…" : "↻ ACTUALIZAR"}
          </button>
        </div>
      </div>
      {syncError && <p className="text-sm text-ink-soft">{syncError}</p>}

      <AddTaskForm onCreated={handleCreated} />

      {tab === "agenda" && (
        <AgendaView tasks={tasks} onToggle={toggleDone} onDelete={removeTask} />
      )}
      {tab === "asignaturas" && (
        <SubjectsView tasks={tasks} onToggle={toggleDone} onDelete={removeTask} />
      )}
      {tab === "calendario" && (
        <CalendarView tasks={tasks} onToggle={toggleDone} onDelete={removeTask} />
      )}
    </div>
  );
}
