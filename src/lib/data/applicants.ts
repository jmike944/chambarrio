import type { Experience } from "./types";

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
};

// Demo data — fictional people who applied to Logística Zapalinamé's vacancies.
export const APPLICANTS: Applicant[] = [
  { id: "a1", jobId: "montacarguista-zapaliname", name: "Jorge Ramírez", colonia: "Saltillo 2000", km: 1.4, experience: "2 años o más", minutesAgo: 35 },
  { id: "a2", jobId: "montacarguista-zapaliname", name: "Juan Pablo Esquivel", colonia: "Fundadores", km: 2.1, experience: "6 meses", minutesAgo: 600 },
  { id: "a3", jobId: "montacarguista-zapaliname", name: "Luis Alberto Treviño", colonia: "Morelos", km: 2.6, experience: "1 año", minutesAgo: 420 },
  { id: "a4", jobId: "montacarguista-zapaliname", name: "Arturo Garza", colonia: "República", km: 3.4, experience: "2 años o más", minutesAgo: 1300 },
  { id: "a5", jobId: "montacarguista-zapaliname", name: "Héctor Valdés", colonia: "Los Pinos", km: 5.6, experience: "2 años o más", minutesAgo: 30 },
  { id: "a6", jobId: "montacarguista-zapaliname", name: "Emilio Saucedo", colonia: "Mirasierra", km: 7.2, experience: "1 año", minutesAgo: 2000 },
  { id: "a7", jobId: "montacarguista-zapaliname", name: "Ricardo Lozano", colonia: "Ramos Arizpe", km: 9.7, experience: "1 año", minutesAgo: 75 },
  { id: "a8", jobId: "almacenista-zapaliname", name: "Iván Robles", colonia: "Saltillo 2000", km: 0.9, experience: "Sin experiencia", minutesAgo: 15 },
  { id: "a9", jobId: "almacenista-zapaliname", name: "Daniela Fuentes", colonia: "Fundadores", km: 1.9, experience: "6 meses", minutesAgo: 140 },
  { id: "a10", jobId: "almacenista-zapaliname", name: "Mónica Villarreal", colonia: "Morelos", km: 2.4, experience: "1 año", minutesAgo: 260 },
  { id: "a11", jobId: "almacenista-zapaliname", name: "Karla Hernández", colonia: "República", km: 3.1, experience: "Sin experiencia", minutesAgo: 1020 },
  { id: "a12", jobId: "almacenista-zapaliname", name: "Diego Alanís", colonia: "Topo Chico", km: 3.9, experience: "6 meses", minutesAgo: 880 },
  { id: "a13", jobId: "almacenista-zapaliname", name: "Rosa Elena Castillo", colonia: "Lourdes", km: 4.2, experience: "1 año", minutesAgo: 200 },
  { id: "a14", jobId: "almacenista-zapaliname", name: "Brenda Ortiz", colonia: "Centro", km: 4.7, experience: "Sin experiencia", minutesAgo: 600 },
  { id: "a15", jobId: "almacenista-zapaliname", name: "Lucía Perales", colonia: "Bellavista", km: 6.1, experience: "Sin experiencia", minutesAgo: 1700 },
  { id: "a16", jobId: "almacenista-zapaliname", name: "Andrea Cepeda", colonia: "Valle de las Flores", km: 8.8, experience: "6 meses", minutesAgo: 320 },
];

/** Applicants to one vacancy, nearest first. */
export function applicantsFor(jobId: string): Applicant[] {
  return APPLICANTS.filter((a) => a.jobId === jobId).toSorted((a, b) => a.km - b.km);
}
