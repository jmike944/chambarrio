import type { CategoryId, PayPeriod, Shift } from "@/lib/data/types";

/*
 * Candidate profile strength (0–100): a TypeScript port of the SQL function
 * public.profile_strength(profiles) in supabase/migrations/20261107223000_candidate_profiles.sql.
 * Keep the weights in sync with it. Server-safe (no hooks, no client APIs): the candidate's profile
 * editor uses it for the live meter + tips, the employer's applicant cards for demo data and badges.
 *
 * Everything in a richer profile is OPTIONAL; a fuller one just makes the candidate more competitive.
 */

// ------------------------------------------------------------------ enums (mirror the DB)

export type EducationLevel = "primaria" | "secundaria" | "preparatoria" | "tecnico" | "licenciatura";
export type StartAvailability = "inmediata" | "1_semana" | "2_semanas" | "1_mes";
export type Transport = "auto" | "moto" | "bici" | "camion" | "caminando";

export const EDUCATION_LEVELS: readonly EducationLevel[] = ["primaria", "secundaria", "preparatoria", "tecnico", "licenciatura"];
export const START_AVAILABILITIES: readonly StartAvailability[] = ["inmediata", "1_semana", "2_semanas", "1_mes"];
export const TRANSPORTS: readonly Transport[] = ["auto", "moto", "bici", "camion", "caminando"];
export const SHIFTS: readonly Shift[] = ["Matutino", "Vespertino", "Nocturno", "Mixto", "Rotativo"];

/** "Preparatoria", "Carrera técnica"… (highest level finished). */
export const EDUCATION_LABEL: Record<EducationLevel, string> = {
  primaria: "Primaria",
  secundaria: "Secundaria",
  preparatoria: "Preparatoria",
  tecnico: "Carrera técnica",
  licenciatura: "Licenciatura",
};

/** Short, for chips and pickers: "De inmediato", "En 1 semana"… */
export const AVAILABILITY_LABEL: Record<StartAvailability, string> = {
  inmediata: "De inmediato",
  "1_semana": "En 1 semana",
  "2_semanas": "En 2 semanas",
  "1_mes": "En 1 mes",
};

/** A full sentence for the employer's card: "Puede empezar de inmediato". */
export const AVAILABILITY_SENTENCE: Record<StartAvailability, string> = {
  inmediata: "Puede empezar de inmediato",
  "1_semana": "Puede empezar en 1 semana",
  "2_semanas": "Puede empezar en 2 semanas",
  "1_mes": "Puede empezar en 1 mes",
};

/** How they get to work: "Auto propio", "Camión (transporte público)"… */
export const TRANSPORT_LABEL: Record<Transport, string> = {
  auto: "Auto propio",
  moto: "Moto",
  bici: "Bicicleta",
  camion: "Camión",
  caminando: "Caminando",
};

/** Turnos in plain words (the Shift values are already Spanish; these add the hours hint). */
export const SHIFT_HINT: Record<Shift, string> = {
  Matutino: "mañana",
  Vespertino: "tarde",
  Nocturno: "noche",
  Mixto: "mixto",
  Rotativo: "rola turnos",
};

// ------------------------------------------------------------------ limits (mirror the DB checks)

export const PROFILE_LIMITS = {
  headlineMax: 80,
  /** A headline counts toward strength from this many characters. */
  headlineMin: 10,
  aboutMax: 500,
  /** "Sobre mí" counts toward strength from this many characters. */
  aboutMin: 40,
  skillsMax: 20,
  certificationsMax: 15,
  languagesMax: 6,
  experiencesMax: 10,
  experienceTitleMax: 80,
  experienceCompanyMax: 80,
  experienceDescriptionMax: 300,
  expectedPayMin: 100,
  expectedPayMax: 200000,
  /** skills + certifications needed for their 10 points. */
  skillsForPoints: 3,
} as const;

/** At or above this a profile is "Perfil completo" (badge + "Más completos primero"). */
export const PROFILE_COMPLETE_AT = 80;
/** Below this a profile reads as "Perfil básico". */
export const PROFILE_BASIC_BELOW = 40;

