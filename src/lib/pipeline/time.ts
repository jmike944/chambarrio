/*
 * Dates and times for the hiring pipeline, always in Saltillo time (America/Monterrey) and es-MX,
 * whatever timezone the phone is set to. Pure and dependency-free: safe in server components and in
 * plain Node (the scratch tests import this file directly).
 *
 * Inputs (`DateInput`) are ISO strings, epoch ms or Date. Outputs are lowercase unless
 * `capitalize: true` ("mañana, 10:00 a.m." → "Mañana, 10:00 a.m.").
 */

export const MTY_TZ = "America/Monterrey";

export type DateInput = string | number | Date;

/** Wall-clock fields of an instant in Saltillo. `weekday`: 0 = domingo … 6 = sábado. */
export type MtyWall = { year: number; month: number; day: number; hour: number; minute: number; second: number; weekday: number };

/** What `<input type="date">` / `<input type="time">` hold: "2026-11-09" and "10:00". */
export type ZonedInput = { date: string; time: string };

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const WEEKDAY_SHORT = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const WEEKDAY_LONG = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTH_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MONTH_LONG = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];
const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// en-US only to read numeric parts reliably; nothing user-facing comes from this formatter.
const PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: MTY_TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  weekday: "short",
});

/** Epoch ms of an input; NaN when it can't be parsed. */
export function toMs(t: DateInput): number {
  if (typeof t === "number") return t;
  if (typeof t === "string") return Date.parse(t);
  return t.getTime();
}

const valid = (ms: number) => Number.isFinite(ms);

/** Saltillo wall-clock fields of an instant. */
export function mtyWall(t: DateInput): MtyWall {
  const ms = toMs(t);
  const out: MtyWall = { year: 0, month: 0, day: 0, hour: 0, minute: 0, second: 0, weekday: 0 };
  for (const p of PARTS.formatToParts(new Date(ms))) {
    if (p.type === "year") out.year = Number(p.value);
    else if (p.type === "month") out.month = Number(p.value);
    else if (p.type === "day") out.day = Number(p.value);
    else if (p.type === "hour") out.hour = Number(p.value) % 24;
    else if (p.type === "minute") out.minute = Number(p.value);
    else if (p.type === "second") out.second = Number(p.value);
    else if (p.type === "weekday") out.weekday = WEEKDAY_INDEX[p.value] ?? 0;
  }
  return out;
}

/** Saltillo's UTC offset at an instant, in ms (−6 h → −21 600 000). */
function offsetAt(ms: number): number {
  const w = mtyWall(ms);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** The instant (epoch ms) of a Saltillo wall-clock time. Handles a DST rule should one ever return. */
export function mtyInstant(year: number, month: number, day: number, hour = 0, minute = 0): number {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const first = guess - offsetAt(guess);
  const second = guess - offsetAt(first);
  return second;
}

const pad = (n: number) => String(n).padStart(2, "0");
const dateKeyOf = (w: Pick<MtyWall, "year" | "month" | "day">) => `${w.year}-${pad(w.month)}-${pad(w.day)}`;

/** "2026-11-09": the Saltillo calendar day of an instant (for grouping and for date inputs). */
export function mtyDateKey(t: DateInput): string {
  return dateKeyOf(mtyWall(t));
}

/** Instant → the values for a date + time picker, in Saltillo time. Empty strings for an invalid input. */
export function toZonedInput(t: DateInput | null | undefined): ZonedInput {
  if (t === null || t === undefined || !valid(toMs(t))) return { date: "", time: "" };
  const w = mtyWall(t);
  return { date: dateKeyOf(w), time: `${pad(w.hour)}:${pad(w.minute)}` };
}

/**
 * Date + time picker values, read as Saltillo time → ISO instant ("2026-11-09T16:00:00.000Z").
 * Accepts "YYYY-MM-DD" and "HH:mm" (or "H:mm", seconds ignored). Null when either is missing/invalid.
 */
export function fromZonedInput(date: string, time: string): string | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  const t = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(time.trim());
  if (!d || !t) return null;
  const [year, month, day, hour, minute] = [Number(d[1]), Number(d[2]), Number(d[3]), Number(t[1]), Number(t[2])];
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  // Reject impossible dates (31 de febrero) instead of rolling them over.
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;
  return new Date(mtyInstant(year, month, day, hour, minute)).toISOString();
}

/** Adds whole days to a "YYYY-MM-DD" key (calendar math, no timezone involved). */
export function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Calendar days from `b` to `a` in Saltillo (a = mañana, b = hoy → 1). */
export function mtyDayDiff(a: DateInput, b: DateInput): number {
  const wa = mtyWall(a);
  const wb = mtyWall(b);
  return Math.round((Date.UTC(wa.year, wa.month - 1, wa.day) - Date.UTC(wb.year, wb.month - 1, wb.day)) / DAY);
}

export function isSameMtyDay(a: DateInput, b: DateInput): boolean {
  return mtyDateKey(a) === mtyDateKey(b);
}

/**
 * The next working day (Mon–Sat; Sunday skipped) at hour:minute Saltillo time, at least `minDays`
 * calendar days after `from`. Used for demo seeds and as the interview picker's default.
 */
export function nextWorkdayAt(from: DateInput, hour: number, minute = 0, minDays = 1): string {
  let key = addDaysToKey(mtyDateKey(from), minDays);
  const weekday = (k: string) => new Date(`${k}T12:00:00Z`).getUTCDay();
  if (weekday(key) === 0) key = addDaysToKey(key, 1);
  const [y, m, d] = key.split("-").map(Number);
  return new Date(mtyInstant(y, m, d, hour, minute)).toISOString();
}

