import type { CategoryId, Experience } from "@/lib/data/types";

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
};

// Demo data — fictional people near Logística Zapalinamé (Parque Industrial Santa Mónica).
export const CANDIDATES: Candidate[] = [
  { id: "c1", name: "Jorge Ramírez", puesto: "Montacarguista", colonia: "Saltillo 2000", km: 1.4, experience: "2 años o más", minutesAgo: 35, applied: true },
  { id: "c2", name: "Daniela Fuentes", puesto: "Almacenista", colonia: "Fundadores", km: 1.9, experience: "6 meses", minutesAgo: 140, applied: true },
  { id: "c3", name: "Luis Alberto Treviño", puesto: "Montacarguista", colonia: "Morelos", km: 2.6, experience: "1 año", minutesAgo: 420, applied: true },
  { id: "c4", name: "Karla Hernández", puesto: "Almacenista", colonia: "República", km: 3.1, experience: "Sin experiencia", minutesAgo: 1020, applied: true },
  { id: "c5", name: "Miguel Ángel Sánchez", puesto: "Chofer", colonia: "Topo Chico", km: 3.8, experience: "2 años o más", minutesAgo: 60 },
  { id: "c6", name: "Rosa Elena Castillo", puesto: "Auxiliar de almacén", colonia: "Lourdes", km: 4.2, experience: "1 año", minutesAgo: 200 },
  { id: "c7", name: "Fernando Aguirre", puesto: "Operador de producción", colonia: "Saltillo 2000", km: 1.1, experience: "6 meses", minutesAgo: 90 },
  { id: "c8", name: "Brenda Ortiz", puesto: "Almacenista", colonia: "Centro", km: 4.7, experience: "Sin experiencia", minutesAgo: 600 },
  { id: "c9", name: "Héctor Valdés", puesto: "Montacarguista", colonia: "Los Pinos", km: 5.6, experience: "2 años o más", minutesAgo: 30 },
  { id: "c10", name: "Patricia Galindo", puesto: "Inventarios", colonia: "Bellavista", km: 6.3, experience: "1 año", minutesAgo: 1500 },
  { id: "c11", name: "Óscar Medina", puesto: "Chofer", colonia: "Mirasierra", km: 7.9, experience: "2 años o más", minutesAgo: 2400 },
  { id: "c12", name: "Andrea Cepeda", puesto: "Almacenista", colonia: "Valle de las Flores", km: 8.8, experience: "6 meses", minutesAgo: 320 },
  { id: "c13", name: "Ricardo Lozano", puesto: "Montacarguista", colonia: "Ramos Arizpe", km: 9.7, experience: "1 año", minutesAgo: 75 },
  { id: "c14", name: "Gabriela Rdz.", puesto: "Operador de producción", colonia: "Derramadero", km: 13.4, experience: "Sin experiencia", minutesAgo: 900 },
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
