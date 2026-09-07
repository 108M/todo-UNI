import webpush from "web-push";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { pushSubscriptions } from "@/db/schema";

export type PushPayload = { title: string; body: string; url?: string };

function configure() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
}

/**
 * Manda la notificación a todas las suscripciones guardadas (normalmente
 * será solo el móvil del usuario, pero admite varios dispositivos). Las
 * suscripciones caducadas (404/410) se borran solas.
 */
export async function sendPushToAll(payload: PushPayload) {
  const db = getDb();
  const subs = await db.select().from(pushSubscriptions);
  if (subs.length === 0) return;

  configure();

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
        }
      }
    }),
  );
}
