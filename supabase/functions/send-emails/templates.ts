/**
 * Chambarrio notification emails: new_applicant, application_status and job_digest.
 *
 * Pure string functions with no Deno or Node APIs, so the Edge Function imports them and a local
 * script can render samples. Every payload value is HTML-escaped. Styles are inline and the layout is
 * table-based because most email clients drop <style> and ignore flex/grid. The look follows
 * supabase/templates/code-email.html (lavender page, white card with ink border, violet header).
 */

export type EmailKind = "new_applicant" | "application_status" | "job_digest";
export type UnsubscribeKind = "alerts" | "updates";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export const SITE_URL = "https://chambarrio.com";

const enc = encodeURIComponent;

/** Public URLs. The unsubscribe paths are a contract with the web app (/avisos/baja). */
export const urls = {
  vacancy: (jobId: string) => `${SITE_URL}/vacantes/${enc(jobId)}`,
  employerVacancy: (jobId: string) => `${SITE_URL}/empresa/vacantes/${enc(jobId)}`,
  applications: `${SITE_URL}/postulaciones`,
  home: `${SITE_URL}/inicio`,
  candidatePrefs: `${SITE_URL}/perfil`,
  employerPrefs: `${SITE_URL}/empresa`,
  unsubscribe: (token: string, k: UnsubscribeKind) => `${SITE_URL}/avisos/baja?t=${enc(token)}&k=${k}`,
  oneClickUnsubscribe: (token: string, k: UnsubscribeKind) =>
    `${SITE_URL}/avisos/baja/un-clic?t=${enc(token)}&k=${k}`,
};

/** job_digest is governed by profiles.email_alerts; the other kinds by profiles.email_updates. */
export const unsubscribeKindFor = (kind: EmailKind): UnsubscribeKind =>
  kind === "job_digest" ? "alerts" : "updates";

export function isEmailKind(kind: unknown): kind is EmailKind {
  return kind === "new_applicant" || kind === "application_status" || kind === "job_digest";
}

/** Renders one outbox row. Throws on an unknown kind or application status. */
export function renderEmail(kind: EmailKind, payload: unknown, unsubscribeToken: string | null): RenderedEmail {
  const p = obj(payload);
  switch (kind) {
    case "new_applicant":
      return renderNewApplicant(p, unsubscribeToken);
    case "application_status":
      return renderApplicationStatus(p, unsubscribeToken);
    case "job_digest":
      return renderJobDigest(p, unsubscribeToken);
    default:
      throw new Error(`unknown kind ${String(kind)}`);
  }
}

// ------------------------------------------------------------------------------------- payload utils

type Obj = Record<string, unknown>;

const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});

const str = (v: unknown): string =>
  typeof v === "string" ? v.trim() : typeof v === "number" && Number.isFinite(v) ? String(v) : "";

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escapes text for HTML element content and attribute values. */
export const esc = (v: unknown): string => String(v ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);

/** Subjects are plain text: one line, no runaway length. */
function subjectLine(s: string): string {
  const line = s.replace(/\s+/g, " ").trim();
  return line.length > 140 ? `${line.slice(0, 139)}…` : line;
}

const capitalize = (s: string) => (s ? s.charAt(0).toLocaleUpperCase("es-MX") + s.slice(1) : s);

// ------------------------------------------------------------------------------------------ formats

const PERIOD: Record<string, string> = {
  semana: "por semana",
  quincena: "por quincena",
  mes: "al mes",
  dia: "por día",
};

const CATEGORY: Record<string, string> = {
  produccion: "Producción",
  almacen: "Almacén",
  montacargas: "Montacargas",
  chofer: "Chofer y reparto",
  restaurante: "Restaurantes",
  caja: "Caja y tienda",
  ventas: "Ventas",
  limpieza: "Limpieza",
  mantenimiento: "Mantenimiento",
  construccion: "Construcción",
  seguridad: "Seguridad",
  oficina: "Oficina",
};

