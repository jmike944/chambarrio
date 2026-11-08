"use client";

import { getSupabase } from "@/lib/supabase/client";
import type { Database, NearJob, Tables } from "@/lib/supabase/database.types";
import type {
  Application,
  ApplicationStatus,
  Branch,
  CategoryId,
  Company,
  CompanySize,
  EmploymentType,
  Experience,
  Job,
  PayPeriod,
  Shift,
} from "@/lib/data/types";
import { RADIUS_STOPS, type LatLng, type RadiusKm } from "@/lib/geo";
import { sanitizeAvatar, type AvatarConfig } from "@/components/avatar/config";
import {
  EDUCATION_LEVELS,
  EMPTY_PROFILE_EXTRAS,
  EXPECTED_PERIODS,
  PROFILE_LIMITS,
  SHIFTS,
  START_AVAILABILITIES,
  TRANSPORTS,
  monthToDate,
  type CandidateProfileExtras,
  type WorkExperience,
} from "@/lib/profile-strength";

/*
 * Pure Supabase calls for live mode. No store imports (the store imports this file); every function
 * returns a Spanish, user-facing error instead of throwing. Screens should import from
 * "@/lib/live/backend" (same functions plus the store-aware ones), not from here.
 */

type Enums = Database["public"]["Enums"];
export type JobStatus = Enums["job_status"];
export type AppRole = Enums["app_role"];
export type LocationSource = Enums["location_source"];
export type LivePlan = Enums["plan_id"];

export type WriteResult = { error?: string };
export type Result<T> = { data: T; error?: undefined } | { data?: undefined; error: string };

/** A vacancy as its owner sees it: every status, with the live applicant count. */
export type MyJob = Job & { status: JobStatus };

export type LiveCompany = {
  id: string;
  name: string;
  kind: string;
  size: CompanySize;
  verified: boolean;
  about: string;
  employees: string;
  phone: string | null;
  plan: LivePlan;
  /** Ordered by `sort` (the first is the main site). */
  branches: Branch[];
};

export type LiveProfile = {
  role: AppRole;
  name: string;
  phone: string | null;
  email: string | null;
  interests: CategoryId[];
  experience: Experience;
  colonia: string | null;
  home: LatLng | null;
  locationSource: LocationSource;
  radiusKm: RadiusKm;
  onboarded: boolean;
  /** profiles.email_alerts: the daily digest of new vacancies nearby. */
  emailAlerts: boolean;
  /** profiles.email_updates: application updates (candidate) / new applicants (business owner). */
  emailUpdates: boolean;
  /** The optional richer candidate profile (headline, skills, availability, photo/CV paths…). */
  extras: CandidateProfileExtras;
  /** public.profile_strength(profiles), 0–100; null when the server didn't send it. */
  strength: number | null;
  /** profiles.avatar_config, sanitized; null = never saved. */
  avatar: AvatarConfig | null;
  /**
   * false when the row came back without an avatar_config column (migration
   * 20261108000000_avatar_config.sql not applied yet): the store then keeps the avatar on the device.
   */
  avatarStored: boolean;
};

/** A saved work-history row (server id). */
export type LiveExperience = WorkExperience & { id: string };

export type LiveSessionData = {
  profile: LiveProfile;
  /** The candidate's work history (ordered by `sort`); null when it couldn't be loaded. */
  experiences: LiveExperience[] | null;
  applications: Application[];
  saved: string[];
  company: LiveCompany | null;
  /** Vacancies of my company whose applicants are unlocked right now. */
  unlockedJobIds: string[];
};

/** What a company sees about one applicant (job_applicants RPC). name/phone are null while locked. */
export type LiveApplicant = {
  id: string;
  jobId: string;
  status: ApplicationStatus;
  colonia: string;
  /** Distance from the branch, rounded to 100 m; null if the applicant never set a home. */
  km: number | null;
  experience: Experience;
  interests: CategoryId[];
  minutesAgo: number;
  unlocked: boolean;
  name: string | null;
  phone: string | null;
};

export type JobInput = {
  branchId: string;
  title: string;
  category: CategoryId;
  pay: number;
  payMax?: number | null;
  period: PayPeriod;
  shift: Shift;
  schedule?: string;
  type?: EmploymentType;
  experience?: Experience;
  benefits?: string[];
  requirements?: string[];
  description?: string;
  openings?: number;
  urgent?: boolean;
  /** Contact phone for this vacancy; defaults to none (the company phone is shown instead). */
  phone?: string | null;
};

export type BusinessInput = {
  name: string;
  kind: string;
  size: CompanySize;
  phone?: string | null;
  about?: string;
  employees?: string;
  /** At least one; created in order, so the first one is the main site (sort 0). */
  locations: Omit<Branch, "id">[];
};

export type CompanyPatch = Partial<Pick<LiveCompany, "name" | "kind" | "size" | "about" | "employees">> & { phone?: string | null };

