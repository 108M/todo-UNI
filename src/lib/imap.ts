import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { convert } from "html-to-text";

// Los avisos automáticos de Aulario/Sakai siempre acaban con este pie fijo
// ("Este mensaje... MiSitio > Preferencias"), a veces tras una línea de
// guiones. Es puro ruido de firma, se recorta.
function stripBoilerplate(text: string): string {
  const idx = text.search(/este mensaje de notificaci[oó]n autom[aá]tica/i);
  if (idx === -1) return text.trim();
  return text.slice(0, idx).replace(/\n-{3,}\s*$/, "").trim();
}

// El .text que genera mailparser para correos solo-HTML a veces pierde los
// saltos de párrafo (todo queda pegado). Convertimos el HTML nosotros mismos
// para conservar párrafos, listas y enlaces legibles.
function extractBody(parsed: { html?: string | false; text?: string }): string {
  if (parsed.html) {
    const converted = convert(parsed.html, {
      wordwrap: false,
      selectors: [
        {
          selector: "a",
          options: { ignoreHref: false, linkBrackets: false, hideLinkHrefIfSameAsText: true },
        },
        { selector: "img", format: "skip" },
      ],
    }).trim();
    return stripBoilerplate(converted);
  }
  return stripBoilerplate(parsed.text || "");
}

export type FetchedEmail = {
  messageId: string;
  subject: string;
  from: string;
  date: Date | null;
  text: string;
};

/**
 * Trae los correos de los últimos `sinceDays` días de la bandeja de entrada.
 * Se usa una ventana de días en vez de "solo no leídos" porque el buzón se
 * revisa desde varios clientes y el flag \Seen no es fiable como cursor.
 */
export async function fetchRecentEmails(sinceDays = 3): Promise<FetchedEmail[]> {
  const client = new ImapFlow({
    host: "imap.unavarra.es",
    port: 993,
    secure: true,
    auth: {
      user: process.env.IMAP_USER!,
      pass: process.env.IMAP_PASSWORD!,
    },
    logger: false,
  });

  const emails: FetchedEmail[] = [];
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      for await (const message of client.fetch(
        { since },
        { envelope: true, source: true },
      )) {
        if (!message.source) continue;
        const parsed = await simpleParser(message.source);
        emails.push({
          messageId: parsed.messageId || `no-id-${message.uid}`,
          subject: parsed.subject || "(sin asunto)",
          from: parsed.from?.text || "",
          date: parsed.date ?? null,
          text: extractBody(parsed).slice(0, 4000),
        });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  return emails;
}
