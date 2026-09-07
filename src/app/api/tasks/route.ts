import { NextRequest, NextResponse } from "next/server";
import { asc, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { tasks, taskType } from "@/db/schema";

export async function GET() {
  const db = getDb();
  const rows = await db
    .select()
    .from(tasks)
    .orderBy(sql`${tasks.dueDate} is null`, asc(tasks.dueDate), asc(tasks.createdAt));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";

  if (!title) {
    return NextResponse.json({ error: "El título es obligatorio" }, { status: 400 });
  }

  const type = taskType.includes(body.type) ? body.type : "otro";
  const dueDate = body.dueDate ? new Date(body.dueDate) : null;

  const db = getDb();
  const [row] = await db
    .insert(tasks)
    .values({
      title,
      subject: body.subject?.trim() || null,
      dueDate,
      type,
      source: "manual",
      rawContent: body.rawContent?.trim() || null,
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
