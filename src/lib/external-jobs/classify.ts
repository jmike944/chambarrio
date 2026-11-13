import type { CategoryId } from "@/lib/data/types";

/*
 * Guesses our category from a job board title, so outside vacancies read like ours and the search
 * filters apply to them. Chambarrio is for operative work: titles that are professional or
 * managerial ("Ingeniero de mantenimiento", "Gerente de ventas") or fit no category return null and
 * aren't shown. Pure; shared by the server fetchers and their tests.
 */

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Professional / managerial roles: not what people look for here. */
const EXCLUDE =
  /\b(ingenier|gerente|director|jefe|jefa|coordinador|analista|desarroll|programador|developer|engineer|manager|licenciad|abogad|medico|contador publico|arquitect|consultor|ejecutivo de cuenta|key account|becari|practicante|trainee|lider de proyecto|project|sistemas|software|soporte tecnico|help ?desk)/;

/** First match wins: specific before generic ("operador de montacargas" before "operador"). */
const RULES: [CategoryId, RegExp][] = [
  ["montacargas", /\bmontacarg/],
  ["chofer", /\b(chofer|conductor|repartidor|reparto|mensajer|motociclista|operador de (trailer|tractocamion|quinta rueda|camion|unidad|transporte|tracto)|operador (tracto|quinta))/],
  ["seguridad", /\b(guardia|seguridad intramuros|vigilante|custodio|monitorista|oficial de seguridad|seguridad privada)/],
  ["limpieza", /\b(limpieza|intendente|intendencia|afanador|mucama|camarista|lavaloza|lava loza)/],
  ["restaurante", /\b(mesero|mesera|cocinero|cocinera|cocina|barista|garrotero|bartender|cantinero|hostess|pizzero|taquero|parrillero|repostero|panadero|chef|steward)/],
  ["caja", /\b(cajero|cajera|caja\b|cajer)/],
  ["almacen", /\b(almacen|almacenista|surtidor|estibador|cargador|picker|empacador|empacadora|inventario|embarques|recibo de mercancia)/],
  ["mantenimiento", /\b(mantenimiento|tecnico|electricista|mecanico|plomero|refrigeracion|soldador|pailero|tornero|fresador)/],
  ["construccion", /\b(albanil|construccion|obra\b|pintor|carpintero|herrero|peon|yesero|azulejero|tablaroca)/],
  ["ventas", /\b(vendedor|vendedora|ventas|promotor|promotora|asesor de ventas|asesora de ventas|dependiente|piso de venta|atencion a client|demostrador|edecan)/],
  ["oficina", /\b(auxiliar administrativ|recepcionista|capturista|asistente administrativ|secretari|auxiliar contable|auxiliar de oficina|archivista|call center|telefonista)/],
  ["produccion", /\b(operador|operadora|operario|operaria|ayudante general|ensamblador|ensambladora|produccion|costurera|costurero|inyeccion|inspector de calidad|inspectora de calidad|maquinista|troquelador|linea de produccion|manufactura)/],
];

export function categorize(title: string): CategoryId | null {
  const t = fold(title);
  if (EXCLUDE.test(t)) return null;
  for (const [id, re] of RULES) if (re.test(t)) return id;
  return null;
}

/** Saltillo, Ramos Arizpe, Arteaga (and Derramadero): the area the app covers. */
const AREA = /\b(saltillo|ramos arizpe|arteaga|derramadero)\b/;
export const inOurArea = (location: string) => AREA.test(fold(location));

/** Same vacancy on two boards: title + company, folded, letters and digits only ("S.A." = "SA"). */
export const dedupeKey = (title: string, company: string | null) =>
  `${fold(title).replace(/[^a-z0-9]+/g, "")}|${fold(company ?? "").replace(/[^a-z0-9]+/g, "")}`;

/** Strips tags/entities from a board's snippet and trims it to `max` characters. */
export function plainSnippet(html: string, max = 180): string {
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

const MXN = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

/** "$9,000 – $11,000 al mes" from numbers and a period word; null when there's nothing usable. */
export function payText(min: number | null | undefined, max: number | null | undefined, per: "al mes" | "a la semana" | "al día" | "por hora"): string | null {
  const lo = typeof min === "number" && Number.isFinite(min) && min > 0 ? Math.round(min) : null;
  const hi = typeof max === "number" && Number.isFinite(max) && max > 0 ? Math.round(max) : null;
  if (!lo && !hi) return null;
  if (lo && hi && hi > lo) return `${MXN.format(lo)} – ${MXN.format(hi)} ${per}`;
  return `${MXN.format((lo ?? hi)!)} ${per}`;
}
