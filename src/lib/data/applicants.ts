import type { CategoryId, Experience } from "./types";
import type { CandidateProfileExtras, WorkExperience } from "@/lib/profile-strength";

export type Applicant = {
  id: string;
  jobId: string;
  name: string;
  colonia: string;
  /** distance from the workplace */
  km: number;
  experience: Experience;
  /** minutes since they applied */
  minutesAgo: number;
  /** Key into DEMO_PROFILES (the same person can appear on several screens). */
  person: DemoPersonKey;
};

/**
 * Illustrated stand-in for a profile photo in the demo (no real people): a flat sticker bust,
 * no facial features. Rendered by <ApplicantAvatar/>.
 */
export type AvatarArt = {
  /** 0 (lightest) … 3 (darkest) */
  skin: 0 | 1 | 2 | 3;
  hair: "corto" | "largo" | "chongo" | "rapado";
  hat?: "casco" | "gorra";
  top: "chaleco" | "playera" | "camisa" | "overol";
  bg: "sol" | "cielo" | "menta" | "lila" | "durazno" | "limon";
};

/** A demo candidate's optional profile. Anything left out is simply not filled in. */
export type DemoProfile = Partial<Omit<CandidateProfileExtras, "avatarPath" | "cvPath">> & {
  /** Fictional phone (10 digits). */
  phone: string;
  interests: CategoryId[];
  experiences?: WorkExperience[];
  /** Has a "photo" (shown as AvatarArt). */
  photo?: AvatarArt;
  /** Has a CV on file. */
  cv?: boolean;
};

const job = (
  title: string,
  company: string,
  category: CategoryId,
  startMonth: string,
  endMonth: string | null,
  description?: string,
): WorkExperience => ({
  title,
  company,
  category,
  startMonth,
  endMonth,
  isCurrent: endMonth === null,
  description: description ?? null,
});

/*
 * Demo people (fictional) near Saltillo's industrial parks. A few very complete profiles with a
 * photo and CV, several in between and a few bare ones, so the difference shows on the cards.
 * Employers here are generic local businesses, not real companies.
 */