export type ProfilePatch = Partial<
  Pick<
    Database["public"]["Tables"]["profiles"]["Update"],
    | "role"
    | "name"
    | "phone"
    | "email"
    | "interests"
    | "experience"
    | "radius_km"
    | "onboarded"
    | "email_alerts"
    | "email_updates"
    | "headline"
    | "about"
    | "education"
    | "skills"
    | "certifications"
    | "languages"
    | "shifts"
    | "available_from"
    | "transport"
    | "expected_pay"
    | "expected_period"
    | "avatar_path"
    | "cv_path"
  >
>;

// ------------------------------------------------------------------ errors

export const MSG = {
  unavailable: "El modo en vivo no está disponible en este momento.",
  offline: "Sin conexión. Revisa tu internet e intenta de nuevo.",
  session: "Tu sesión terminó. Vuelve a entrar.",
  denied: "No tienes permiso para hacer eso.",
  save: "No pudimos guardar el cambio. Intenta de nuevo.",
  load: "No pudimos cargar la información. Revisa tu conexión e intenta de nuevo.",
  lastBranch: "Tu negocio necesita al menos una sucursal.",
  branchHasJobs:
    "Esta sucursal tiene vacantes registradas (abiertas, pausadas o cerradas). Cámbialas a otra sucursal antes de quitarla.",
  noCompany: "Primero registra tu negocio.",
  jobClosed: "Esta vacante ya no recibe postulaciones.",
  jobGone: "Esa vacante ya no existe.",
  experienceLimit: `Puedes guardar hasta ${PROFILE_LIMITS.experiencesMax} experiencias. Borra una para agregar otra.`,
} as const;

type DbError = { message?: string; code?: string; details?: string | null } | null | undefined;

/** Maps a Postgrest/Postgres/network error to friendly Spanish. `fallback` covers the unknown. */
export function friendlyError(e: DbError, fallback: string = MSG.save): string {
  if (!e) return fallback;
  const m = `${e.message ?? ""} ${e.details ?? ""}`.toLowerCase();
  const code = e.code ?? "";
  if (/failed to fetch|networkerror|network request failed|load failed|fetch failed|err_internet/.test(m)) return MSG.offline;
  if (code === "PGRST301" || code === "PGRST303" || m.includes("jwt")) return MSG.session;
  if (m.includes("una empresa necesita al menos una sucursal")) return MSG.lastBranch;
  if (m.includes("solo la empresa puede cambiar")) return "Solo la empresa puede cambiar el estado de la postulación.";
  if (code === "42501" || m.includes("no autorizado") || m.includes("row-level security") || m.includes("permission denied"))
    return MSG.denied;
  return fallback;
}

function client() {
  return getSupabase();
}

async function currentUserId(): Promise<string | null> {
  const sb = client();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.user.id ?? null;
}

// ------------------------------------------------------------------ mapping

const minutesSince = (iso: string, now: number) => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.max(0, Math.round((now - t) / 60000)) : 0;
};

const asRadius = (n: number): RadiusKm => ((RADIUS_STOPS as readonly number[]).includes(n) ? (n as RadiusKm) : 5);

/**
 * Reads a PostGIS point as PostgREST returns it: hex EWKB ("0101000020E6100000…"). Also accepts
 * GeoJSON. Keeps geography details out of UI code.
 */
export function parsePoint(value: unknown): LatLng | null {
  if (value && typeof value === "object" && "coordinates" in value) {
    const [lng, lat] = (value as { coordinates: number[] }).coordinates;
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }
  if (typeof value !== "string" || value.length < 42 || !/^[0-9a-f]+$/i.test(value)) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(value.slice(i * 2, i * 2 + 2), 16);
  const view = new DataView(bytes.buffer);
  const le = bytes[0] === 1;
  const type = view.getUint32(1, le);
  if ((type & 0x0fffffff) !== 1) return null; // not a point
  const offset = 5 + (type & 0x20000000 ? 4 : 0); // skip SRID
  if (bytes.length < offset + 16) return null;
  const lng = view.getFloat64(offset, le);
  const lat = view.getFloat64(offset + 8, le);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

/** EWKT for a geography column (backend only — UI code never builds these). */
function ewkt(p: LatLng): string {
  if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) throw new Error("bad point");
  return `SRID=4326;POINT(${p.lng} ${p.lat})`;
}

export function nearJobToJob(r: NearJob, now = Date.now()): Job {
  return {
    id: r.id,
    title: r.title,
    companyId: r.company_id,
    branchId: r.branch_id,
    category: r.category,
    pay: r.pay,
    payMax: r.pay_max ?? undefined,
    period: r.period,
    shift: r.shift,
    schedule: r.schedule ?? "",
    type: r.type,
    experience: r.experience,
    benefits: r.benefits ?? [],
    requirements: r.requirements ?? [],
    description: r.description ?? "",
    location: { lat: r.branch_lat, lng: r.branch_lng },
    colonia: r.colonia,
    postedMinutesAgo: minutesSince(r.created_at, now),
    openings: r.openings,
    applicants: Number(r.applicants) || 0,
    urgent: r.urgent || undefined,
    phone: r.phone ?? "",
  };
}

type JobRow = Tables<"jobs">;

