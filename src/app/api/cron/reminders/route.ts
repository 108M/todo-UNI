import { NextRequest, NextResponse } from "next/server";
import { and, eq, gt } from "drizzle-orm";
import { getDb } from "@/db";
import { tasks } from "@/db/schema";
import { notify } from "@/lib/notify";

export const maxDuration = 30;

function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

function daysUntil(dueDate: Date, now: Date) {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDue = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  return Math.round((startOfDue.getTime() - startOfToday.getTime()) / 86_400_000);
}

function formatDate(d: Date) {
  return d.toLocaleString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Tres avisos por tarea (2 días antes, 1 día antes, el mismo día antes de su
// hora), cada uno marcado por separado para no repetirlo.
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const now = new Date();
  const db = getDb();

  const candidates = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.done, false), eq(tasks.dismissed, false), gt(tasks.dueDate, now)));

  let sent = 0;
  for (const task of candidates) {
    if (!task.dueDate) continue;
    const diff = daysUntil(task.dueDate, now);
    const label = `${task.title}${task.subject ? ` (${task.subject})` : ""} — vence ${formatDate(task.dueDate)}`;

    if (diff === 2 && !task.reminded2d) {
      await notify("Quedan 2 días", label);
      await db.update(tasks).set({ reminded2d: true }).where(eq(tasks.id, task.id));
      sent += 1;
    } else if (diff === 1 && !task.reminded1d) {
      await notify("Queda 1 día", label);
      await db.update(tasks).set({ reminded1d: true }).where(eq(tasks.id, task.id));
      sent += 1;
    } else if (diff === 0 && !task.remindedToday) {
      await notify("¡Es hoy!", label);
      await db.update(tasks).set({ remindedToday: true }).where(eq(tasks.id, task.id));
      sent += 1;
    }
  }

  return NextResponse.json({ checked: candidates.length, sent });
}
