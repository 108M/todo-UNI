import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { pushSubscriptions } from "@/db/schema";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { endpoint, keys } = body || {};

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "Suscripción inválida" }, { status: 400 });
  }

  const db = getDb();
  await db
    .insert(pushSubscriptions)
    .values({ endpoint, p256dh: keys.p256dh, auth: keys.auth })
    .onConflictDoNothing({ target: pushSubscriptions.endpoint });

  return NextResponse.json({ ok: true });
}