/** "$2,600" (whole pesos; deterministic, no Intl data needed). */
const money = (n: number) => `$${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;

/** "$2,600 por semana" or "$2,400–2,800 por semana". */
function formatPay(pay: number | null, payMax: number | null, period: string): string | null {
  if (pay === null || pay <= 0) return null;
  const range = payMax !== null && payMax > pay ? `${money(pay)}–${money(payMax).slice(1)}` : money(pay);
  const per = PERIOD[period];
  return per ? `${range} ${per}` : range;
}

/** "2.3 km", "12 km" or "menos de 100 m". The database already rounds to 0.1 km. */
function formatKm(km: number | null): string | null {
  if (km === null || km < 0) return null;
  if (km < 0.1) return "menos de 100 m";
  return `${km < 10 ? Math.round(km * 10) / 10 : Math.round(km)} km`;
}

/** Mexican numbers → "844 123 4567" + "tel:+528441234567". Anything else is shown as typed. */
function formatPhone(raw: string): { display: string; href: string } | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  let national = digits;
  if (digits.length === 12 && digits.startsWith("52")) national = digits.slice(2);
  else if (digits.length === 13 && digits.startsWith("521")) national = digits.slice(3);
  if (national.length === 10) {
    return {
      display: `${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`,
      href: `tel:+52${national}`,
    };
  }
  return { display: raw.trim(), href: `tel:${raw.trim().startsWith("+") ? "+" : ""}${digits}` };
}

// ------------------------------------------------------------------------------------------- layout

const INK = "#160f33";
const VIOLET = "#4318e0";
const LIME = "#ddf78a";
const LAVENDER = "#f4f2ff";
const BODY = "#4b4568";
const MUTED = "#6b6590";
const FONT = "Arial,Helvetica,sans-serif";

const b = (s: string) => `<strong style="color:${INK};">${esc(s)}</strong>`;

const h1 = (html: string) =>
  `<h1 style="margin:0 0 10px 0;font-family:${FONT};font-size:25px;line-height:1.2;font-weight:800;color:${INK};">${html}</h1>`;

const para = (html: string, extra = "") =>
  `<p style="margin:0 0 18px 0;font-family:${FONT};font-size:16px;line-height:1.5;color:${BODY};${extra}">${html}</p>`;

/** Ink pill button (table-wrapped so Outlook paints the background). */
const button = (href: string, label: string) => `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:6px 0 22px 0;">
  <tr>
    <td bgcolor="${INK}" style="background-color:${INK};border-radius:999px;">
      <a href="${esc(href)}" style="display:inline-block;padding:15px 28px;font-family:${FONT};font-size:16px;line-height:1;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px;">${esc(label)}&nbsp;&nbsp;&rarr;</a>
    </td>
  </tr>
</table>`;

/** Lime highlight card with the ink border. */
const limeBox = (inner: string) => `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate;margin:4px 0 18px 0;">
  <tr>
    <td bgcolor="${LIME}" style="background-color:${LIME};border:3px solid ${INK};border-radius:16px;padding:16px 18px;font-family:${FONT};color:${INK};">${inner}</td>
  </tr>
</table>`;

/** Soft lavender note (privacy and tips). */
const note = (html: string) => `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate;margin:0 0 20px 0;">
  <tr>
    <td bgcolor="${LAVENDER}" style="background-color:${LAVENDER};border-radius:12px;padding:12px 14px;font-family:${FONT};font-size:14px;line-height:1.45;color:${BODY};">${html}</td>
  </tr>
</table>`;

const eyebrow = (label: string, color = INK) =>
  `<p style="margin:0 0 4px 0;font-family:${FONT};font-size:11px;line-height:1.3;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${color};">${esc(label)}</p>`;

/** Label/value rows inside a highlight box. Values are pre-escaped HTML. */
function facts(rows: [string, string][]): string {
  if (rows.length === 0) return "";
  const tr = rows
    .map(
      ([label, value]) => `
    <tr>
      <td valign="top" style="padding:7px 10px 0 0;width:96px;font-family:${FONT};font-size:13px;line-height:1.4;color:${INK};opacity:0.75;">${esc(label)}</td>
      <td valign="top" style="padding:7px 0 0 0;font-family:${FONT};font-size:15px;line-height:1.4;font-weight:700;color:${INK};">${value}</td>
    </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:6px;border-top:2px solid ${INK};">${tr}</table>`;
}

const boxTitle = (s: string) =>
  `<p style="margin:0;font-family:${FONT};font-size:19px;line-height:1.3;font-weight:800;color:${INK};">${esc(s)}</p>`;

const boxSub = (s: string) =>
  s ? `<p style="margin:3px 0 8px 0;font-family:${FONT};font-size:14px;line-height:1.4;color:${INK};">${esc(s)}</p>` : "";

const link = (href: string, label: string, color = VIOLET) =>
  `<a href="${esc(href)}" style="color:${color};font-weight:700;text-decoration:underline;">${esc(label)}</a>`;

interface FooterInfo {
  reason: string;
  unsubscribeUrl: string | null;
  prefsUrl: string;
}

function footerHtml(f: FooterInfo): string {
  const links = [
    f.unsubscribeUrl ? link(f.unsubscribeUrl, "Dejar de recibir estos correos", MUTED) : "",
    link(f.prefsUrl, "Ajustar mis avisos", MUTED),
  ]
    .filter(Boolean)
    .join(`&nbsp;&nbsp;·&nbsp;&nbsp;`);
  return `<p style="margin:0 0 10px 0;">${esc(f.reason)}</p>
<p style="margin:0 0 14px 0;">${links}</p>
<p style="margin:0;"><span style="font-weight:800;color:${INK};">chambarri<span style="color:${VIOLET};">o</span></span> · El trabajo que buscas, cerca de ti · Saltillo, Coahuila</p>`;
}

function footerText(f: FooterInfo): string {
  return [
    "—",
    f.reason,
    f.unsubscribeUrl ? `Dejar de recibir estos correos: ${f.unsubscribeUrl}` : "",
    `Ajustar mis avisos: ${f.prefsUrl}`,
    "Chambarrio · El trabajo que buscas, cerca de ti · Saltillo, Coahuila",
  ]
    .filter(Boolean)
    .join("\n");
}