function jobRowToJob(r: JobRow, branch: { colonia: string; location: LatLng }, applicants: number, now: number): Job {
  return {
    id: r.id,
    title: r.title,
    companyId: r.company_id,
    branchId: r.branch_id,
    category: r.category,
    pay: r.pay,
    payMax: r.pay_max ?? undefined,
    period: r.period,
    shift: r.shift,
    schedule: r.schedule,
    type: r.type,
    experience: r.experience,
    benefits: r.benefits ?? [],
    requirements: r.requirements ?? [],
    description: r.description,
    location: branch.location,
    colonia: branch.colonia,
    postedMinutesAgo: minutesSince(r.created_at, now),
    openings: r.openings,
    applicants,
    urgent: r.urgent || undefined,
    phone: r.phone ?? "",
  };
}

type BranchViewRow = Database["public"]["Views"]["branches_view"]["Row"];

function viewRowToBranch(r: BranchViewRow): (Branch & { companyId: string }) | null {
  if (!r.id || !r.company_id || r.lat == null || r.lng == null) return null;
  return { id: r.id, companyId: r.company_id, name: r.name ?? "", colonia: r.colonia ?? "", location: { lat: r.lat, lng: r.lng } };
}

const stripCompanyId = (b: Branch & { companyId: string }): Branch => ({ id: b.id, name: b.name, colonia: b.colonia, location: b.location });

function jobInputToRow(i: Partial<JobInput>) {
  const row: Database["public"]["Tables"]["jobs"]["Update"] = {};
  if (i.branchId !== undefined) row.branch_id = i.branchId;
  if (i.title !== undefined) row.title = i.title.trim();
  if (i.category !== undefined) row.category = i.category;
  if (i.pay !== undefined) row.pay = Math.round(i.pay);
  if (i.payMax !== undefined) row.pay_max = i.payMax == null ? null : Math.round(i.payMax);
  if (i.period !== undefined) row.period = i.period;
  if (i.shift !== undefined) row.shift = i.shift;
  if (i.schedule !== undefined) row.schedule = i.schedule;
  if (i.type !== undefined) row.type = i.type;
  if (i.experience !== undefined) row.experience = i.experience;
  if (i.benefits !== undefined) row.benefits = i.benefits;
  if (i.requirements !== undefined) row.requirements = i.requirements;
  if (i.description !== undefined) row.description = i.description;
  if (i.openings !== undefined) row.openings = Math.max(1, Math.round(i.openings));
  if (i.urgent !== undefined) row.urgent = i.urgent;
  if (i.phone !== undefined) row.phone = i.phone || null;
  return row;
}

function jobError(e: DbError): string {
  const m = `${e?.message ?? ""}`.toLowerCase();
  if (e?.code === "23514") {
    if (m.includes("pay_max")) return "El sueldo máximo no puede ser menor que el mínimo.";
    if (m.includes("pay")) return "Escribe un sueldo mayor a cero.";
    if (m.includes("title")) return "El puesto debe tener entre 2 y 120 letras.";
    if (m.includes("openings")) return "Indica al menos 1 lugar disponible.";
    return "Revisa los datos de la vacante.";
  }
  if (e?.code === "23503") return "Elige una sucursal de tu negocio.";
  return friendlyError(e);
}

// ------------------------------------------------------------------ public catalog

export type CatalogData = { jobs: Job[]; companies: Company[] };

/**
 * Open vacancies within 50 km of `point` (jobs_near) plus every company and branch, so branches
 * without vacancies still show. Public: works signed out.
 */
export async function fetchCatalog(point: LatLng): Promise<Result<CatalogData>> {
  const sb = client();
  if (!sb) return { error: MSG.unavailable };
  try {
    const [near, companies, branches] = await Promise.all([
      sb.rpc("jobs_near", { lat: point.lat, lng: point.lng, radius_km: 50 }),
      sb.from("companies").select("id, name, kind, size, verified, about, employees"),
      sb.from("branches_view").select("id, company_id, name, colonia, sort, lat, lng").order("sort"),
    ]);
    const err = near.error ?? companies.error ?? branches.error;
    if (err) return { error: friendlyError(err, MSG.load) };
    const now = Date.now();
    const byCompany = new Map<string, Branch[]>();
    for (const row of branches.data ?? []) {
      const b = viewRowToBranch(row);
      if (!b) continue;
      const list = byCompany.get(b.companyId);
      if (list) list.push(stripCompanyId(b));
      else byCompany.set(b.companyId, [stripCompanyId(b)]);
    }
    const list: Company[] = [];
    for (const c of companies.data ?? []) {
      const locations = byCompany.get(c.id);
      // A company is created a moment before its first branch; until then it has nothing to show.
      if (!locations?.length) continue;
      list.push({ ...c, locations });
    }
    return { data: { jobs: (near.data ?? []).map((r) => nearJobToJob(r, now)), companies: list } };
  } catch (e) {
    return { error: friendlyError(e as DbError, MSG.load) };
  }
}

/**
 * One vacancy by id (for links to a vacancy outside the 50 km catalog). Null when it doesn't exist
 * or isn't visible (closed/paused vacancies are only visible to their company).
 */
