import type { FetchedEmail } from "./imap";

const NOISE_SENDER_PATTERNS = [
  /mailer-daemon/i,
  /no-?reply@.*(newsletter|marketing)/i,
  /calendar-notification/i,
];

const NOISE_SUBJECT_PATTERNS = [
  /^re: fwd:.*factura/i,
  /unsubscribe/i,
  /date de baja/i,
];

/**
 * Filtro barato (sin IA) para no gastar tokens en correo que obviamente no
 * es de la universidad o es ruido automático (facturas, bajas de listas...).
 * Es intencionadamente laxo: es mejor colar algo de ruido a la IA que
 * perder un aviso real de una tarea.
 */
export function isLikelyAcademic(email: FetchedEmail): boolean {
  const from = email.from.toLowerCase();
  const subject = email.subject.toLowerCase();

  if (NOISE_SENDER_PATTERNS.some((re) => re.test(from))) return false;
  if (NOISE_SUBJECT_PATTERNS.some((re) => re.test(subject))) return false;

  return from.includes("unavarra.es");
}