interface LayoutInput {
  subject: string;
  preheader: string;
  label: string;
  content: string;
  footer: FooterInfo;
}

function layout(o: LayoutInput): string {
  // Invisible filler after the preheader keeps inboxes from pulling body text into the preview.
  const filler = "&#847;&zwnj;&nbsp;".repeat(40);
  return `<!DOCTYPE html>
<html lang="es-MX" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${esc(o.subject)}</title>
<style>:root{color-scheme:light only;supported-color-schemes:light only;}</style>
</head>
<body style="margin:0;padding:0;background-color:${LAVENDER};-webkit-text-size-adjust:100%;" bgcolor="${LAVENDER}">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${LAVENDER};">${esc(o.preheader)}${filler}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${LAVENDER}" style="background-color:${LAVENDER};">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <!--[if mso]><table role="presentation" width="480" align="center" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" style="max-width:480px;margin:0 auto;background-color:#ffffff;border:3px solid ${INK};border-radius:20px;border-collapse:separate;overflow:hidden;">
        <tr>
          <td bgcolor="${VIOLET}" style="background-color:${VIOLET};padding:18px 22px 18px 24px;border-bottom:3px solid ${INK};border-radius:17px 17px 0 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td style="font-family:${FONT};font-size:25px;line-height:1;font-weight:800;letter-spacing:-0.5px;color:#ffffff;">
                  <a href="${SITE_URL}" style="color:#ffffff;text-decoration:none;">chambarri<span style="color:${LIME};">o</span></a>
                </td>
                <td align="right" style="font-family:${FONT};padding-left:10px;">
                  <span style="display:inline-block;background-color:${LIME};border:2px solid ${INK};border-radius:999px;padding:5px 11px;font-size:12px;line-height:1.2;font-weight:700;color:${INK};text-align:center;">${esc(o.label)}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 24px 6px 24px;font-family:${FONT};color:${INK};">${o.content}
          </td>
        </tr>
        <tr>
          <td style="padding:18px 24px 24px 24px;border-top:2px solid #e7e3fb;font-family:${FONT};font-size:13px;line-height:1.5;color:${MUTED};">
            ${footerHtml(o.footer)}
          </td>
        </tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td>
  </tr>
</table>
</body>
</html>`;
}

const unsubscribeUrlFor = (token: string | null, k: UnsubscribeKind) => (token ? urls.unsubscribe(token, k) : null);

/** Joins text lines; null/false entries are dropped, "" stays as a blank line. */
const lines = (...xs: (string | false | null | undefined)[]) => xs.filter((x) => typeof x === "string").join("\n");

// ------------------------------------------------------------------------------------ new_applicant

function renderNewApplicant(p: Obj, token: string | null): RenderedEmail {
  const jobId = str(p.job_id);
  const job = str(p.job_title) || "tu vacante";
  const branch = str(p.branch_name);
  const colonia = str(p.colonia);
  const km = formatKm(num(p.km));
  const experience = str(p.experience);
  const href = jobId ? urls.employerVacancy(jobId) : urls.employerPrefs;
  const branchOr = branch || "tu sucursal";

  const subject = subjectLine(`Nueva postulación: ${job}`);

  let sentenceHtml: string;
  let sentenceText: string;
  if (colonia && km) {
    sentenceHtml = `Alguien que vive en ${b(colonia)}, a ${b(km)} de ${b(branchOr)}, se postuló a ${b(job)}.`;
    sentenceText = `Alguien que vive en ${colonia}, a ${km} de ${branchOr}, se postuló a ${job}.`;
  } else if (colonia) {
    sentenceHtml = `Alguien que vive en ${b(colonia)} se postuló a ${b(job)}.`;
    sentenceText = `Alguien que vive en ${colonia} se postuló a ${job}.`;
  } else if (km) {
    sentenceHtml = `Alguien que vive a ${b(km)} de ${b(branchOr)} se postuló a ${b(job)}.`;
    sentenceText = `Alguien que vive a ${km} de ${branchOr} se postuló a ${job}.`;
  } else {
    sentenceHtml = `Alguien se postuló a ${b(job)}.`;
    sentenceText = `Alguien se postuló a ${job}.`;
  }

  const rows: [string, string][] = [];
  if (branch) rows.push(["Sucursal", esc(branch)]);
  if (colonia) rows.push(["Vive en", esc(colonia)]);
  if (km) rows.push(["Distancia", `${esc(km)} de la sucursal`]);
  rows.push(["Experiencia", esc(experience || "Sin especificar")]);

  const privacy =
    "Por privacidad, su nombre y teléfono aparecen cuando desbloqueas la vacante en Chambarrio.";

  const footer: FooterInfo = {
    reason: "Te llegó este correo porque publicaste vacantes en Chambarrio y tienes activados los avisos de postulaciones.",
    unsubscribeUrl: unsubscribeUrlFor(token, "updates"),
    prefsUrl: urls.employerPrefs,
  };

  const content = [
    h1("¡Tienes una nueva postulación!"),
    para(sentenceHtml),
    limeBox(eyebrow("Vacante") + boxTitle(job) + facts(rows)),
    note(`<strong style="color:${INK};">¿Quién es?</strong> ${esc(privacy)}`),
    button(href, "Ver postulación"),
  ].join("");

  const preheader = colonia
    ? `Alguien de ${colonia} quiere trabajar en ${job}. Revisa la postulación.`
    : `Alguien quiere trabajar en ${job}. Revisa la postulación.`;

  return {
    subject,
    html: layout({ subject, preheader, label: "Nueva postulación", content, footer }),
    text: lines(
      "¡Tienes una nueva postulación!",
      "",
      sentenceText,
      "",
      `Vacante: ${job}`,
      branch ? `Sucursal: ${branch}` : null,
      colonia ? `Vive en: ${colonia}` : null,
      km ? `Distancia: ${km} de la sucursal` : null,
      `Experiencia: ${experience || "Sin especificar"}`,
      "",
      privacy,
      "",
      `Ver postulación: ${href}`,
      "",
      footerText(footer),
    ),
  };
}