export async function fetchJob(id: string): Promise<Result<Job | null>> {
  const sb = client();
  if (!sb) return { error: MSG.unavailable };
  try {
    const { data, error } = await sb.from("jobs").select("*, branches(colonia, location)").eq("id", id).maybeSingle();
    if (error) return { error: friendlyError(error, MSG.load) };
    if (!data) return { data: null };
    const branch = data.branches as { colonia: string; location: unknown } | null;
    const location = parsePoint(branch?.location);
    if (!branch || !location) return { data: null };
    // Applicant counts are only public through jobs_near; ask for the few metres around the branch.
    const near = await sb.rpc("jobs_near", { lat: location.lat, lng: location.lng, radius_km: 0.05 });
    const applicants = Number(near.data?.find((r) => r.id === id)?.applicants ?? 0) || 0;
    return { data: jobRowToJob(data as unknown as JobRow, { colonia: branch.colonia, location }, applicants, Date.now()) };
  } catch (e) {
    return { error: friendlyError(e as DbError, MSG.load) };
  }
}

// ------------------------------------------------------------------ session

const BLANK_PROFILE: LiveProfile = {
  role: "candidato",
  name: "",
  phone: null,
  email: null,
  interests: [],
  experience: "Sin experiencia",
  colonia: null,
  home: null,
  locationSource: "colonia",
  radiusKm: 5,
  onboarded: false,
  emailAlerts: true,
  emailUpdates: true,
  extras: EMPTY_PROFILE_EXTRAS,
  strength: null,
  avatar: null,
  avatarStored: false,
};

function oneOf<T extends string>(v: unknown, allowed: readonly T[]): T | null {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : null;
}
function manyOf<T extends string>(v: unknown, allowed: readonly T[]): T[] {
  return Array.isArray(v) ? v.filter((x): x is T => typeof x === "string" && (allowed as readonly string[]).includes(x)) : [];
}
const texts = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()) : []);
const textOrNull = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

type ProfileRow = Tables<"profiles"> & { profile_strength?: number | null };

/** The optional profile columns, defensively parsed (older rows / a stale schema cache read as empty). */
function profileExtras(p: ProfileRow): CandidateProfileExtras {
  return {
    headline: textOrNull(p.headline),
    about: textOrNull(p.about),
    education: oneOf(p.education, EDUCATION_LEVELS),
    skills: texts(p.skills),
    certifications: texts(p.certifications),
    languages: texts(p.languages),
    shifts: manyOf<Shift>(p.shifts, SHIFTS),
    availableFrom: oneOf(p.available_from, START_AVAILABILITIES),
    transport: manyOf(p.transport, TRANSPORTS),
    expectedPay: typeof p.expected_pay === "number" && Number.isFinite(p.expected_pay) ? p.expected_pay : null,
    expectedPeriod: oneOf<PayPeriod>(p.expected_period, EXPECTED_PERIODS),
    avatarPath: textOrNull(p.avatar_path),
    cvPath: textOrNull(p.cv_path),
  };
}

type ExperienceRow = Pick<
  Tables<"work_experiences">,
  "id" | "title" | "company" | "category" | "start_month" | "end_month" | "is_current" | "description"
>;
const EXPERIENCE_COLUMNS = "id, title, company, category, start_month, end_month, is_current, description";

function experienceFromRow(r: ExperienceRow): LiveExperience {
  return {
    id: r.id,
    title: r.title,
    company: r.company,
    category: r.category,
    startMonth: r.start_month,
    endMonth: r.is_current ? null : r.end_month,
    isCurrent: r.is_current,
    description: r.description,
  };
}

async function fetchCompanyWithBranches(
  company: Omit<LiveCompany, "branches">,
): Promise<Result<LiveCompany>> {
  const sb = client();
  if (!sb) return { error: MSG.unavailable };
  const { data, error } = await sb
    .from("branches_view")
    .select("id, company_id, name, colonia, sort, lat, lng")
    .eq("company_id", company.id)
    .order("sort");
  if (error) return { error: friendlyError(error, MSG.load) };
  const branches = (data ?? []).flatMap((r) => {
    const b = viewRowToBranch(r);
    return b ? [stripCompanyId(b)] : [];
  });
  return { data: { ...company, branches } };
}