// ------------------------------------------------------------------ shapes

/** The optional fields a candidate can add (camelCase of the profiles columns). */
export type CandidateProfileExtras = {
  /** One line, ≤ 80: "Montacarguista con 5 años en CEDIS". */
  headline: string | null;
  /** "Sobre mí", ≤ 500. */
  about: string | null;
  education: EducationLevel | null;
  skills: string[];
  /** Licenses and certificates: "Licencia de montacargas", "DC-3", "Licencia tipo C"… */
  certifications: string[];
  /** "Inglés básico"… (Spanish is assumed). */
  languages: string[];
  shifts: Shift[];
  availableFrom: StartAvailability | null;
  transport: Transport[];
  /** MXN per `expectedPeriod`. */
  expectedPay: number | null;
  expectedPeriod: PayPeriod | null;
  /** Storage path in the private "avatars" bucket ("<user id>/…"). */
  avatarPath: string | null;
  /** Storage path in the private "cvs" bucket ("<user id>/…", PDF). */
  cvPath: string | null;
};

export const EMPTY_PROFILE_EXTRAS: CandidateProfileExtras = {
  headline: null,
  about: null,
  education: null,
  skills: [],
  certifications: [],
  languages: [],
  shifts: [],
  availableFrom: null,
  transport: [],
  expectedPay: null,
  expectedPeriod: null,
  avatarPath: null,
  cvPath: null,
};

/** One row of work history (public.work_experiences, camelCase). Months are "YYYY-MM" or "YYYY-MM-DD". */
export type WorkExperience = {
  id?: string;
  title: string;
  company: string | null;
  category: CategoryId | null;
  startMonth: string | null;
  /** null while `isCurrent`, or when unknown. */
  endMonth: string | null;
  isCurrent: boolean;
  description: string | null;
};

/**
 * What strength is computed from. Everything is optional so callers pass what they have:
 * the candidate editor passes its whole draft; the employer view passes hasPhoto/hasCv instead of paths.
 */
export type StrengthInput = Partial<CandidateProfileExtras> & {
  name?: string | null;
  phone?: string | null;
  /** profiles.home is set (a colonia or GPS point was picked). */
  hasHome?: boolean;
  interests?: readonly string[] | null;
  /** The work history, or just how many rows it has. */
  experiences?: readonly WorkExperience[] | number | null;
  /** Alternative to avatarPath (e.g. the employer only knows has_photo). */
  hasPhoto?: boolean;
  /** Alternative to cvPath. */
  hasCv?: boolean;
};

export type StrengthKey =
  | "name"
  | "phone"
  | "home"
  | "interests"
  | "headline"
  | "about"
  | "experience"
  | "skills"
  | "education"
  | "availability"
  | "photo"
  | "cv";

/** Points per part. They add up to 100. Same as the SQL. */
export const STRENGTH_WEIGHTS: Record<StrengthKey, number> = {
  name: 10,
  phone: 10,
  home: 10,
  interests: 5,
  headline: 10,
  about: 10,
  experience: 15,
  skills: 10,
  education: 5,
  availability: 5,
  photo: 5,
  cv: 5,
};

/** Display order for checklists (basics first, then the richer profile). */
export const STRENGTH_KEYS: readonly StrengthKey[] = [
  "name",
  "phone",
  "home",
  "interests",
  "headline",
  "experience",
  "skills",
  "about",
  "availability",
  "education",
  "photo",
  "cv",
];

const len = (s: string | null | undefined) => (s ?? "").trim().length;
const count = (a: readonly unknown[] | null | undefined) => a?.length ?? 0;

/** Is each part earned? (Exactly the SQL conditions.) */
export function strengthChecks(p: StrengthInput): Record<StrengthKey, boolean> {
  const experiences = typeof p.experiences === "number" ? p.experiences : count(p.experiences);
  return {
    name: len(p.name) >= 2,
    phone: len(p.phone) > 0,
    home: !!p.hasHome,
    interests: count(p.interests) > 0,
    headline: len(p.headline) >= PROFILE_LIMITS.headlineMin,
    about: len(p.about) >= PROFILE_LIMITS.aboutMin,
    experience: experiences > 0,
    skills: count(p.skills) + count(p.certifications) >= PROFILE_LIMITS.skillsForPoints,
    education: !!p.education,
    availability: count(p.shifts) > 0 && !!p.availableFrom,
    photo: !!(p.avatarPath || p.hasPhoto),
    cv: !!(p.cvPath || p.hasCv),
  };
}