export const DEMO_PROFILES = {
  jorge: {
    phone: "8445550101",
    interests: ["montacargas", "almacen"],
    headline: "Montacarguista con 5 años en CEDIS y patio de embarques",
    about:
      "Manejo montacargas de combustión y eléctrico, también reach truck. Me gusta el trabajo ordenado y sin accidentes. Busco algo estable cerca de Saltillo 2000 para no perder tiempo en traslados.",
    education: "preparatoria",
    certifications: ["Licencia de montacargas", "DC-3 montacargas", "Primeros auxilios"],
    skills: ["Reach truck", "Inventarios cíclicos", "Escáner RF", "Carga y descarga"],
    shifts: ["Matutino", "Rotativo"],
    availableFrom: "inmediata",
    transport: ["moto", "camion"],
    expectedPay: 3100,
    expectedPeriod: "semana",
    experiences: [
      job("Operador de montacargas", "Almacenes del Norte · Derramadero", "montacargas", "2021-02", null, "Surtido a rampas y acomodo en rack de 9 m."),
      job("Auxiliar de almacén", "Distribuidora La Laguna", "almacen", "2018-06", "2021-01", "Recibo de mercancía y conteos cíclicos."),
    ],
    photo: { skin: 2, hair: "corto", hat: "casco", top: "chaleco", bg: "cielo" },
    cv: true,
  },
  juanpablo: { phone: "8445550102", interests: ["montacargas"] },
  luisalberto: {
    phone: "8445550103",
    interests: ["montacargas", "produccion"],
    headline: "Operador de montacargas, aprendo rápido",
    certifications: ["DC-3 montacargas"],
    skills: ["Patín hidráulico", "Carga y descarga"],
    shifts: ["Nocturno"],
    availableFrom: "1_semana",
    transport: ["camion"],
    experiences: [job("Ayudante general", "Autopartes Arteaga", "produccion", "2023-03", "2024-04")],
  },
  arturo: {
    phone: "8445550104",
    interests: ["montacargas", "almacen"],
    headline: "Montacarguista certificado, turnos rotativos sin problema",
    about:
      "Tengo 8 años manejando montacargas en plantas de autopartes de Ramos Arizpe. Sé llevar inventarios y capacitar a la gente nueva.",
    education: "tecnico",
    certifications: ["Licencia de montacargas", "DC-3", "Seguridad e higiene"],
    skills: ["Montacargas de combustión", "Capacitación", "5S"],
    languages: ["Inglés básico"],
    shifts: ["Rotativo", "Nocturno"],
    availableFrom: "2_semanas",
    transport: ["auto"],
    expectedPay: 3400,
    expectedPeriod: "semana",
    experiences: [
      job("Operador de montacargas", "Planta de autopartes · Ramos Arizpe", "montacargas", "2017-05", "2024-08"),
      job("Almacenista", "Ferretera Coahuila", "almacen", "2015-01", "2017-04"),
    ],
    photo: { skin: 1, hair: "rapado", hat: "gorra", top: "overol", bg: "sol" },
  },
  hector: {
    phone: "8445550105",
    interests: ["montacargas", "almacen", "seguridad"],
    headline: "Líder de montacargas: 10 años sin incidentes",
    about:
      "Coordino a un equipo de 6 operadores en un centro de distribución. Domino reach truck y order picker, y llevo el control de inventario en SAP. Busco crecer en una empresa seria.",
    education: "preparatoria",
    certifications: ["Licencia de montacargas", "DC-3 montacargas", "DC-3 trabajos en altura", "Brigada contra incendios"],
    skills: ["Reach truck", "Order picker", "SAP básico", "Inventarios"],
    languages: ["Inglés básico"],
    shifts: ["Matutino", "Vespertino"],
    availableFrom: "inmediata",
    transport: ["auto", "camion"],
    expectedPay: 3600,
    expectedPeriod: "semana",
    experiences: [
      job("Supervisor de montacargas", "Logística Industrial del Norte", "montacargas", "2019-01", null, "Turno matutino, 6 operadores a cargo."),
      job("Operador de montacargas", "Bodega Ramos", "montacargas", "2014-03", "2018-12"),
    ],
    photo: { skin: 3, hair: "corto", hat: "casco", top: "chaleco", bg: "menta" },
    cv: true,
  },
  emilio: {
    phone: "8445550106",
    interests: ["montacargas"],
    headline: "Ayudante de patio, quiero manejar montacargas",
    certifications: ["Licencia tipo B"],
    shifts: ["Vespertino"],
    availableFrom: "inmediata",
    transport: ["moto"],
  },
  ricardo: { phone: "8445550107", interests: [] },
  ivan: { phone: "8445550108", interests: ["almacen"] },
  daniela: {
    phone: "8445550109",
    interests: ["almacen", "caja"],
    headline: "Auxiliar de almacén con experiencia en surtido y embarques",
    about:
      "Llevo 3 años en almacén: recibo mercancía, surto pedidos con escáner y armo embarques. Soy puntual y me adapto a cualquier turno.",
    education: "preparatoria",
    certifications: ["DC-3", "Manejo higiénico de alimentos"],
    skills: ["Picking y surtido", "Escáner RF", "Excel básico", "Recibo de mercancía"],
    shifts: ["Matutino", "Mixto"],
    availableFrom: "1_semana",
    transport: ["camion"],
    expectedPay: 2600,
    expectedPeriod: "semana",
    experiences: [
      job("Auxiliar de almacén", "CEDIS de tiendas de conveniencia", "almacen", "2023-10", null, "Surtido por escáner para 40 tiendas."),
      job("Cajera", "Abarrotes Doña Mary", "caja", "2020-06", "2021-12"),
    ],
    photo: { skin: 1, hair: "chongo", top: "playera", bg: "lila" },
    cv: true,
  },
  monica: {
    phone: "8445550110",
    interests: ["almacen", "oficina"],
    headline: "Inventarios y control de stock en tienda departamental",
    education: "licenciatura",
    certifications: ["Primeros auxilios"],
    skills: ["Inventarios", "SAP básico", "Excel intermedio"],
    languages: ["Inglés intermedio"],
    shifts: ["Matutino"],
    availableFrom: "2_semanas",
    transport: ["auto"],
    expectedPay: 12000,
    expectedPeriod: "mes",
    experiences: [job("Auxiliar de inventarios", "Tienda departamental · Saltillo", "almacen", "2023-02", "2025-06")],
    photo: { skin: 0, hair: "largo", top: "camisa", bg: "durazno" },
  },
  karla: {
    phone: "8445550111",
    interests: ["almacen"],
    shifts: ["Vespertino"],
    availableFrom: "inmediata",
    transport: ["caminando"],
  },
  diego: {
    phone: "8445550112",
    interests: ["almacen", "chofer"],
    headline: "Cargador con ganas de aprender almacén",
    skills: ["Carga y descarga"],
    transport: ["bici"],
    experiences: [job("Cargador", "Mudanzas del Valle", "almacen", "2024-01", "2024-09")],
  },
  rosa: {
    phone: "8445550113",
    interests: ["almacen", "limpieza"],
    headline: "Almacenista con licencia de montacargas",
    about:
      "Cinco años en una distribuidora de abarrotes del Centro. Acomodo, conteos y algo de montacargas. Vivo en Lourdes y puedo llegar caminando o en camión.",
    education: "secundaria",
    certifications: ["Licencia de montacargas", "Manejo higiénico de alimentos"],
    skills: ["Inventarios", "Patín hidráulico"],
    shifts: ["Matutino"],
    availableFrom: "inmediata",
    transport: ["camion", "caminando"],
    expectedPay: 2500,
    expectedPeriod: "semana",
    experiences: [job("Almacenista", "Distribuidora de abarrotes · Centro", "almacen", "2019-08", "2024-12")],
    photo: { skin: 2, hair: "chongo", top: "chaleco", bg: "limon" },
  },
  brenda: { phone: "8445550114", interests: ["almacen"] },
  lucia: { phone: "8445550115", interests: ["almacen", "caja"] },
  andrea: {
    phone: "8445550116",
    interests: ["almacen"],
    about: "Trabajé medio año en una paquetería separando envíos. Quiero un trabajo de tiempo completo cerca de Valle de las Flores.",
    skills: ["Paquetería", "Etiquetado", "Trabajo en equipo"],
    transport: ["camion"],
  },
  miguel: {
    phone: "8445550117",
    interests: ["chofer", "almacen"],
    headline: "Chofer con licencia tipo C, rutas Saltillo–Monterrey",
    about:
      "Manejo camioneta de 3.5 t y camión rabón. Conozco Saltillo, Ramos y Arteaga de memoria. Siempre con bitácora al día y unidad limpia.",
    education: "secundaria",
    certifications: ["Licencia tipo C", "Licencia federal", "DC-3"],
    skills: ["Rutas locales", "Mecánica básica", "Bitácora de entregas"],
    shifts: ["Matutino", "Mixto"],
    availableFrom: "inmediata",
    transport: ["auto"],
    expectedPay: 3300,
    expectedPeriod: "semana",
    experiences: [
      job("Chofer repartidor", "Paquetería Express Saltillo", "chofer", "2020-04", null),
      job("Ayudante de reparto", "Refresquera regional", "chofer", "2017-02", "2020-03"),
    ],
    photo: { skin: 2, hair: "rapado", hat: "gorra", top: "playera", bg: "sol" },
    cv: true,
  },
  fernando: {
    phone: "8445550118",
    interests: ["produccion"],
    headline: "Operador de producción, línea de ensamble",
    certifications: ["DC-3"],
    skills: ["Ensamble", "5S", "Control de calidad"],
    shifts: ["Rotativo"],
    availableFrom: "inmediata",
    experiences: [job("Operador de producción", "Maquiladora de arneses · Derramadero", "produccion", "2026-05", null)],
  },
  patricia: {
    phone: "8445550119",
    interests: ["almacen", "oficina"],
    headline: "Analista de inventarios con Excel y SAP",
    about: "Llevo los conteos cíclicos y las diferencias de inventario de un almacén de refacciones. Busco turno matutino.",
    education: "licenciatura",
    certifications: ["Seguridad e higiene"],
    skills: ["Inventarios", "SAP básico", "Excel avanzado"],
    languages: ["Inglés intermedio"],
    shifts: ["Matutino"],
    availableFrom: "1_mes",
    transport: ["auto"],
    expectedPay: 14000,
    expectedPeriod: "mes",
    experiences: [job("Analista de inventarios", "Refaccionaria industrial", "almacen", "2021-09", null)],
    photo: { skin: 1, hair: "largo", top: "camisa", bg: "menta" },
  },
  oscar: {
    phone: "8445550120",
    interests: ["chofer"],
    certifications: ["Licencia tipo B"],
    shifts: ["Nocturno"],
    availableFrom: "1_semana",
    experiences: [job("Chofer de taxi", "Sitio Alameda", "chofer", "2016-01", "2023-05")],
  },
  gabriela: { phone: "8445550121", interests: ["produccion"] },
} satisfies Record<string, DemoProfile>;