// ------------------------------------------------------------------------------- application_status

const DAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "jueves 13 de noviembre" + "9:30 a.m." in Saltillo time (es-MX), or null when the value isn't a date. */
function formatWhen(v: unknown): { day: string; time: string } | null {
  const raw = str(v);
  const d = raw ? new Date(raw) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  // Saltillo (America/Monterrey) is UTC-6 all year since Mexico dropped DST in 2022. A fixed offset,
  // like the app's src/lib/pipeline/time.ts, so the email and the app never disagree by an hour on a
  // runtime with an old tz database.
  const l = new Date(d.getTime() - 6 * 3600_000);
  const parts = { weekday: l.getUTCDay(), day: l.getUTCDate(), month: l.getUTCMonth(), hour: l.getUTCHours(), minute: l.getUTCMinutes() };
  const h12 = parts.hour % 12 === 0 ? 12 : parts.hour % 12;
  return {
    day: `${DAYS[parts.weekday]} ${parts.day} de ${MONTHS[parts.month]}`,
    time: `${h12}:${String(parts.minute).padStart(2, "0")} ${parts.hour < 12 ? "a.m." : "p.m."}`,
  };
}

const BRING = [
  "INE (identificación oficial)",
  "CURP",
  "Comprobante de domicilio",
  "Número de Seguro Social (NSS)",
  "RFC, si lo tienes",
  "Solicitud de empleo elaborada",
];

const FIRST_DAY_TIPS = [
  "Llega 15 minutos antes de tu hora de entrada.",
  "Lleva tu INE y los papeles que te pidan.",
  "Pregunta por tu jefe o jefa directa al llegar.",
  "Usa ropa y zapatos cómodos y cerrados.",
  "Confirma por llamada o SMS tu hora y lugar de entrada.",
];

const bulletList = (items: string[]) =>
  `<ul style="margin:6px 0 0 0;padding:0 0 0 20px;font-family:${FONT};font-size:15px;line-height:1.5;color:${INK};">${items
    .map((i) => `<li style="margin:0 0 3px 0;">${esc(i)}</li>`)
    .join("")}</ul>`;

/** Company's own words, quoted. Value is escaped; newlines become line breaks. */
const quoteBox = (title: string, msg: string) =>
  `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate;margin:0 0 18px 0;"><tr><td bgcolor="${LAVENDER}" style="background-color:${LAVENDER};border-left:4px solid ${VIOLET};border-radius:8px;padding:12px 14px;font-family:${FONT};font-size:15px;line-height:1.5;color:${INK};"><span style="display:block;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${MUTED};margin-bottom:4px;">${esc(title)}</span>${esc(msg).replace(/\r?\n/g, "<br>")}</td></tr></table>`;

/**
 * What a non-status email is about (payload.change, from the v3 trigger): a new time ("hora", same as
 * the older `rescheduled: true`), a new place, new instructions, a message after the hire, or a
 * declined application the company opened again.
 */
type StatusChange = "hora" | "lugar" | "indicaciones" | "mensaje" | "reabierta" | null;

function statusChange(p: Obj): StatusChange {
  const c = str(p.change);
  if (c === "hora" || c === "lugar" || c === "indicaciones" || c === "mensaje" || c === "reabierta") return c;
  return p.rescheduled === true ? "hora" : null;
}

