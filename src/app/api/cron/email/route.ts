import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { tasks } from "@/db/schema";
import { fetchRecentEmails } from "@/lib/imap";
import { isLikelyAcademic } from "@/lib/relevance";
import { extractTasksFromEmails } from "@/lib/extract";
import { detectCourseInText } from "@/lib/courses";
import { existsSimilarTask, existsSimilarByTitle, getExistingExternalIds } from "@/lib/dedup";
import { notifyNewTasks } from "@/lib/notify";

export const maxDuration = 60;

function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // sin CRON_SECRET configurado, no se exige auth
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (process.env.DEMO_MODE === "true") {
    return NextResponse.json({ demo: true, skipped: true });
  }

  const emails = await fetchRecentEmails(3);
  const relevant = emails.filter(isLikelyAcademic);

  const alreadyKnown = await getExistingExternalIds(relevant.map((e) => e.messageId));
  const unprocessed = relevant.filter((e) => !alreadyKnown.has(e.messageId));

  const extracted = await extractTasksFromEmails(unprocessed);

  const db = getDb();
  let inserted = 0;
  const newTitles: string[] = [];
  for (const task of extracted) {
    const email = relevant.find((e) => e.messageId === task.messageId);
    const subject = task.subject ?? (email ? detectCourseInText(email.text) : null);
    const dueDate = task.dueDate ? new Date(task.dueDate) : null;

    if (await existsSimilarTask(subject, dueDate, task.title)) continue;
    if (await existsSimilarByTitle(subject, task.title)) continue;

    const [row] = await db
      .insert(tasks)
      .values({
        title: task.title,
        subject,
        dueDate,
        type: task.type,
        source: "email",
        externalId: task.messageId,
        rawContent: email?.text ?? null,
      })
      .onConflictDoNothing({ target: tasks.externalId })
      .returning();
    if (row) {
      inserted += 1;
      newTitles.push(row.title);
    }
  }

  await notifyNewTasks(newTitles);

  return NextResponse.json({
    checked: emails.length,
    relevant: relevant.length,
    unprocessed: unprocessed.length,
    extracted: extracted.length,
    inserted,
  });
}
