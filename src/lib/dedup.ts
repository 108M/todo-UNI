import { and, eq, gte, lt, isNotNull, gt, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { tasks } from "@/db/schema";

/**
 * El mismo aviso del profesor a veces llega por correo Y como anuncio de
 * Aulario — cada pipeline lo extrae por separado con un título ligeramente
 * distinto, así que el externalId no basta. Aquí se cruza por asignatura +
 * mismo día de entrega, que es lo que de verdad identifica "la misma tarea"
 * para el alumno. Solo aplica si ambos ya tienen asignatura y fecha.
 */
export async function existsSimilarTask(subject: string | null, dueDate: Date | null) {
  if (!subject || !dueDate) return false;

  const db = getDb();
  const startOfDay = new Date(dueDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const rows = await db
    .select({ id: tasks.id, title: tasks.title })
    .from(tasks)
    .where(
      and(
        eq(tasks.subject, subject),
        eq(tasks.dismissed, false),
        isNotNull(tasks.dueDate),
        gte(tasks.dueDate, startOfDay),
        lt(tasks.dueDate, endOfDay),
      ),
    )
    .limit(1);

  if (rows.length > 0) {
    console.log(`[dedup] existsSimilarTask: "${subject}" ${dueDate.toISOString()} coincide con tarea #${rows[0].id} "${rows[0].title}"`);
  }

  return rows.length > 0;
}

/**
 * Antes de gastar una llamada a la IA, descarta lo que ya está en la BD
 * (por externalId) — si no, cada ejecución del cron reprocesa los mismos
 * correos/avisos de los últimos días una y otra vez, agotando la cuota
 * gratuita de la API sin necesidad.
 */
export async function getExistingExternalIds(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const db = getDb();
  const rows = await db
    .select({ externalId: tasks.externalId })
    .from(tasks)
    .where(inArray(tasks.externalId, ids));
  return new Set(rows.map((r) => r.externalId).filter((id): id is string => id !== null));
}

const STOPWORDS = new Set([
  "de",
  "del",
  "la",
  "el",
  "los",
  "las",
  "en",
  "con",
  "sin",
  "que",
  "una",
  "un",
  "y",
  "o",
  "para",
  "al",
  "su",
  "sus",
]);

const ACCENTS: Record<string, string> = {
  á: "a",
  é: "e",
  í: "i",
  ó: "o",
  ú: "u",
  ü: "u",
  ñ: "n",
};

function stripAccents(text: string): string {
  return text.replace(/[áéíóúüñ]/g, (ch) => ACCENTS[ch] ?? ch);
}

function normalizeWords(text: string): string[] {
  return stripAccents(text.toLowerCase())
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
}

function wordsOverlapScore(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const matches = a.filter((wa) =>
    b.some((wb) => wa.startsWith(wb.slice(0, 5)) || wb.startsWith(wa.slice(0, 5))),
  ).length;
  // Denominador = título más corto: dos resúmenes de la IA para el mismo
  // aviso rara vez comparten *todas* las palabras, pero casi siempre las
  // palabras clave del más corto aparecen en el más largo.
  return matches / Math.min(a.length, b.length);
}

/**
 * Red de seguridad para cuando la IA no saca la fecha en una de las dos
 * fuentes (correo/Aulario) y el cruce por fecha no tiene nada con qué
 * comparar: misma asignatura + título con suficiente solapamiento de
 * palabras (singular/plural incluido, vía comparación por prefijo).
 */
export async function existsSimilarByTitle(subject: string | null, title: string) {
  if (!subject) return false;

  const db = getDb();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const candidates = await db
    .select({ id: tasks.id, title: tasks.title })
    .from(tasks)
    .where(and(eq(tasks.subject, subject), eq(tasks.dismissed, false), gt(tasks.createdAt, since)))
    .limit(30);

  const candidateWords = normalizeWords(title);
  const match = candidates.find((c) => wordsOverlapScore(candidateWords, normalizeWords(c.title)) >= 0.4);

  if (match) {
    console.log(`[dedup] existsSimilarByTitle: "${subject}" / "${title}" coincide con tarea #${match.id} "${match.title}"`);
  }

  return match !== undefined;
}