/** Profile strength 0–100 (same as public.profile_strength). */
export function strengthOf(p: StrengthInput): number {
  const checks = strengthChecks(p);
  let total = 0;
  for (const k of STRENGTH_KEYS) if (checks[k]) total += STRENGTH_WEIGHTS[k];
  return Math.min(100, total);
}

export type StrengthLevel = "completo" | "medio" | "basico";

/** completo ≥ 80 · basico < 40 · medio in between. */
export function strengthLevel(score: number): StrengthLevel {
  return score >= PROFILE_COMPLETE_AT ? "completo" : score < PROFILE_BASIC_BELOW ? "basico" : "medio";
}

export const STRENGTH_LEVEL_LABEL: Record<StrengthLevel, string> = {
  completo: "Perfil completo",
  medio: "Perfil a medias",
  basico: "Perfil básico",
};

export const isProfileComplete = (score: number) => score >= PROFILE_COMPLETE_AT;

// ------------------------------------------------------------------ tips

export type StrengthTip = {
  key: StrengthKey;
  /** Points this adds when done. */
  points: number;
  /** Imperative, short: "Agrega tu experiencia". */
  title: string;
  /** Why / how, one line. */
  hint: string;
  /** Section id in the profile editor this tip should scroll to (the editor may ignore it). */
  section: StrengthSection;
};

/** Editor sections the tips point at. */
export type StrengthSection = "datos" | "presentacion" | "experiencia" | "habilidades" | "disponibilidad" | "escolaridad" | "archivos";

const TIP_COPY: Record<StrengthKey, { title: string; hint: string; section: StrengthSection }> = {
  name: { title: "Escribe tu nombre", hint: "Así te saluda la empresa cuando te llama.", section: "datos" },
  phone: { title: "Agrega tu teléfono", hint: "Es como te contactan para la entrevista.", section: "datos" },
  home: { title: "Elige tu colonia", hint: "Te mostramos chambas cerca y la empresa ve a qué distancia vives.", section: "datos" },
  interests: { title: "Elige qué chamba buscas", hint: "Montacargas, almacén, caja… para recomendarte mejor.", section: "datos" },
  headline: {
    title: "Escribe una frase que te presente",
    hint: "Por ejemplo: \"Montacarguista con 5 años en CEDIS\". Es lo primero que leen.",
    section: "presentacion",
  },
  about: {
    title: "Cuéntales sobre ti",
    hint: "Dos o tres líneas: qué sabes hacer y qué buscas.",
    section: "presentacion",
  },
  experience: {
    title: "Agrega dónde has trabajado",
    hint: "Aunque sea un trabajo. Las empresas buscan experiencia primero.",
    section: "experiencia",
  },
  skills: {
    title: "Suma licencias y habilidades",
    hint: "Licencia de montacargas, DC-3, inventarios… al menos 3.",
    section: "habilidades",
  },
  education: { title: "Indica tu escolaridad", hint: "Solo el último nivel que terminaste.", section: "escolaridad" },
  availability: {
    title: "Di tus turnos y cuándo puedes empezar",
    hint: "Si puedes empezar ya, destacas con las empresas que tienen prisa.",
    section: "disponibilidad",
  },
  photo: { title: "Sube una foto", hint: "Una foto clara de frente da confianza. Solo la ve quien te contacte.", section: "archivos" },
  cv: { title: "Sube tu CV en PDF", hint: "Opcional, pero ayuda en puestos de oficina o supervisión.", section: "archivos" },
};

