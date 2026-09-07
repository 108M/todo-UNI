import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { tasks, taskType } from "@/db/schema";

function parseId(idParam: string) {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: idParam } = await params;
  const id = parseId(idParam);
  if (id === null) {
    return NextResponse.json({ error: "Id inválido" }, { status: 400 });
  }

  const body = await req.json();
  const updates: Partial<typeof tasks.$inferInsert> = {};

  if (typeof body.done === "boolean") updates.done = body.done;
  if (typeof body.title === "string" && body.title.trim()) updates.title = body.title.trim();
  if (typeof body.subject === "string") updates.subject = body.subject.trim() || null;
  if (body.dueDate !== undefined) updates.dueDate = body.dueDate ? new Date(body.dueDate) : null;
  if (typeof body.type === "string" && taskType.includes(body.type)) updates.type = body.type;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  const db = getDb();
  const [row] = await db.update(tasks).set(updates).where(eq(tasks.id, id)).returning();

  if (!row) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }

  return NextResponse.json(row);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: idParam } = await params;
  const id = parseId(idParam);
  if (id === null) {
    return NextResponse.json({ error: "Id inválido" }, { status: 400 });
  }

  const db = getDb();
  const [row] = await db.delete(tasks).where(eq(tasks.id, id)).returning();

  if (!row) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
