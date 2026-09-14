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

  const jar = await loginToAulario();
  const notifications = await fetchNotifications(jar);
  const db = getDb();

  const alreadyKnown = await getExistingExternalIds(notifications.map((n) => `aulario-${n.id}`));

  let inserted = 0;
  const newTitles: string[] = [];
  for (const n of notifications) {
    const externalId = `aulario-${n.id}`;
    if (alreadyKnown.has(externalId)) continue; // ya procesado en un run anterior

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
  }

  await notifyNewTasks(newTitles);

  return NextResponse.json({ checked: notifications.length, inserted });
}