/** Tie-break among equal points: what is quickest / most persuasive first. */
const TIP_PRIORITY: readonly StrengthKey[] = [
  "name",
  "phone",
  "home",
  "experience",
  "headline",
  "skills",
  "about",
  "availability",
  "interests",
  "photo",
  "education",
  "cv",
];

/**
 * What to add next, best payoff first (points desc, then the quickest wins). Only missing parts.
 * `limit` caps the list (default: all). Example:
 *   strengthTips(draft, { limit: 3 }) → [{ key: "experience", points: 15, title: "Agrega dónde has trabajado", … }, …]
 */
export function strengthTips(p: StrengthInput, opts: { limit?: number; exclude?: readonly StrengthKey[] } = {}): StrengthTip[] {
  const checks = strengthChecks(p);
  const tips = TIP_PRIORITY.filter((k) => !checks[k] && !opts.exclude?.includes(k))
    .map((k): StrengthTip => ({ key: k, points: STRENGTH_WEIGHTS[k], ...TIP_COPY[k] }))
    .toSorted((a, b) => b.points - a.points || TIP_PRIORITY.indexOf(a.key) - TIP_PRIORITY.indexOf(b.key));
  return opts.limit === undefined ? tips : tips.slice(0, opts.limit);
}

/** Points still missing to reach "Perfil completo" (0 when already there). */
export function pointsToComplete(p: StrengthInput | number): number {
  const s = typeof p === "number" ? p : strengthOf(p);
  return Math.max(0, PROFILE_COMPLETE_AT - s);
}

// ------------------------------------------------------------------ work history helpers

/** "2021-03" / "2021-03-01" → { y, m } (m 1–12), or null. */
export function parseMonth(s: string | null | undefined): { y: number; m: number } | null {
  const match = /^(\d{4})-(\d{1,2})/.exec(s ?? "");
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  return m >= 1 && m <= 12 ? { y, m } : null;
}

