import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { tasks } from "@/db/schema";
import {
  loginToAulario,
  fetchNotifications,
  fetchAnnouncementBody,
  fetchAssignment,
} from "@/lib/aulario";
import { courseForSiteId } from "@/lib/courses";
import { extractTasksFromEmails } from "@/lib/extract";
import type { FetchedEmail } from "@/lib/imap";
import { existsSimilarTask, existsSimilarByTitle, getExistingExternalIds } from "@/lib/dedup";
import { notifyNewTasks } from "@/lib/notify";

export const maxDuration = 60;

function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

function parseAssignmentId(ref: string): string | null {
  const m = ref.match(/\/assignment\/a\/[^/]+\/(.+)$/);
  return m ? m[1] : null;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (process.env.DEMO_MODE === "true") {
    return NextResponse.json({ demo: true, skipped: true });
  }

  // El SSO de Aulario falla de vez en cuando (timeouts, flujo SAML a medias).
  // Se devuelve el motivo en vez de un 500 opaco para poder verlo en los logs
  // del workflow.
  let jar: Awaited<ReturnType<typeof loginToAulario>>;
  let notifications: Awaited<ReturnType<typeof fetchNotifications>>;
  try {
    jar = await loginToAulario();
    notifications = await fetchNotifications(jar);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/aulario] login/notificaciones:", err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
  const db = getDb();

  const alreadyKnown = await getExistingExternalIds(notifications.map((n) => `aulario-${n.id}`));

  let inserted = 0;
  let failed = 0;
  const newTitles: string[] = [];
  for (const n of notifications) {
    const externalId = `aulario-${n.id}`;
    if (alreadyKnown.has(externalId)) continue; // ya procesado en un run anterior

    // Un aviso que falle (Aulario o Gemini) no debe tumbar el resto; como no
    // se inserta, se reintenta en la siguiente ejecución.
    try {
      const subject = courseForSiteId(n.siteId)?.name ?? null;

      let title = n.title;
      let dueDate: Date | null = null;
      let type: "entrega" | "examen" | "anuncio" | "otro" = "anuncio";
      let rawContent: string | null = null;

      if (n.event.startsWith("asn")) {
        const assignmentId = parseAssignmentId(n.ref);
        const assignment = assignmentId ? await fetchAssignment(jar, n.siteId, assignmentId) : null;
        if (assignment) {
          title = assignment.title;
          dueDate = assignment.dueDateEpochSeconds
            ? new Date(assignment.dueDateEpochSeconds * 1000)
            : null;
          rawContent = assignment.instructions || null;
        }
        type = "entrega";
      } else if (n.event.startsWith("annc")) {
        const body = await fetchAnnouncementBody(jar, n.ref);
        rawContent = body || null;
        if (body) {
          const fakeEmail: FetchedEmail = {
            messageId: externalId,
            subject: n.title,
            from: n.fromDisplayName,
            date: null,
            text: body,
          };
          const [extracted] = await extractTasksFromEmails([fakeEmail]);
          if (extracted) {
            title = extracted.title;
            dueDate = extracted.dueDate ? new Date(extracted.dueDate) : null;
            type = extracted.type;
          }
        }
      } else {
        continue; // otros tipos de evento (foros, calificaciones, etc.) se ignoran
      }

      if (await existsSimilarTask(subject, dueDate, title)) continue;
      if (await existsSimilarByTitle(subject, title)) continue;

      const [row] = await db
        .insert(tasks)
        .values({ title, subject, dueDate, type, source: "aulario", externalId, rawContent })
        .onConflictDoNothing({ target: tasks.externalId })
        .returning();
      if (row) {
        inserted += 1;
        newTitles.push(row.title);
      }
    } catch (err) {
      failed += 1;
      console.error(`[cron/aulario] aviso ${externalId}:`, err);
    }
  }

  await notifyNewTasks(newTitles);

  return NextResponse.json({ checked: notifications.length, inserted, failed });
}