/** Everything the signed-in user owns: profile, applications, saved vacancies, company. */
export async function fetchSessionData(userId: string): Promise<Result<LiveSessionData>> {
  const sb = client();
  if (!sb) return { error: MSG.unavailable };
  try {
    const [profileTry, apps, saved, company, experiences] = await Promise.all([
      // profile_strength is a computed column (a SQL function over the row).
      sb.from("profiles").select("*, profile_strength").eq("id", userId).maybeSingle(),
      sb.from("applications").select("job_id, status, created_at").eq("candidate_id", userId).order("created_at", { ascending: false }),
      sb.from("saved_jobs").select("job_id, created_at").eq("candidate_id", userId).order("created_at"),
      sb
        .from("companies")
        .select("id, name, kind, size, verified, about, employees, phone, plan")
        .eq("owner_id", userId)
        .order("created_at")
        .limit(1)
        .maybeSingle(),
      sb.from("work_experiences").select(EXPERIENCE_COLUMNS).eq("profile_id", userId).order("sort").order("created_at"),
    ]);
    // A schema cache without the computed column must not lock the user out: retry plain.
    const profile = profileTry.error
      ? await sb.from("profiles").select("*").eq("id", userId).maybeSingle()
      : { data: profileTry.data as unknown as ProfileRow | null, error: null };
    const err = profile.error ?? apps.error ?? saved.error ?? company.error;
    if (err) return { error: friendlyError(err, MSG.load) };

    const now = Date.now();
    const p = profile.data as ProfileRow | null;
    const live: LiveProfile = p
      ? {
          role: p.role,
          name: p.name,
          phone: p.phone,
          email: p.email,
          interests: p.interests ?? [],
          experience: p.experience,
          colonia: p.colonia,
          home: parsePoint(p.home),
          locationSource: p.location_source,
          radiusKm: asRadius(p.radius_km),
          onboarded: p.onboarded,
          // Older rows / a stale schema cache: treat a missing value as the column default (on).
          emailAlerts: p.email_alerts ?? true,
          emailUpdates: p.email_updates ?? true,
          extras: profileExtras(p),
          strength: typeof p.profile_strength === "number" ? p.profile_strength : null,
          ...profileAvatar(p),
        }
      : BLANK_PROFILE;

    let myCompany: LiveCompany | null = null;
    let unlockedJobIds: string[] = [];
    if (company.data) {
      const [full, unlocks] = await Promise.all([
        fetchCompanyWithBranches(company.data),
        sb.from("job_unlocks").select("job_id").eq("company_id", company.data.id).gt("unlocked_until", new Date().toISOString()),
      ]);
      if (full.error !== undefined) return { error: full.error };
      myCompany = full.data;
      unlockedJobIds = (unlocks.data ?? []).map((u) => u.job_id);
    }

    return {
      data: {
        profile: live,
        // Work history is optional: if it fails to load, keep what's on screen instead of failing the session.
        experiences: experiences.error ? null : (experiences.data ?? []).map(experienceFromRow),
        applications: (apps.data ?? []).map((a) => ({ jobId: a.job_id, status: a.status, minutesAgo: minutesSince(a.created_at, now) })),
        saved: (saved.data ?? []).map((s) => s.job_id),
        company: myCompany,
        unlockedJobIds,
      },
    };
  } catch (e) {
    return { error: friendlyError(e as DbError, MSG.load) };
  }
}

export async function saveProfile(patch: ProfilePatch): Promise<WriteResult> {
  const sb = client();
  if (!sb) return { error: MSG.unavailable };
  try {
    const id = await currentUserId();
    if (!id) return { error: MSG.session };
    const { data, error } = await sb.from("profiles").update(patch).eq("id", id).select("id");
    if (error) return { error: profileError(error) };
    return data?.length ? {} : { error: MSG.session };
  } catch (e) {
    return { error: profileError(e as DbError) };
  }
}

/** The saved avatar (sanitized), and whether the database has the column at all. */
function profileAvatar(p: ProfileRow): Pick<LiveProfile, "avatar" | "avatarStored"> {
  const stored = Object.prototype.hasOwnProperty.call(p, "avatar_config");
  const raw: unknown = stored ? p.avatar_config : null;
  return { avatar: raw && typeof raw === "object" && !Array.isArray(raw) ? sanitizeAvatar(raw) : null, avatarStored: stored };
}

/** `missingColumn`: the database doesn't have profiles.avatar_config yet (migration not applied). */
export type AvatarWriteResult = WriteResult & { missingColumn?: true };

/** Saves (or clears, with null) the signed-in user's illustrated avatar. Never throws. */
export async function saveAvatarConfig(config: AvatarConfig | null): Promise<AvatarWriteResult> {
  const sb = client();
  if (!sb) return { error: MSG.unavailable };
  try {
    const id = await currentUserId();
    if (!id) return { error: MSG.session };
    const value = config ? sanitizeAvatar(config) : null;
    const { data, error } = await sb.from("profiles").update({ avatar_config: value }).eq("id", id).select("id");
    if (error) {
      // PGRST204: column not in PostgREST's schema cache · 42703: undefined column.
      const m = `${error.message ?? ""}`.toLowerCase();
      if (error.code === "PGRST204" || error.code === "42703" || (m.includes("avatar_config") && m.includes("column")))
        return { missingColumn: true };
      if (error.code === "23514") return { error: "No pudimos guardar ese avatar. Intenta con otro." };
      return { error: friendlyError(error) };
    }
    return data?.length ? {} : { error: MSG.session };
  } catch (e) {
    return { error: friendlyError(e as DbError) };
  }
}

