import { and, eq, gte, lt, isNotNull } from "drizzle-orm";
import { getDb } from "@/db";
import { tasks } from "@/db/schema";

/**
 * El mismo aviso del profesor a veces llega por correo Y como anuncio de
 * Aulario — cada pipeline lo extrae por separado con un título ligeramente
 * distinto, así que el externalId no basta. Aquí se cruza por asignatura +
 * mismo día de entrega, que es lo que de verdad identifica "la misma tarea"
 * para el alumno. Solo aplica si ambos ya tienen asignatura y fecha (si no,
 * hay demasiadas tareas "sin fecha"/"sin asignatura" para que el cruce
 * signifique algo).
 */
export async function existsSimilarTask(subject: string | null, dueDate: Date | null) {
  if (!subject || !dueDate) return false;

  const db = getDb();
  const startOfDay = new Date(dueDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const rows = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(
      and(
        eq(tasks.subject, subject),
        isNotNull(tasks.dueDate),
        gte(tasks.dueDate, startOfDay),
        lt(tasks.dueDate, endOfDay),
      ),
    )
    .limit(1);

  return rows.length > 0;
}
