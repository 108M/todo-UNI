import { convert } from "html-to-text";

const BASE = "https://miaulario.unavarra.es";
const UA = "Mozilla/5.0";

export type AularioNotification = {
  id: number;
  event: string;
  title: string;
  siteId: string;
  siteTitle: string;
  ref: string;
  fromDisplayName: string;
  formattedEventDate: string;
};

type CookieJar = Map<string, string>;

function cookieHeader(jar: CookieJar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function storeCookies(jar: CookieJar, res: Response) {
  const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const c of raw) {
    const [pair] = c.split(";");
    const idx = pair.indexOf("=");
    jar.set(pair.slice(0, idx), pair.slice(idx + 1));
  }
}

async function request(jar: CookieJar, url: string, opts: RequestInit = {}) {
  const res = await fetch(url, {
    ...opts,
    redirect: "manual",
    headers: { "User-Agent": UA, Cookie: cookieHeader(jar), ...(opts.headers || {}) },
  });
  storeCookies(jar, res);
  return res;
}

function extractAttr(html: string, re: RegExp) {
  const m = html.match(re);
  return m ? m[1] : null;
}

function decodeHtmlAttr(v: string) {
  return v.replace(/&#x2b;/gi, "+").replace(/&#43;/g, "+").replace(/&amp;/g, "&");
}

async function followRedirects(jar: CookieJar, startUrl: string, maxHops = 6) {
  let url = startUrl;
  let res = await request(jar, url);
  for (let i = 0; i < maxHops; i++) {
    const loc = res.headers.get("location");
    if (!loc) break;
    url = new URL(loc, url).toString();
    res = await request(jar, url);
  }
  return { res, url, body: await res.text() };
}

async function submitSamlForm(jar: CookieJar, body: string, refUrl: string): Promise<void> {
  const samlResp = extractAttr(body, /name="SAMLResponse" value="([^"]+)"/);
  const relayState = extractAttr(body, /name="RelayState" value="([^"]+)"/);
  const acsAction = extractAttr(body, /<form[^>]*action=['"]([^'"]+)['"]/);
  if (!samlResp || !acsAction) return;

  const form = new URLSearchParams();
  form.set("SAMLResponse", decodeHtmlAttr(samlResp));
  if (relayState) form.set("RelayState", decodeHtmlAttr(relayState));

  const acsUrl = new URL(decodeHtmlAttr(acsAction), refUrl).toString();
  const res = await request(jar, acsUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  let loc = res.headers.get("location");
  let lastBody = "";
  for (let i = 0; i < 5 && loc; i++) {
    const full = new URL(loc, acsUrl).toString();
    const r = await request(jar, full);
    loc = r.headers.get("location");
    lastBody = await r.text();
  }
  // Algunos IdP encadenan un segundo salto SAML (SP -> IdP -> SP).
  if (lastBody && /name="SAMLResponse"/.test(lastBody)) {
    await submitSamlForm(jar, lastBody, acsUrl);
  }
}

/**
 * Login SSO (SAML) de Aulario con las mismas credenciales que el correo
 * (imap.unavarra.es). Sesión efímera: hay que repetir el login en cada
 * ejecución del cron, no se puede cachear la cookie entre invocaciones.
 */
export async function loginToAulario(): Promise<CookieJar> {
  const eid = process.env.IMAP_USER!;
  const pw = process.env.IMAP_PASSWORD!;
  const jar: CookieJar = new Map();

  const { body: ssoPage, url: ssoUrl } = await followRedirects(jar, `${BASE}/portal/login`);
  const requestId = extractAttr(ssoPage, /name="adAS_request_id" value="([^"]+)"/);
  const i18nTheme = extractAttr(ssoPage, /name="adAS_i18n_theme" value="([^"]+)"/) || "es";
  const actionUrl = extractAttr(ssoPage, /<form action='([^']+)'/);
  if (!requestId || !actionUrl) throw new Error("No se encontró el formulario de login SSO");

  const loginForm = new URLSearchParams({
    adAS_mode: "authn",
    adAS_request_id: requestId,
    adAS_i18n_theme: i18nTheme,
    adAS_username: eid,
    adAS_password: pw,
    adAS_submit: "Aceptar",
  });

  const postRes = await request(jar, actionUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: loginForm.toString(),
  });
  const postBody = await postRes.text();

  await submitSamlForm(jar, postBody, actionUrl);

  const portalRes = await request(jar, `${BASE}/portal`);
  const portalHtml = await portalRes.text();
  if (!/"loggedIn":\s*true/.test(portalHtml)) {
    throw new Error("Login en Aulario falló (credenciales o flujo SAML cambiado)");
  }

  return jar;
}

export async function fetchNotifications(jar: CookieJar): Promise<AularioNotification[]> {
  const res = await request(jar, `${BASE}/api/users/me/notifications`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchAnnouncementBody(jar: CookieJar, ref: string): Promise<string> {
  const res = await request(jar, `${BASE}/direct${ref}.json`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return "";
  const data = await res.json();
  if (!data.body) return "";
  return convert(data.body, { wordwrap: false }).trim();
}

export type AularioAssignment = {
  id: string;
  title: string;
  dueDateEpochSeconds: number | null;
  instructions: string;
};

export async function fetchAssignment(
  jar: CookieJar,
  siteId: string,
  assignmentId: string,
): Promise<AularioAssignment | null> {
  const res = await request(jar, `${BASE}/direct/assignment/site/${siteId}.json`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const list = data.assignment_collection || [];
  const match = list.find((a: { id: string }) => a.id === assignmentId);
  if (!match) return null;

  return {
    id: match.id,
    title: match.gradebookItemName || match.title || "Tarea",
    dueDateEpochSeconds: match.dueTime?.epochSecond ?? null,
    instructions: match.instructions
      ? convert(match.instructions, { wordwrap: false }).trim()
      : "",
  };
}