function renderApplicationStatus(p: Obj, token: string | null): RenderedEmail {
  const status = str(p.status);
  const change = statusChange(p);
  const rescheduled = change === "hora";
  const detailsChanged = change === "lugar" || change === "indicaciones";
  const job = str(p.job_title) || "la vacante";
  const company = str(p.company_name) || "La empresa";
  const branch = str(p.branch_name);
  const colonia = str(p.colonia);
  const phone = formatPhone(str(p.phone));
  const jobId = str(p.job_id);
  const place = str(p.interview_place);
  const interviewNote = str(p.interview_note);
  const companyMessage = str(p.company_message);
  const when = formatWhen(p.interview_at);
  const where = [company, branch].filter(Boolean).join(" · ");
  const atBranch = branch ? ` en ${b(branch)}` : "";
  const atBranchText = branch ? ` en ${branch}` : "";

  let label: string;
  let subject: string;
  let headingHtml: string;
  let bodyHtml: string;
  let bodyText: string;
  let preheader: string;
  let phoneLabel: string | null = null;
  let extraHtml = "";
  let extraText: (string | null)[] = [];
  let buttonLabel = "Ver mi postulación";
  let buttonUrl = urls.applications;
  let highlight = "";
  let highlightText: (string | null)[] = [];

  switch (status) {
    case "vista":
      label = "Tu postulación";
      subject = `${company} vio tu postulación`;
      headingHtml = `${esc(company)} vio tu postulación`;
      bodyHtml = `Tu postulación a ${b(job)}${atBranch} ya fue revisada. Es buena señal: si tu perfil les interesa, te van a contactar por llamada o SMS para la entrevista. Ten tu celular a la mano y contesta los números que no conoces.`;
      bodyText = `Tu postulación a ${job}${atBranchText} ya fue revisada. Es buena señal: si tu perfil les interesa, te van a contactar por llamada o SMS para la entrevista. Ten tu celular a la mano y contesta los números que no conoces.`;
      preheader = `Ya revisaron tu postulación a ${job}. Ten tu celular a la mano.`;
      extraHtml = note(`Mientras tanto, sigue buscando: ${link(urls.home, "mira más vacantes cerca de ti")}.`);
      extraText = [`Mientras tanto, mira más vacantes cerca de ti: ${urls.home}`];
      buttonLabel = "Ver mis postulaciones";
      break;
    case "entrevista": {
      phoneLabel = "¿No puedes ir?";
      const whenLine = when ? `${capitalize(when.day)}, ${when.time}` : "";
      if (rescheduled) {
        label = "Cambio de horario";
        subject = `Cambio de horario: entrevista con ${company}`;
        headingHtml = `Cambió el horario de tu entrevista`;
        bodyHtml = `${b(company)} cambió el día u hora de tu entrevista para ${b(job)}${atBranch}. Este es el nuevo horario, ya no vale el anterior.`;
        bodyText = `${company} cambió el día u hora de tu entrevista para ${job}${atBranchText}. Este es el nuevo horario, ya no vale el anterior.`;
        preheader = whenLine ? `Nuevo horario: ${whenLine}.` : `Cambió el horario de tu entrevista con ${company}.`;
      } else if (detailsChanged) {
        const what = change === "lugar" ? "el lugar" : "las indicaciones";
        label = "Cambio en tu entrevista";
        subject = `Cambio en tu entrevista con ${company}`;
        headingHtml = change === "lugar" ? `Cambió el lugar de tu entrevista` : `Hay cambios en tu entrevista`;
        bodyHtml = `${b(company)} cambió ${what} de tu entrevista para ${b(job)}${atBranch}.${when ? " El día y la hora siguen igual." : ""} Revisa los datos nuevos antes de ir.`;
        bodyText = `${company} cambió ${what} de tu entrevista para ${job}${atBranchText}.${when ? " El día y la hora siguen igual." : ""} Revisa los datos nuevos antes de ir.`;
        preheader =
          change === "lugar" && place ? `Nuevo lugar: ${place}.` : whenLine ? `Tu entrevista sigue el ${whenLine}. Revisa los cambios.` : `Revisa los cambios de tu entrevista.`;
      } else {
        label = "¡Entrevista!";
        subject = when ? `Entrevista con ${company}: ${when.day}, ${when.time}` : `¡${company} quiere entrevistarte!`;
        headingHtml = `¡${esc(company)} quiere entrevistarte!`;
        bodyHtml = `Les interesó tu perfil para ${b(job)}${atBranch}. ${when ? "Esta es tu cita." : "Te van a llamar o mandar un SMS para ponerse de acuerdo en el día y la hora; ten tu celular a la mano."}`;
        bodyText = `Les interesó tu perfil para ${job}${atBranchText}. ${when ? "Esta es tu cita." : "Te van a llamar o mandar un SMS para ponerse de acuerdo en el día y la hora; ten tu celular a la mano."}`;
        preheader = whenLine ? `${whenLine}${place ? ` · ${place}` : ""}. Revisa qué llevar.` : `Te van a llamar o mandar un SMS para agendar tu entrevista.`;
      }
      if (when) {
        const prefix = rescheduled ? "Nuevo horario" : "Tu entrevista";
        highlight = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate;margin:4px 0 18px 0;"><tr><td bgcolor="${VIOLET}" style="background-color:${VIOLET};border:3px solid ${INK};border-radius:16px;padding:16px 18px;font-family:${FONT};color:#ffffff;"><p style="margin:0 0 4px 0;font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${LIME};">${esc(prefix)}</p><p style="margin:0;font-size:22px;line-height:1.25;font-weight:800;color:#ffffff;">${esc(capitalize(when.day))}</p><p style="margin:2px 0 0 0;font-size:22px;line-height:1.25;font-weight:800;color:${LIME};">${esc(when.time)}</p>${place ? `<p style="margin:10px 0 0 0;font-size:15px;line-height:1.4;color:#ffffff;"><strong>${change === "lugar" ? "Nuevo lugar:" : "Lugar:"}</strong> ${esc(place)}</p>` : ""}${interviewNote ? `<p style="margin:8px 0 0 0;font-size:15px;line-height:1.4;color:#ffffff;"><strong>Aviso de la empresa:</strong> ${esc(interviewNote).replace(/\r?\n/g, "<br>")}</p>` : ""}</td></tr></table>`;
        highlightText = [
          `${prefix.toUpperCase()}: ${whenLine}`,
          place ? `${change === "lugar" ? "Nuevo lugar" : "Lugar"}: ${place}` : null,
          interviewNote ? `Aviso de la empresa: ${interviewNote}` : null,
        ];
      } else {
        if (place) highlightText.push(`Lugar: ${place}`);
        if (interviewNote) highlightText.push(`Aviso de la empresa: ${interviewNote}`);
        if (place || interviewNote) {
          highlight = limeBox(
            eyebrow("Entrevista") +
              (place ? `<p style="margin:4px 0 0 0;font-size:15px;"><strong>Lugar:</strong> ${esc(place)}</p>` : "") +
              (interviewNote ? `<p style="margin:6px 0 0 0;font-size:15px;"><strong>Aviso:</strong> ${esc(interviewNote)}</p>` : ""),
          );
        }
      }
      extraHtml = note(
        `<strong style="color:${INK};">Qué llevar:</strong>${bulletList(BRING)}<p style="margin:10px 0 0 0;">Llega unos 10 minutos antes y contesta los números que no conoces estos días.</p>`,
      );
      extraText = ["QUÉ LLEVAR:", ...BRING.map((i) => `- ${i}`), "", "Llega unos 10 minutos antes y contesta los números que no conoces estos días."];
      break;
    }
    case "contratada":
      label = "¡Te eligieron!";
      subject = `¡Felicidades! ${company} te eligió para ${job}`;
      headingHtml = `¡Felicidades! ${esc(company)} te eligió para ${esc(job)}`;
      bodyHtml = `Pronto te van a contactar para darte los detalles de tu primer día${atBranch}. ¡Mucho éxito en tu nueva chamba!`;
      bodyText = `Pronto te van a contactar para darte los detalles de tu primer día${atBranchText}. ¡Mucho éxito en tu nueva chamba!`;
      preheader = `Pronto te contactan con los detalles de tu primer día. ¡Mucho éxito!`;
      phoneLabel = "¿Dudas?";
      if (companyMessage) {
        highlight = quoteBox(`Mensaje de ${company}`, companyMessage);
        highlightText = [`Mensaje de ${company}:`, companyMessage];
      }
      extraHtml = note(`<strong style="color:${INK};">Para tu primer día:</strong>${bulletList(FIRST_DAY_TIPS)}`);
      extraText = ["PARA TU PRIMER DÍA:", ...FIRST_DAY_TIPS.map((i) => `- ${i}`)];
      break;
    case "cerrada":
      label = "Tu postulación";
      subject = `Novedades de tu postulación a ${job}`;
      headingHtml = `Novedades de tu postulación`;
      bodyHtml = `Gracias por postularte a ${b(job)}${atBranch}. Esta vez la empresa decidió no continuar con tu postulación. No es un reflejo de lo que vales: hay más chamba cerca de ti y tu perfil sigue listo.`;
      bodyText = `Gracias por postularte a ${job}${atBranchText}. Esta vez la empresa decidió no continuar con tu postulación. No es un reflejo de lo que vales: hay más chamba cerca de ti y tu perfil sigue listo.`;
      preheader = `Hay más vacantes cerca de ti. Tu perfil sigue listo.`;
      if (companyMessage) {
        highlight = quoteBox(`Mensaje de ${company}`, companyMessage);
        highlightText = [`Mensaje de ${company}:`, companyMessage];
      }
      buttonLabel = "Ver vacantes parecidas";
      buttonUrl = urls.home;
      break;
    default:
      throw new Error(`unsupported application status ${status || "(empty)"}`);
  }

  if (change === "mensaje" && status === "contratada") {
    // A welcome message written after the hire email: only the message is new.
    label = "Mensaje de la empresa";
    subject = `${company} te dejó un mensaje`;
    headingHtml = `${esc(company)} te dejó un mensaje`;
    bodyHtml = `Es sobre tu contratación para ${b(job)}${atBranch}.`;
    bodyText = `Es sobre tu contratación para ${job}${atBranchText}.`;
    preheader = companyMessage ? companyMessage.slice(0, 110) : `Sobre tu contratación para ${job}.`;
  } else if (change === "reabierta" && status !== "cerrada") {
    // The company declined (that email may have gone out) and then opened it again.
    const still =
      status === "entrevista"
        ? when
          ? "Tu entrevista sigue en pie."
          : "Te van a llamar o mandar un SMS para acordar la entrevista."
        : status === "contratada"
          ? "Tu contratación sigue en pie. Pronto te contactan para tu primer día."
          : "Sigues en el proceso: si tu perfil les interesa, te contactan por llamada o SMS.";
    label = "Buenas noticias";
    subject = `${company} retomó tu postulación a ${job}`;
    headingHtml = `${esc(company)} retomó tu postulación`;
    bodyHtml = `Volvieron a abrir tu postulación a ${b(job)}${atBranch}. Olvida el aviso anterior. ${esc(still)}`;
    bodyText = `Volvieron a abrir tu postulación a ${job}${atBranchText}. Olvida el aviso anterior. ${still}`;
    preheader = `Olvida el aviso anterior: sigues en el proceso.`;
  }

  const rows: [string, string][] = [];
  if (colonia) rows.push(["Colonia", esc(colonia)]);
  if (phone && phoneLabel) {
    rows.push([
      phoneLabel,
      `<a href="${esc(phone.href)}" style="color:${INK};font-weight:800;text-decoration:underline;">${esc(phone.display)}</a>`,
    ]);
  }

  const footer: FooterInfo = {
    reason: "Te llegó este correo porque te postulaste a una vacante en Chambarrio y tienes activados los avisos de tus postulaciones.",
    unsubscribeUrl: unsubscribeUrlFor(token, "updates"),
    prefsUrl: urls.candidatePrefs,
  };

  const isInterview = status === "entrevista";
  const phoneCall =
    phone && phoneLabel
      ? isInterview
        ? `¿No puedes ir? Llama o manda SMS al ${phone.display}`
        : `${phoneLabel} Llama al ${phone.display}`
      : null;
  // tel: and sms: links side by side (no WhatsApp).
  const smsHref = phone ? phone.href.replace(/^tel:/, "sms:") : "";
  const phoneNote =
    isInterview && phone
      ? note(
          `<strong style="color:${INK};">¿No puedes ir?</strong> <a href="${esc(phone.href)}" style="color:${INK};font-weight:800;text-decoration:underline;">Llama</a> o <a href="${esc(smsHref)}" style="color:${INK};font-weight:800;text-decoration:underline;">manda SMS</a> al <a href="${esc(phone.href)}" style="color:${INK};font-weight:800;text-decoration:underline;">${esc(phone.display)}</a>.`,
        )
      : "";

  const content = [
    h1(headingHtml),
    para(bodyHtml),
    highlight,
    limeBox(
      eyebrow("Vacante") +
        boxTitle(job) +
        boxSub(where) +
        facts(isInterview ? rows.filter(([l]) => l === "Colonia") : rows) +
        (jobId
          ? `<p style="margin:12px 0 0 0;font-family:${FONT};font-size:14px;">${link(urls.vacancy(jobId), "Ver la vacante", INK)}</p>`
          : ""),
    ),
    phoneNote,
    extraHtml,
    button(buttonUrl, buttonLabel),
  ].join("");

  const finalSubject = subjectLine(subject);
  return {
    subject: finalSubject,
    html: layout({ subject: finalSubject, preheader, label, content, footer }),
    text: lines(
      finalSubject,
      "",
      bodyText,
      "",
      ...highlightText,
      highlightText.length ? "" : null,
      `Vacante: ${job}`,
      where ? `Empresa: ${where}` : null,
      colonia ? `Colonia: ${colonia}` : null,
      phoneCall,
      jobId ? `Ver la vacante: ${urls.vacancy(jobId)}` : null,
      "",
      ...extraText,
      extraText.length ? "" : null,
      `${buttonLabel}: ${buttonUrl}`,
      "",
      footerText(footer),
    ),
  };
}