/** Default value for a new interview: next working day, 10:00. */
export function defaultInterviewInput(now: DateInput = Date.now()): ZonedInput {
  return toZonedInput(nextWorkdayAt(now, 10, 0));
}

/** `min` for the date picker: today in Saltillo. */
export function todayInputKey(now: DateInput = Date.now()): string {
  return mtyDateKey(now);
}

// ------------------------------------------------------------------ formatting

export const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const cap = (s: string, on?: boolean) => (on ? capitalize(s) : s);

export type TimeOptions = { h24?: boolean };
export type RelOptions = { now?: DateInput; capitalize?: boolean };

/** "10:00 a.m." / "4:30 p.m." (h24: "16:30"). A no-break space keeps "a.m." with the time. */
export function fmtTime(t: DateInput, opts: TimeOptions = {}): string {
  const ms = toMs(t);
  if (!valid(ms)) return "";
  const w = mtyWall(ms);
  if (opts.h24) return `${w.hour}:${pad(w.minute)}`;
  const h12 = w.hour % 12 === 0 ? 12 : w.hour % 12;
  return `${h12}:${pad(w.minute)} ${w.hour < 12 ? "a.m." : "p.m."}`;
}

/** "vie 13 nov" (+ " 2027" when it isn't this year in Saltillo). */
export function fmtDate(t: DateInput, opts: { now?: DateInput; weekday?: boolean } = {}): string {
  const ms = toMs(t);
  if (!valid(ms)) return "";
  const w = mtyWall(ms);
  const thisYear = mtyWall(opts.now ?? Date.now()).year;
  const base = `${opts.weekday === false ? "" : `${WEEKDAY_SHORT[w.weekday]} `}${w.day} ${MONTH_SHORT[w.month - 1]}`;
  return w.year === thisYear ? base : `${base} ${w.year}`;
}

/** "viernes 13 de noviembre" (+ " de 2027" when it isn't this year). */
export function fmtDateLong(t: DateInput, opts: RelOptions = {}): string {
  const ms = toMs(t);
  if (!valid(ms)) return "";
  const w = mtyWall(ms);
  const thisYear = mtyWall(opts.now ?? Date.now()).year;
  const base = `${WEEKDAY_LONG[w.weekday]} ${w.day} de ${MONTH_LONG[w.month - 1]}`;
  return cap(w.year === thisYear ? base : `${base} de ${w.year}`, opts.capitalize);
}

/** "hoy" / "mañana" / "ayer" / "pasado mañana" when it applies, else null. */
export function relativeDayWord(t: DateInput, now: DateInput = Date.now()): string | null {
  const diff = mtyDayDiff(t, now);
  if (diff === 0) return "hoy";
  if (diff === 1) return "mañana";
  if (diff === -1) return "ayer";
  if (diff === 2) return "pasado mañana";
  return null;
}

/** Day + time: "hoy, 4:30 p.m." · "mañana, 10:00 a.m." · "vie 13 nov, 10:00 a.m.". */
export function fmtDayTime(t: DateInput, opts: RelOptions & TimeOptions = {}): string {
  const ms = toMs(t);
  if (!valid(ms)) return "";
  const day = relativeDayWord(ms, opts.now ?? Date.now()) ?? fmtDate(ms, { now: opts.now });
  return cap(`${day}, ${fmtTime(ms, opts)}`, opts.capitalize);
}

/** Like fmtDayTime but with the long date ("viernes 13 de noviembre, 10:00 a.m."); for the interview card. */
export function fmtDayTimeLong(t: DateInput, opts: RelOptions & TimeOptions = {}): string {
  const ms = toMs(t);
  if (!valid(ms)) return "";
  const word = relativeDayWord(ms, opts.now ?? Date.now());
  const long = fmtDateLong(ms, { now: opts.now });
  const day = word === "hoy" || word === "mañana" ? `${word} ${long}` : long;
  return cap(`${day}, ${fmtTime(ms, opts)}`, opts.capitalize);
}

/**
 * Relative time, both directions: "justo ahora", "hace 5 min", "hace 2 h", "ayer", "hace 3 días",
 * "en 20 min", "en 3 h", "mañana", "en 4 días"; a week or more away → the short date ("13 nov").
 */
export function fmtRelative(t: DateInput, opts: RelOptions = {}): string {
  const ms = toMs(t);
  if (!valid(ms)) return "";
  const now = toMs(opts.now ?? Date.now());
  const delta = ms - now;
  const abs = Math.abs(delta);
  const past = delta <= 0;
  let out: string;
  if (abs < MIN) out = past ? "justo ahora" : "en un momento";
  else if (abs < HOUR) {
    const m = Math.round(abs / MIN);
    out = past ? `hace ${m} min` : `en ${m} min`;
  } else {
    const days = mtyDayDiff(ms, now);
    if (abs < 6 * HOUR || (days === 0 && abs < DAY)) {
      const h = Math.round(abs / HOUR);
      out = past ? `hace ${h} h` : `en ${h} h`;
    } else if (days === -1) out = "ayer";
    else if (days === 1) out = "mañana";
    else if (Math.abs(days) < 7) out = past ? `hace ${-days} días` : `en ${days} días`;
    else out = fmtDate(ms, { now, weekday: false });
  }
  return cap(out, opts.capitalize);
}

/** Has the instant passed (with an optional grace, e.g. an interview counts as "now" for 1 h)? */
export function isPast(t: DateInput, opts: { now?: DateInput; graceMs?: number } = {}): boolean {
  const ms = toMs(t);
  return valid(ms) && ms + (opts.graceMs ?? 0) < toMs(opts.now ?? Date.now());
}