/** Check-constraint violations on profiles → what to fix, in Spanish. */
function profileError(e: DbError): string {
  const m = `${e?.message ?? ""}`.toLowerCase();
  if (e?.code === "23514") {
    if (m.includes("headline")) return `Tu frase de presentación puede tener hasta ${PROFILE_LIMITS.headlineMax} letras.`;
    if (m.includes("about")) return `«Sobre mí» puede tener hasta ${PROFILE_LIMITS.aboutMax} letras.`;
    if (m.includes("certifications")) return `Puedes agregar hasta ${PROFILE_LIMITS.certificationsMax} licencias o certificados.`;
    if (m.includes("skills")) return `Puedes agregar hasta ${PROFILE_LIMITS.skillsMax} habilidades.`;
    if (m.includes("languages")) return `Puedes agregar hasta ${PROFILE_LIMITS.languagesMax} idiomas.`;
    if (m.includes("expected_pay")) return "Escribe un sueldo entre $100 y $200,000.";
    if (m.includes("transport")) return "Elige cómo llegas de la lista.";
    return "Revisa los datos de tu perfil.";
  }
  return friendlyError(e);
}

// ------------------------------------------------------------------ work history (own rows, RLS)

export type ExperienceInput = Omit<WorkExperience, "id">;

function experienceRow(e: ExperienceInput) {
  return {
    title: e.title.trim(),
    company: e.company?.trim() || null,
    category: e.category,
    start_month: monthToDate(e.startMonth),
    end_month: e.isCurrent ? null : monthToDate(e.endMonth),
    is_current: e.isCurrent,
    description: e.description?.trim() || null,
  };
}

function experienceError(e: DbError): string {
  const m = `${e?.message ?? ""}`.toLowerCase();
  if (m.includes("hasta 10 experiencias")) return MSG.experienceLimit;
  if (e?.code === "23514") {
    if (m.includes("title")) return `El puesto debe tener entre 2 y ${PROFILE_LIMITS.experienceTitleMax} letras.`;
    if (m.includes("company")) return `La empresa puede tener hasta ${PROFILE_LIMITS.experienceCompanyMax} letras.`;
    if (m.includes("description")) return `La descripción puede tener hasta ${PROFILE_LIMITS.experienceDescriptionMax} letras.`;
    return "La fecha de fin no puede ser antes del inicio.";
  }
  return friendlyError(e);
}

/** Adds a row to my work history; returns its id. Fails (friendly) past 10 rows. */
export async function insertExperience(e: ExperienceInput, sort: number): Promise<Result<string>> {
  const sb = client();
  if (!sb) return { error: MSG.unavailable };
  try {
    const id = await currentUserId();
    if (!id) return { error: MSG.session };
    const { data, error } = await sb
      .from("work_experiences")
      .insert({ ...experienceRow(e), profile_id: id, sort: Math.max(0, Math.min(32767, Math.round(sort))) })
      .select("id")
      .single();
    if (error || !data) return { error: experienceError(error) };
    return { data: data.id };
  } catch (err) {
    return { error: experienceError(err as DbError) };
  }
}

export async function updateExperience(experienceId: string, e: ExperienceInput): Promise<WriteResult> {
  const sb = client();
  if (!sb) return { error: MSG.unavailable };
  try {
    const { data, error } = await sb.from("work_experiences").update(experienceRow(e)).eq("id", experienceId).select("id");
    if (error) return { error: experienceError(error) };
    return data?.length ? {} : { error: "No encontramos esa experiencia." };
  } catch (err) {
    return { error: experienceError(err as DbError) };
  }
}

export async function deleteExperience(experienceId: string): Promise<WriteResult> {
  const sb = client();
  if (!sb) return { error: MSG.unavailable };
  try {
    const { error } = await sb.from("work_experiences").delete().eq("id", experienceId);
    // Already gone counts as done.
    return error ? { error: experienceError(error) } : {};
  } catch (err) {
    return { error: experienceError(err as DbError) };
  }
}

/** Saves the caller's home via set_my_home (PostGIS stays on the server). */
export async function setHome(location: LatLng, colonia: string, source: LocationSource): Promise<WriteResult> {
  const sb = client();
  if (!sb) return { error: MSG.unavailable };
  try {
    const { error } = await sb.rpc("set_my_home", { lat: location.lat, lng: location.lng, p_colonia: colonia, p_source: source });
    return error ? { error: friendlyError(error, "No pudimos guardar tu ubicación. Intenta de nuevo.") } : {};
  } catch (e) {
    return { error: friendlyError(e as DbError) };
  }
}

// ------------------------------------------------------------------ candidate

export async function apply(jobId: string): Promise<WriteResult> {
  const sb = client();
  if (!sb) return { error: MSG.unavailable };
  try {
    const id = await currentUserId();
    if (!id) return { error: MSG.session };
    const { error } = await sb.from("applications").insert({ job_id: jobId, candidate_id: id });
    if (!error || error.code === "23505") return {}; // 23505: already applied
    if (error.code === "23503") return { error: MSG.jobGone };
    if (error.code === "42501" || /row-level security/i.test(error.message)) return { error: MSG.jobClosed };
    return { error: friendlyError(error, "No pudimos enviar tu postulación. Intenta de nuevo.") };
  } catch (e) {
    return { error: friendlyError(e as DbError) };
  }
}

