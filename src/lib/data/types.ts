import type { LatLng } from "@/lib/geo";

export type CategoryId =
  | "produccion"
  | "almacen"
  | "montacargas"
  | "chofer"
  | "restaurante"
  | "caja"
  | "ventas"
  | "limpieza"
  | "mantenimiento"
  | "construccion"
  | "seguridad"
  | "oficina";

export type PayPeriod = "semana" | "quincena" | "mes" | "dia";
export type Shift = "Matutino" | "Vespertino" | "Nocturno" | "Mixto" | "Rotativo";
export type EmploymentType = "Tiempo completo" | "Medio tiempo" | "Temporal" | "Fines de semana";
export type Experience = "Sin experiencia" | "6 meses" | "1 año" | "2 años o más";
export type CompanySize = "Micro" | "Pequeña" | "Mediana" | "Grande";

export type Company = {
  id: string;
  name: string;
  kind: string;
  size: CompanySize;
  verified: boolean;
  colonia: string;
  location: LatLng;
  about: string;
  employees: string;
};

export type Job = {
  id: string;
  title: string;
  companyId: string;
  category: CategoryId;
  pay: number;
  payMax?: number;
  period: PayPeriod;
  shift: Shift;
  schedule: string;
  type: EmploymentType;
  experience: Experience;
  benefits: string[];
  requirements: string[];
  description: string;
  location: LatLng;
  colonia: string;
  postedMinutesAgo: number;
  openings: number;
  applicants: number;
  urgent?: boolean;
  phone: string;
};

export type ApplicationStatus = "enviada" | "vista" | "entrevista" | "contratada" | "cerrada";

export type Application = {
  jobId: string;
  status: ApplicationStatus;
  /** minutes since applying, for seeded demo data */
  minutesAgo: number;
};