export type DemoPersonKey = keyof typeof DEMO_PROFILES;

export function demoProfile(person: DemoPersonKey): DemoProfile {
  return DEMO_PROFILES[person];
}

// Demo data — fictional people who applied to Logística Zapalinamé's vacancies.
export const APPLICANTS: Applicant[] = [
  { id: "a1", jobId: "montacarguista-zapaliname", name: "Jorge Ramírez", colonia: "Saltillo 2000", km: 1.4, experience: "2 años o más", minutesAgo: 35, person: "jorge" },
  { id: "a2", jobId: "montacarguista-zapaliname", name: "Juan Pablo Esquivel", colonia: "Fundadores", km: 2.1, experience: "6 meses", minutesAgo: 600, person: "juanpablo" },
  { id: "a3", jobId: "montacarguista-zapaliname", name: "Luis Alberto Treviño", colonia: "Morelos", km: 2.6, experience: "1 año", minutesAgo: 420, person: "luisalberto" },
  { id: "a4", jobId: "montacarguista-zapaliname", name: "Arturo Garza", colonia: "República", km: 3.4, experience: "2 años o más", minutesAgo: 1300, person: "arturo" },
  { id: "a5", jobId: "montacarguista-zapaliname", name: "Héctor Valdés", colonia: "Los Pinos", km: 5.6, experience: "2 años o más", minutesAgo: 30, person: "hector" },
  { id: "a6", jobId: "montacarguista-zapaliname", name: "Emilio Saucedo", colonia: "Mirasierra", km: 7.2, experience: "1 año", minutesAgo: 2000, person: "emilio" },
  { id: "a7", jobId: "montacarguista-zapaliname", name: "Ricardo Lozano", colonia: "Ramos Arizpe", km: 9.7, experience: "1 año", minutesAgo: 75, person: "ricardo" },
  { id: "a8", jobId: "almacenista-zapaliname", name: "Iván Robles", colonia: "Saltillo 2000", km: 0.9, experience: "Sin experiencia", minutesAgo: 15, person: "ivan" },
  { id: "a9", jobId: "almacenista-zapaliname", name: "Daniela Fuentes", colonia: "Fundadores", km: 1.9, experience: "2 años o más", minutesAgo: 140, person: "daniela" },
  { id: "a10", jobId: "almacenista-zapaliname", name: "Mónica Villarreal", colonia: "Morelos", km: 2.4, experience: "2 años o más", minutesAgo: 260, person: "monica" },
  { id: "a11", jobId: "almacenista-zapaliname", name: "Karla Hernández", colonia: "República", km: 3.1, experience: "Sin experiencia", minutesAgo: 1020, person: "karla" },
  { id: "a12", jobId: "almacenista-zapaliname", name: "Diego Alanís", colonia: "Topo Chico", km: 3.9, experience: "6 meses", minutesAgo: 880, person: "diego" },
  { id: "a13", jobId: "almacenista-zapaliname", name: "Rosa Elena Castillo", colonia: "Lourdes", km: 4.2, experience: "2 años o más", minutesAgo: 200, person: "rosa" },
  { id: "a14", jobId: "almacenista-zapaliname", name: "Brenda Ortiz", colonia: "Centro", km: 4.7, experience: "Sin experiencia", minutesAgo: 600, person: "brenda" },
  { id: "a15", jobId: "almacenista-zapaliname", name: "Lucía Perales", colonia: "Bellavista", km: 6.1, experience: "Sin experiencia", minutesAgo: 1700, person: "lucia" },
  { id: "a16", jobId: "almacenista-zapaliname", name: "Andrea Cepeda", colonia: "Valle de las Flores", km: 8.8, experience: "6 meses", minutesAgo: 320, person: "andrea" },
];

/** Applicants to one vacancy, nearest first. */
export function applicantsFor(jobId: string): Applicant[] {
  return APPLICANTS.filter((a) => a.jobId === jobId).toSorted((a, b) => a.km - b.km);
}
