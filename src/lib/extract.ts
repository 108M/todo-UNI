import { GoogleGenAI, Type } from "@google/genai";
import type { FetchedEmail } from "./imap";
import type { TaskType } from "@/db/schema";
import { COURSES } from "./courses";

export type ExtractedTask = {
  messageId: string;
  title: string;
  subject: string | null;
  dueDate: string | null;
  type: TaskType;
};

type RawResult = {
  messageId: string;
  isTask: boolean;
  title?: string;
  subject?: string | null;
  dueDate?: string | null;
  type?: TaskType;
};

// Flash (no Flash-Lite): Flash-Lite no resolvía bien fechas en texto libre
// ni asignaturas mencionadas dentro del cuerpo del correo. Sigue siendo
// gratis para este volumen de uso (pocas llamadas al día).
const MODEL = "gemini-3.5-flash";

const RESPONSE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      messageId: { type: Type.STRING },
      isTask: { type: Type.BOOLEAN },
      title: { type: Type.STRING },
      subject: { type: Type.STRING, nullable: true },
      dueDate: { type: Type.STRING, nullable: true },
      type: { type: Type.STRING, enum: ["entrega", "examen", "anuncio", "otro"] },
    },
    required: ["messageId", "isTask"],
  },
};

function buildPrompt(emails: FetchedEmail[], today: string) {
  const items = emails.map((e) => ({
    messageId: e.messageId,
    from: e.from,
    subject: e.subject,
    date: e.date?.toISOString() ?? null,
    body: e.text,
  }));

  const courseList = COURSES.map((c) => `- "${c.name}"`).join("\n");

  return `Hoy es ${today}. Eres un asistente que revisa correos de una universidad española (notificaciones automáticas del campus virtual Aulario/Sakai y correos de profesores) y decide cuáles anuncian una tarea, entrega o examen con fecha.

Para cada correo del array JSON de entrada, decide si contiene una tarea/entrega/examen con fecha límite identificable. Ignora correos administrativos genéricos, becas, eventos sociales, o avisos sin acción del alumno.

FECHA (dueDate) — sé activo buscándola, no la dejes en null a la ligera:
- Los correos casi siempre incluyen una fecha en texto natural (ej. "antes del viernes 18 de septiembre", "para el lunes que viene", "hasta el 30/09"). Resuélvela SIEMPRE a una fecha absoluta ISO 8601 usando ${today} como referencia de "hoy".
- Si no se indica una hora concreta, usa 23:59 de ese día.
- Solo deja dueDate en null si de verdad no hay ninguna referencia temporal en el texto, ni siquiera vaga.

ASIGNATURA (subject) — búscala activamente en el propio texto del correo:
- Los avisos automáticos de Aulario suelen incluir frases como: en el sitio "26_0_721103_1_G Seguridad en el desarrollo de aplicaciones". Ahí, tras el código numérico, va el nombre real de la asignatura — extrae esa parte y compárala con la lista de abajo.
- Las asignaturas del alumno son exactamente estas cuatro (usa el nombre EXACTO, copiado tal cual, cuando reconozcas cualquiera de ellas en el texto):
${courseList}
- Solo usa null si el correo de verdad no menciona ninguna asignatura ni sitio de curso.

Devuelve un array con un objeto por cada correo de entrada, en el mismo orden:
- Si no es una tarea: {"messageId": "...", "isTask": false}
- Si es una tarea: {"messageId": "...", "isTask": true, "title": "resumen corto en español", "subject": "un nombre exacto de la lista, o null", "dueDate": "fecha ISO 8601 resuelta, o null solo si no hay ninguna pista temporal", "type": "entrega" | "examen" | "anuncio" | "otro"}

Correos:
${JSON.stringify(items, null, 2)}`;
}

export async function extractTasksFromEmails(
  emails: FetchedEmail[],
): Promise<ExtractedTask[]> {
  if (emails.length === 0) return [];

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const today = new Date().toISOString().slice(0, 10);

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: buildPrompt(emails, today),
    config: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) return [];

  let results: RawResult[];
  try {
    results = JSON.parse(text);
  } catch {
    return [];
  }

  const knownSubjects = new Set(COURSES.map((c) => c.name));

  return results
    .filter((r) => r.isTask && typeof r.title === "string")
    .map((r) => ({
      messageId: r.messageId,
      title: r.title!,
      subject: r.subject && knownSubjects.has(r.subject) ? r.subject : null,
      dueDate: r.dueDate || null,
      type: (r.type as TaskType) || "otro",
    }));
}