// --------------------------------------------------------------------------------------- job_digest

interface DigestJob {
  id: string;
  title: string;
  category: string;
  pay: string | null;
  company: string;
  branch: string;
  colonia: string;
  km: string | null;
}

function digestJob(v: unknown): DigestJob | null {
  const j = obj(v);
  const id = str(j.id);
  const title = str(j.title);
  if (!id || !title) return null;
  return {
    id,
    title,
    category: CATEGORY[str(j.category)] ?? "",
    pay: formatPay(num(j.pay), num(j.pay_max), str(j.period)),
    company: str(j.company_name),
    branch: str(j.branch_name),
    colonia: str(j.colonia),
    km: formatKm(num(j.km)),
  };
}

function jobCard(j: DigestJob): string {
  const href = urls.vacancy(j.id);
  const where = [j.company, j.branch].filter(Boolean).join(" · ");
  const place = [
    j.colonia ? esc(j.colonia) : "",
    j.km ? `<strong style="color:${INK};">a ${esc(j.km)}</strong>` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const pill = j.pay
    ? `<span style="display:inline-block;background-color:${LIME};border:2px solid ${INK};border-radius:999px;padding:4px 10px;font-size:13px;line-height:1.3;font-weight:800;color:${INK};">${esc(j.pay)}</span>`
    : `<span style="font-size:13px;color:${BODY};">Sueldo a convenir</span>`;
  return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate;margin:0 0 12px 0;">
  <tr>
    <td bgcolor="#ffffff" style="background-color:#ffffff;border:2px solid ${INK};border-radius:14px;padding:14px 16px;font-family:${FONT};">
      ${j.category ? eyebrow(j.category, VIOLET) : ""}
      <a href="${esc(href)}" style="font-family:${FONT};font-size:17px;line-height:1.3;font-weight:800;color:${INK};text-decoration:none;">${esc(j.title)}</a>
      ${where ? `<p style="margin:3px 0 0 0;font-family:${FONT};font-size:14px;line-height:1.4;color:${BODY};">${esc(where)}</p>` : ""}
      ${place ? `<p style="margin:2px 0 0 0;font-family:${FONT};font-size:14px;line-height:1.4;color:${BODY};">${place}</p>` : ""}
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:10px;">
        <tr>
          <td valign="middle" style="font-family:${FONT};">${pill}</td>
          <td align="right" valign="middle" style="font-family:${FONT};font-size:14px;white-space:nowrap;padding-left:8px;">
            <a href="${esc(href)}" style="color:${VIOLET};font-weight:700;text-decoration:none;">Ver&nbsp;&rarr;</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

function renderJobDigest(p: Obj, token: string | null): RenderedEmail {
  const jobs = (Array.isArray(p.jobs) ? p.jobs : [])
    .map(digestJob)
    .filter((j): j is DigestJob => j !== null)
    .slice(0, 5);
  const total = Math.max(Math.round(num(p.total) ?? 0), jobs.length);
  const radius = num(p.radius_km);
  const radiusLabel = radius !== null && radius > 0 ? `${radius} km` : null;
  const firstName = capitalize(str(p.name).split(/\s+/)[0] ?? "");
  const nounPhrase = total === 1 ? "1 vacante nueva" : `${total} vacantes nuevas`;
  const more = total - jobs.length;
  const moreText = more === 1 ? "1 vacante más te espera" : `${more} vacantes más te esperan`;

  const subject = subjectLine(`${nounPhrase} cerca de ti`);
  const greeting = firstName ? `¡Hola, ${firstName}!` : "¡Hola!";

  const footer: FooterInfo = {
    reason: "Te llegó este correo porque activaste las alertas diarias de vacantes cerca de ti en Chambarrio.",
    unsubscribeUrl: unsubscribeUrlFor(token, "alerts"),
    prefsUrl: urls.candidatePrefs,
  };

  const radiusChip = radiusLabel
    ? `<span style="display:inline-block;background-color:${LIME};border:2px solid ${INK};border-radius:999px;padding:5px 12px;font-family:${FONT};font-size:13px;line-height:1.2;font-weight:700;color:${INK};white-space:nowrap;">Dentro de tus ${esc(radiusLabel)}</span>`
    : "";

  const intro =
    total === 1
      ? `Hay ${b(nounPhrase)} cerca de ti que va con lo que buscas.`
      : `Hay ${b(nounPhrase)} cerca de ti que van con lo que buscas.`;
  const introText =
    total === 1
      ? `Hay ${nounPhrase} cerca de ti que va con lo que buscas.`
      : `Hay ${nounPhrase} cerca de ti que van con lo que buscas.`;

  const listTitle = jobs.length > 1 ? "Las más cercanas" : "";

  const content = [
    h1(esc(greeting)),
    para(intro, "margin-bottom:14px;"),
    radiusChip ? `<p style="margin:0 0 22px 0;">${radiusChip}</p>` : "",
    listTitle
      ? `<p style="margin:0 0 10px 0;font-family:${FONT};font-size:13px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${INK};">${listTitle}</p>`
      : "",
    jobs.map(jobCard).join(""),
    more > 0 ? para(`Y ${b(moreText)} en Chambarrio.`, "margin-top:6px;") : "",
    button(urls.home, "Ver todas"),
  ].join("");

  const first = jobs[0];
  const preheader = first
    ? `${first.title}${first.km ? ` a ${first.km}` : ""}${total > 1 ? ` y ${total - 1} más` : ""}${radiusLabel ? `, dentro de tus ${radiusLabel}` : ""}.`
    : `Nuevas vacantes cerca de ti${radiusLabel ? `, dentro de tus ${radiusLabel}` : ""}.`;

  const jobLines = jobs.flatMap((j, i) => [
    `${i + 1}. ${j.title}${j.company || j.branch ? ` — ${[j.company, j.branch].filter(Boolean).join(" · ")}` : ""}`,
    `   ${[j.pay, j.colonia, j.km ? `a ${j.km}` : ""].filter(Boolean).join(" · ")}`,
    `   ${urls.vacancy(j.id)}`,
    "",
  ]);

  return {
    subject,
    html: layout({ subject, preheader, label: "Vacantes del día", content, footer }),
    text: lines(
      greeting,
      "",
      introText,
      radiusLabel ? `Dentro de tus ${radiusLabel}.` : null,
      "",
      ...jobLines,
      more > 0 ? `Y ${moreText} en Chambarrio.` : null,
      `Ver todas: ${urls.home}`,
      "",
      footerText(footer),
    ),
  };
}