/** The candidate withdraws (status → cerrada; the only change a candidate may make). */
export async function withdraw(jobId: string): Promise<WriteResult> {
  const sb = client();
  if (!sb) return { error: MSG.unavailable };
  try {
    const id = await currentUserId();
    if (!id) return { error: MSG.session };
    const { data, error } = await sb
      .from("applications")
      .update({ status: "cerrada" })
      .eq("job_id", jobId)
      .eq("candidate_id", id)
      .select("id");
    if (error) return { error: friendlyError(error) };
    return data?.length ? {} : { error: "No encontramos esa postulación." };
  } catch (e) {
    return { error: friendlyError(e as DbError) };
  }
}

export async function toggleSaved(jobId: string, on: boolean): Promise<WriteResult> {
  const sb = client();
  if (!sb) return { error: MSG.unavailable };
  try {
    const id = await currentUserId();
    if (!id) return { error: MSG.session };
    const { error } = on
      ? await sb.from("saved_jobs").upsert({ candidate_id: id, job_id: jobId }, { onConflict: "candidate_id,job_id", ignoreDuplicates: true })
      : await sb.from("saved_jobs").delete().eq("candidate_id", id).eq("job_id", jobId);
    if (error?.code === "23503") return { error: MSG.jobGone };
    return error ? { error: friendlyError(error) } : {};
  } catch (e) {
    return { error: friendlyError(e as DbError) };
  }
}

// ------------------------------------------------------------------ employer

function companyError(e: DbError): string {
  if (e?.code === "23514") return "El nombre del negocio debe tener entre 2 y 120 letras.";
  return friendlyError(e);
}

function branchError(e: DbError): string {
  if (e?.code === "23514") return "El nombre de la sucursal debe tener entre 1 y 80 letras.";
  if (e?.code === "23503") return MSG.branchHasJobs;
  return friendlyError(e);
}

/** Creates my company and its branches (in order: the first keeps sort 0). All or nothing. */
export async function createBusiness(input: BusinessInput): Promise<Result<LiveCompany>> {
  const sb = client();
  if (!sb) return { error: MSG.unavailable };
  if (!input.locations.length) return { error: MSG.lastBranch };
  try {
    const id = await currentUserId();
    if (!id) return { error: MSG.session };
    const { data: c, error } = await sb
      .from("companies")
      .insert({
        owner_id: id,
        name: input.name.trim(),
        kind: input.kind,
        size: input.size,
        phone: input.phone || null,
        about: input.about ?? "",
        employees: input.employees ?? "",
      })
      .select("id, name, kind, size, verified, about, employees, phone, plan")
      .single();
    if (error || !c) return { error: companyError(error) };

    const branches: Branch[] = [];
    for (const l of input.locations) {
      const r = await addBranch(c.id, l);
      if (r.error !== undefined) {
        // Don't leave a half-made company behind (branches cascade with it).
        await sb.from("companies").delete().eq("id", c.id);
        return { error: r.error };
      }
      branches.push({ ...l, id: r.data });
    }
    return { data: { ...c, branches } };
  } catch (e) {
    return { error: companyError(e as DbError) };
  }
}

export async function updateCompany(companyId: string, patch: CompanyPatch): Promise<WriteResult> {
  const sb = client();
  if (!sb) return { error: MSG.unavailable };
  try {
    const row: Database["public"]["Tables"]["companies"]["Update"] = {};
    if (patch.name !== undefined) row.name = patch.name.trim();
    if (patch.kind !== undefined) row.kind = patch.kind;
    if (patch.size !== undefined) row.size = patch.size;
    if (patch.about !== undefined) row.about = patch.about;
    if (patch.employees !== undefined) row.employees = patch.employees;
    if (patch.phone !== undefined) row.phone = patch.phone || null;
    const { data, error } = await sb.from("companies").update(row).eq("id", companyId).select("id");
    if (error) return { error: companyError(error) };
    return data?.length ? {} : { error: MSG.denied };
  } catch (e) {
    return { error: companyError(e as DbError) };
  }
}

/** Adds a branch through add_branch (owner-only); returns its server id. */
export async function addBranch(companyId: string, branch: Omit<Branch, "id">): Promise<Result<string>> {
  const sb = client();
  if (!sb) return { error: MSG.unavailable };
  try {
    const { data, error } = await sb.rpc("add_branch", {
      p_company_id: companyId,
      p_name: branch.name.trim(),
      p_colonia: branch.colonia,
      lat: branch.location.lat,
      lng: branch.location.lng,
    });
    if (error || !data) return { error: branchError(error) };
    return { data };
  } catch (e) {
    return { error: branchError(e as DbError) };
  }
}

export async function updateBranch(branchId: string, patch: Partial<Omit<Branch, "id">>): Promise<WriteResult> {
  const sb = client();
  if (!sb) return { error: MSG.unavailable };
  try {
    const row: Database["public"]["Tables"]["branches"]["Update"] = {};
    if (patch.name !== undefined) row.name = patch.name.trim();
    if (patch.colonia !== undefined) row.colonia = patch.colonia;
    if (patch.location !== undefined) row.location = ewkt(patch.location);
    const { data, error } = await sb.from("branches").update(row).eq("id", branchId).select("id");
    if (error) return { error: branchError(error) };
    return data?.length ? {} : { error: "No encontramos esa sucursal." };
  } catch (e) {
    return { error: branchError(e as DbError) };
  }
}

