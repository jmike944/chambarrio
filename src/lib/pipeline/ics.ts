/*
 * Calendar file (.ics, RFC 5545) for an interview, so the candidate can add it to Google Calendar /
 * iPhone Calendar in one tap. Pure and dependency-free (Blob/URL helpers need a browser).
 *
 * - CRLF line endings, lines folded at 75 octets (never inside a UTF-8 character).
 * - TEXT values escape \ ; , and newlines.
 * - Times are UTC ("…Z"), so the event lands at the right hour on any device timezone.
 * - UID is stable per application: re-downloading after a reschedule updates the same event in
 *   calendars that honour UID + SEQUENCE.
 */

export type InterviewIcsInput = {
  /** Stable id of the application (live uuid or demo id). Becomes `entrevista-<id>@chambarrio.com`. */
  applicationId: string;
  /** Interview start (ISO instant, epoch ms or Date). */
  start: string | number | Date;
  /** Default 60. */
  durationMin?: number;
  jobTitle: string;
  companyName: string;
  /** LOCATION. Usually `interview.place`, else the branch ("CEDIS Santa Mónica · Parque Industrial…"). */
  place?: string | null;
  /** Map pin (the branch), written as GEO when known. */
  geo?: { lat: number; lng: number } | null;
  /** The company's instructions (interview.note). */
  note?: string | null;
  /** Contact phone for the vacancy (10 digits); shown as "llama o manda SMS". */
  phone?: string | null;
  /** Link back to the application in Chambarrio. */
  url?: string | null;
  /** Bump on each reschedule (e.g. number of "entrevista" events − 1). Default 0. */
  sequence?: number;
  /** DTSTAMP; defaults to now (pass it in tests). */
  now?: string | number | Date;
  /** Reminder before the start, in minutes (default 60; 0 = no reminder). */
  alarmMin?: number;
};

const CRLF = "\r\n";

const ms = (t: string | number | Date) => (typeof t === "number" ? t : typeof t === "string" ? Date.parse(t) : t.getTime());

/** 20261109T160000Z */
export function icsUtc(t: string | number | Date): string {
  return new Date(ms(t)).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Escapes a TEXT value (RFC 5545 §3.3.11). Control characters other than newlines are dropped. */
export function icsEscape(value: string): string {
  return value
    .replace(/\r\n|\r/g, "\n")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

const utf8Len = (cp: number) => (cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4);

/** Folds one content line at 75 octets: CRLF + a single space before each continuation. */
export function icsFold(line: string): string {
  const out: string[] = [];
  let current = "";
  let octets = 0;
  let limit = 75;
  for (const ch of line) {
    const n = utf8Len(ch.codePointAt(0) ?? 0);
    if (octets + n > limit) {
      out.push(current);
      current = "";
      octets = 0;
      limit = 74; // the leading space counts toward the 75
    }
    current += ch;
    octets += n;
  }
  out.push(current);
  return out.join(`${CRLF} `);
}

/** "8441234512" → "844 123 4512" (other lengths are returned trimmed). */
export function formatPhoneMx(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const local = digits.length === 12 && digits.startsWith("52") ? digits.slice(2) : digits;
  return local.length === 10 ? `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}` : phone.trim();
}

/** The .ics text (CRLF-terminated). */
export function buildInterviewIcs(i: InterviewIcsInput): string {
  const start = ms(i.start);
  if (!Number.isFinite(start)) throw new Error("buildInterviewIcs: invalid start");
  const end = start + Math.max(15, i.durationMin ?? 60) * 60_000;
  const summary = `Entrevista: ${i.jobTitle.trim()} · ${i.companyName.trim()}`;
  const place = i.place?.trim() || null;
  const note = i.note?.trim() || null;
  const phone = i.phone?.trim() ? formatPhoneMx(i.phone) : null;

  const description = [
    note ?? "Lleva tu INE y llega 10 minutos antes.",
    phone ? `Si no puedes ir o vas tarde, llama o manda SMS al ${phone}.` : null,
    i.url ? `Tu postulación: ${i.url}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const uidSafe = i.applicationId.replace(/[^A-Za-z0-9._-]/g, "-");
  const alarm = i.alarmMin ?? 60;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Chambarrio//Entrevistas//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:entrevista-${uidSafe}@chambarrio.com`,
    `DTSTAMP:${icsUtc(i.now ?? Date.now())}`,
    `DTSTART:${icsUtc(start)}`,
    `DTEND:${icsUtc(end)}`,
    `SEQUENCE:${Math.max(0, Math.floor(i.sequence ?? 0))}`,
    `SUMMARY:${icsEscape(summary)}`,
    place ? `LOCATION:${icsEscape(place)}` : null,
    i.geo && Number.isFinite(i.geo.lat) && Number.isFinite(i.geo.lng) ? `GEO:${i.geo.lat.toFixed(6)};${i.geo.lng.toFixed(6)}` : null,
    `DESCRIPTION:${icsEscape(description)}`,
    i.url ? `URL:${i.url.replace(/[\r\n]/g, "")}` : null,
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    ...(alarm > 0
      ? ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsEscape(summary)}`, `TRIGGER:-PT${Math.round(alarm)}M`, "END:VALARM"]
      : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter((l): l is string => l !== null);

  return lines.map(icsFold).join(CRLF) + CRLF;
}

/** "entrevista-auxiliar-de-farmacia.ics" */
export function icsFileName(jobTitle: string): string {
  const slug = jobTitle
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `entrevista${slug ? `-${slug}` : ""}.ics`;
}

/** The .ics as a Blob (text/calendar, UTF-8). */
export function icsBlob(ics: string): Blob {
  return new Blob([ics], { type: "text/calendar;charset=utf-8" });
}

/** Object URL for the .ics. Call URL.revokeObjectURL when done (downloadIcs does it for you). */
export function icsObjectUrl(ics: string): string {
  return URL.createObjectURL(icsBlob(ics));
}

/** data: URL (works where blob downloads are flaky, e.g. some installed-PWA webviews). */
export function icsDataUrl(ics: string): string {
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

/**
 * Triggers the download / "Agregar al calendario" sheet. Call it from a click handler. iOS opens the
 * Calendar preview; Android hands it to the calendar app or saves it to Descargas.
 */
export function downloadIcs(ics: string, fileName = "entrevista.ics"): void {
  const url = icsObjectUrl(ics);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
