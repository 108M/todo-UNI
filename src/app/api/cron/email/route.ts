import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { tasks } from "@/db/schema";
import { fetchRecentEmails } from "@/lib/imap";
import { isLikelyAcademic } from "@/lib/relevance";
import { extractTasksFromEmails } from "@/lib/extract";
import { detectCourseInText } from "@/lib/courses";
import { existsSimilarTask } from "@/lib/dedup";

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

  const emails = await fetchRecentEmails(3);
  const relevant = emails.filter(isLikelyAcademic);
  const extracted = await extractTasksFromEmails(relevant);

  const db = getDb();
  let inserted = 0;
  for (const task of extracted) {
    const email = relevant.find((e) => e.messageId === task.messageId);
    const subject = task.subject ?? (email ? detectCourseInText(email.text) : null);
    const dueDate = task.dueDate ? new Date(task.dueDate) : null;

    if (await existsSimilarTask(subject, dueDate)) continue;

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
    if (row) inserted += 1;
  }

  return NextResponse.json({
    checked: emails.length,
    relevant: relevant.length,
    extracted: extracted.length,
    inserted,
  });
}