/** Fails (friendly) for the last branch and for a branch that still has vacancies. */
export async function removeBranch(branchId: string): Promise<WriteResult> {
  const sb = client();
  if (!sb) return { error: MSG.unavailable };
  try {
    const { data, error } = await sb.from("branches").delete().eq("id", branchId).select("id");
    if (error) return { error: branchError(error) };
    return data?.length ? {} : { error: "No encontramos esa sucursal." };
  } catch (e) {
    return { error: branchError(e as DbError) };
  }
}

/** Publishes a vacancy at one of my branches (status abierta). Returns the new id. */
export async function publishJob(companyId: string, input: JobInput): Promise<Result<string>> {
  const sb = client();
  if (!sb) return { error: MSG.unavailable };
  try {
    const row = jobInputToRow(input);
    const { data, error } = await sb
      .from("jobs")
      .insert({ ...row, company_id: companyId, branch_id: input.branchId, title: input.title.trim(), category: input.category, pay: Math.round(input.pay), shift: input.shift })
      .select("id")
      .single();
    if (error || !data) return { error: jobError(error) };
    return { data: data.id };
  } catch (e) {
    return { error: jobError(e as DbError) };
  }
}

export async function updateJob(jobId: string, patch: Partial<JobInput>): Promise<WriteResult> {
  const sb = client();
  if (!sb) return { error: MSG.unavailable };
  try {
    const { data, error } = await sb.from("jobs").update(jobInputToRow(patch)).eq("id", jobId).select("id");
    if (error) return { error: jobError(error) };
    return data?.length ? {} : { error: MSG.denied };
  } catch (e) {
    return { error: jobError(e as DbError) };
  }
}

/** abierta ↔ pausada → cerrada. Paused/closed vacancies disappear from the public catalog. */
export async function setJobStatus(jobId: string, status: JobStatus): Promise<WriteResult> {
  const sb = client();
  if (!sb) return { error: MSG.unavailable };
  try {
    const { data, error } = await sb.from("jobs").update({ status }).eq("id", jobId).select("id");
    if (error) return { error: friendlyError(error) };
    return data?.length ? {} : { error: MSG.denied };
  } catch (e) {
    return { error: friendlyError(e as DbError) };
  }
}

/** All of my company's vacancies (every status), newest first, with applicant counts. */
export async function fetchMyJobs(companyId: string): Promise<Result<MyJob[]>> {
  const sb = client();
  if (!sb) return { error: MSG.unavailable };
  try {
    const { data, error } = await sb
      .from("jobs")
      .select("*, branches(colonia, location), applications(count)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) return { error: friendlyError(error, MSG.load) };
    const now = Date.now();
    const jobs = (data ?? []).flatMap((r) => {
      const { branches, applications, ...row } = r as JobRow & {
        branches: { colonia: string; location: unknown } | null;
        applications: { count: number }[] | null;
      };
      const location = parsePoint(branches?.location);
      if (!branches || !location) return [];
      const count = Number(applications?.[0]?.count ?? 0) || 0;
      return [{ ...jobRowToJob(row, { colonia: branches.colonia, location }, count, now), status: row.status }];
    });
    return { data: jobs };
  } catch (e) {
    return { error: friendlyError(e as DbError, MSG.load) };
  }
}

/** Applicants of one of my vacancies: colonia + rounded km always; name/phone only when unlocked. */
export async function listApplicants(jobId: string): Promise<Result<LiveApplicant[]>> {
  const sb = client();
  if (!sb) return { error: MSG.unavailable };
  try {
    const { data, error } = await sb.rpc("job_applicants", { p_job_id: jobId });
    if (error) return { error: friendlyError(error, MSG.load) };
    const now = Date.now();
    return {
      data: (data ?? []).map((r) => ({
        id: r.application_id,
        jobId,
        status: r.status,
        colonia: r.colonia ?? "",
        km: r.km ?? null,
        experience: r.experience,
        interests: r.interests ?? [],
        minutesAgo: minutesSince(r.applied_at, now),
        unlocked: r.unlocked,
        name: r.name || null,
        phone: r.phone || null,
      })),
    };
  } catch (e) {
    return { error: friendlyError(e as DbError, MSG.load) };
  }
}

/** The company moves an application along: vista → entrevista → contratada / cerrada. */
export async function setApplicationStatus(applicationId: string, status: ApplicationStatus): Promise<WriteResult> {
  const sb = client();
  if (!sb) return { error: MSG.unavailable };
  try {
    const { data, error } = await sb.from("applications").update({ status }).eq("id", applicationId).select("id");
    if (error) return { error: friendlyError(error) };
    return data?.length ? {} : { error: "No encontramos esa postulación." };
  } catch (e) {
    return { error: friendlyError(e as DbError) };
  }
}

/** Ends the session on this device only (other devices stay signed in). Never throws. */
export async function signOutLocal(): Promise<void> {
  try {
    await client()?.auth.signOut({ scope: "local" });
  } catch {
    // Offline: the local session is already removed before the network call.
  }
}
