import type { CategoryId, Experience } from "@/lib/data/types";
import type { DemoPersonKey } from "@/lib/data/applicants";

export type Candidate = {
  id: string;
  name: string;
  puesto: string;
  colonia: string;
  km: number;
  experience: Experience;
  /** minutes since they applied / were last active */
  minutesAgo: number;
  applied?: boolean;
  /** Their optional profile in DEMO_PROFILES (shared with the applicant mock). */
  person: DemoPersonKey;
};

// Demo data — fictional people near Logística Zapalinamé (Parque Industrial Santa Mónica).
export const CANDIDATES: Candidate[] = [
  { id: "c1", name: "Jorge Ramírez", puesto: "Montacarguista", colonia: "Saltillo 2000", km: 1.4, experience: "2 años o más", minutesAgo: 35, applied: true, person: "jorge" },
  { id: "c2", name: "Daniela Fuentes", puesto: "Almacenista", colonia: "Fundadores", km: 1.9, experience: "2 años o más", minutesAgo: 140, applied: true, person: "daniela" },
  { id: "c3", name: "Luis Alberto Treviño", puesto: "Montacarguista", colonia: "Morelos", km: 2.6, experience: "1 año", minutesAgo: 420, applied: true, person: "luisalberto" },
  { id: "c4", name: "Karla Hernández", puesto: "Almacenista", colonia: "República", km: 3.1, experience: "Sin experiencia", minutesAgo: 1020, applied: true, person: "karla" },
  { id: "c5", name: "Miguel Ángel Sánchez", puesto: "Chofer", colonia: "Topo Chico", km: 3.8, experience: "2 años o más", minutesAgo: 60, person: "miguel" },
  { id: "c6", name: "Rosa Elena Castillo", puesto: "Auxiliar de almacén", colonia: "Lourdes", km: 4.2, experience: "2 años o más", minutesAgo: 200, person: "rosa" },
  { id: "c7", name: "Fernando Aguirre", puesto: "Operador de producción", colonia: "Saltillo 2000", km: 1.1, experience: "6 meses", minutesAgo: 90, person: "fernando" },
  { id: "c8", name: "Brenda Ortiz", puesto: "Almacenista", colonia: "Centro", km: 4.7, experience: "Sin experiencia", minutesAgo: 600, person: "brenda" },
  { id: "c9", name: "Héctor Valdés", puesto: "Montacarguista", colonia: "Los Pinos", km: 5.6, experience: "2 años o más", minutesAgo: 30, person: "hector" },
  { id: "c10", name: "Patricia Galindo", puesto: "Inventarios", colonia: "Bellavista", km: 6.3, experience: "2 años o más", minutesAgo: 1500, person: "patricia" },
  { id: "c11", name: "Óscar Medina", puesto: "Chofer", colonia: "Mirasierra", km: 7.9, experience: "2 años o más", minutesAgo: 2400, person: "oscar" },
  { id: "c12", name: "Andrea Cepeda", puesto: "Almacenista", colonia: "Valle de las Flores", km: 8.8, experience: "6 meses", minutesAgo: 320, person: "andrea" },
  { id: "c13", name: "Ricardo Lozano", puesto: "Montacarguista", colonia: "Ramos Arizpe", km: 9.7, experience: "1 año", minutesAgo: 75, person: "ricardo" },
  { id: "c14", name: "Gabriela Rdz.", puesto: "Operador de producción", colonia: "Derramadero", km: 13.4, experience: "Sin experiencia", minutesAgo: 900, person: "gabriela" },
];

/** Cartoon category for each puesto (drives CategoryIcon / block tints). */
const PUESTO_CATEGORY: Record<string, CategoryId> = {
  Montacarguista: "montacargas",
  Almacenista: "almacen",
  "Auxiliar de almacén": "almacen",
  Inventarios: "almacen",
  Chofer: "chofer",
  "Operador de producción": "produccion",
};

export function categoryForPuesto(puesto: string): CategoryId {
  return PUESTO_CATEGORY[puesto] ?? "produccion";
}