/** First day of the month as the DB stores it: "2021-03-01". */
export function toMonthDate(y: number, m: number): string {
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

/** Whole months between start and end (or now when current / no end), never negative. */
export function experienceMonths(e: Pick<WorkExperience, "startMonth" | "endMonth" | "isCurrent">, now: Date = new Date()): number | null {
  const a = parseMonth(e.startMonth);
  if (!a) return null;
  const b = e.isCurrent || !e.endMonth ? { y: now.getFullYear(), m: now.getMonth() + 1 } : parseMonth(e.endMonth);
  if (!b) return null;
  return Math.max(0, (b.y - a.y) * 12 + (b.m - a.m) + 1);
}

/** 14 → "1 año", 30 → "2 años y medio", 5 → "5 meses". */
export function formatDuration(months: number): string {
  if (months < 12) return months <= 1 ? "1 mes" : `${months} meses`;
  const years = months / 12;
  const whole = Math.floor(years);
  const half = years - whole >= 0.5;
  if (whole >= 5 || !half) return whole === 1 ? "1 año" : `${whole} años`;
  return whole === 1 ? "1 año y medio" : `${whole} años y medio`;
}

/** "2021 – hoy · 3 años", "2018 – 2020 · 2 años", "2022 · 5 meses", or "" when there are no dates. */
export function experienceRange(e: Pick<WorkExperience, "startMonth" | "endMonth" | "isCurrent">, now: Date = new Date()): string {
  const a = parseMonth(e.startMonth);
  if (!a) return e.isCurrent ? "Trabajo actual" : "";
  const b = parseMonth(e.endMonth);
  const end = e.isCurrent || !b ? "hoy" : String(b.y);
  const span = !e.isCurrent && b && b.y === a.y ? String(a.y) : `${a.y} – ${end}`;
  const months = experienceMonths(e, now);
  return months ? `${span} · ${formatDuration(months)}` : span;
}

/** Total time across the history (overlaps are not merged; good enough for a summary). */
export function totalExperienceMonths(list: readonly WorkExperience[], now: Date = new Date()): number {
  return list.reduce((sum, e) => sum + (experienceMonths(e, now) ?? 0), 0);
}

// ------------------------------------------------------------------ suggestions for pickers

/** Common licenses / certificates in Saltillo's industrial jobs (editor suggestions). */
export const CERTIFICATION_SUGGESTIONS: readonly string[] = [
  "Licencia de montacargas",
  "DC-3",
  "DC-3 montacargas",
  "DC-3 trabajos en altura",
  "Licencia tipo B",
  "Licencia tipo C",
  "Licencia federal",
  "Manejo higiénico de alimentos",
  "Primeros auxilios",
  "Brigada contra incendios",
  "Seguridad e higiene",
];

/** Common skills (editor suggestions). */
export const SKILL_SUGGESTIONS: readonly string[] = [
  "Inventarios",
  "Escáner RF",
  "Picking y surtido",
  "Carga y descarga",
  "Patín hidráulico",
  "Atención al cliente",
  "Manejo de caja",
  "Excel básico",
  "SAP básico",
  "Lectura de planos",
  "Soldadura",
  "Mantenimiento básico",
  "5S",
  "Trabajo en equipo",
];

export const LANGUAGE_SUGGESTIONS: readonly string[] = ["Inglés básico", "Inglés intermedio", "Inglés avanzado", "Lengua de señas"];


// ------------------------------------------------------------------ editor helpers (additive)

/** Current job first, then by end month, most recent first (same order the employer sees). */
export function sortExperiencesByRecency<T extends Pick<WorkExperience, "isCurrent" | "endMonth" | "startMonth">>(list: readonly T[]): T[] {
  const key = (e: T) => {
    if (e.isCurrent) return "9999-99";
    const m = parseMonth(e.endMonth) ?? parseMonth(e.startMonth);
    return m ? `${m.y}-${String(m.m).padStart(2, "0")}` : "";
  };
  return list.toSorted((a, b) => key(b).localeCompare(key(a)));
}

/** "YYYY-MM" (or "YYYY-MM-DD") → "YYYY-MM-01" for the DB, or null. */
export function monthToDate(s: string | null | undefined): string | null {
  const m = parseMonth(s);
  return m ? toMonthDate(m.y, m.m) : null;
}

/**
 * Checks one work-history entry against the DB rules. Returns a friendly Spanish message for the
 * first problem, or null when it can be saved. `now` decides what "future" means.
 */
export function validateExperience(
  e: Pick<WorkExperience, "title" | "company" | "startMonth" | "endMonth" | "isCurrent" | "description">,
  now: Date = new Date(),
): string | null {
  const title = e.title.trim();
  if (title.length < 2) return "Escribe el puesto (por ejemplo: Cajera, Montacarguista).";
  if (title.length > PROFILE_LIMITS.experienceTitleMax) return `El puesto puede tener hasta ${PROFILE_LIMITS.experienceTitleMax} letras.`;
  if ((e.company ?? "").trim().length > PROFILE_LIMITS.experienceCompanyMax)
    return `La empresa puede tener hasta ${PROFILE_LIMITS.experienceCompanyMax} letras.`;
  if ((e.description ?? "").trim().length > PROFILE_LIMITS.experienceDescriptionMax)
    return `La descripción puede tener hasta ${PROFILE_LIMITS.experienceDescriptionMax} letras.`;
  const a = parseMonth(e.startMonth);
  const b = e.isCurrent ? null : parseMonth(e.endMonth);
  const nowKey = now.getFullYear() * 12 + now.getMonth();
  if (a && a.y * 12 + a.m - 1 > nowKey) return "La fecha de inicio no puede ser en el futuro.";
  if (b && b.y * 12 + b.m - 1 > nowKey) return "La fecha de fin no puede ser en el futuro. Si sigues ahí, marca «Trabajo aquí actualmente».";
  if (a && b && b.y * 12 + b.m < a.y * 12 + a.m) return "La fecha de fin no puede ser antes del inicio.";
  return null;
}

/** Spanish month names for pickers (index 0 = enero). */
export const MONTH_LABELS: readonly string[] = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

/** Which payment periods a candidate can pick for "Sueldo esperado", most common first. */
export const EXPECTED_PERIODS: readonly PayPeriod[] = ["semana", "quincena", "mes", "dia"];
