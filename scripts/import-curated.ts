// Turns a CSV of "vacantes curadas" (captured by Chambarrio staff from public sources) into one idempotent
// SQL file to run in the Supabase SQL editor (as postgres).
// Run: node scripts/import-curated.ts vacantes.csv [--cerrar-faltantes] > vacantes.sql
// (Node 22.18+/24 strips the TypeScript types; only node: built-ins.)
import { readFileSync } from "node:fs";
import { basename } from "node:path";

const USAGE = `Uso: node scripts/import-curated.ts <archivo.csv> [--cerrar-faltantes] > vacantes.sql

  Convierte el CSV de vacantes curadas en un archivo SQL (se imprime en stdout) para pegarlo en
  Supabase > SQL editor. Los errores y avisos salen por stderr. Si hay errores no se genera SQL.

  --cerrar-faltantes   cierra las vacantes curadas abiertas que ya no estén en el CSV
  --help               muestra esta ayuda

  Instrucciones completas: scripts/curated/LEEME.md`;

const KNOWN = [
  "empresa", "empresa_id", "giro", "tamano", "acerca", "sucursal", "colonia", "coordenadas", "puesto", "categoria",
  "sueldo", "sueldo_max", "periodo", "turno", "horario", "jornada", "experiencia", "prestaciones", "requisitos",
  "descripcion", "lugares", "urge", "telefono", "fuente", "fuente_url", "revisada", "dias", "estado", "id",
];
const REQUIRED = ["empresa", "sucursal", "colonia", "coordenadas", "puesto", "categoria", "sueldo", "turno", "fuente", "revisada"];
const CATEGORIES = ["produccion", "almacen", "montacargas", "chofer", "restaurante", "caja", "ventas", "limpieza", "mantenimiento", "seguridad", "oficina", "construccion"];
const PERIODS = ["semana", "quincena", "mes", "dia"];
const SHIFTS = ["Matutino", "Vespertino", "Nocturno", "Mixto", "Rotativo"];
const TYPES = ["Tiempo completo", "Medio tiempo", "Temporal", "Fines de semana"];
const EXPERIENCES = ["Sin experiencia", "6 meses", "1 año", "2 años o más"];
const SIZES = ["Micro", "Pequeña", "Mediana", "Grande"];

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const fold = (s: string) => strip(s).toLowerCase().trim().replace(/\s+/g, " ");
const slug = (s: string) => strip(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "");
const q = (v: string | null | undefined) => (v == null ? "null" : `'${v.replaceAll("'", "''")}'`);
const arr = (xs: string[]) => (xs.length ? `array[${xs.map(q).join(", ")}]::text[]` : "'{}'::text[]");
const point = (lat: number, lng: number) => `extensions.st_point(${lng}, ${lat}, 4326)::extensions.geography`;

// ---------------------------------------------------------------- CSV (RFC 4180)
type Rec = { line: number; cells: string[] };
function parseCsv(text: string): Rec[] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const out: Rec[] = [];
  let cells: string[] = [];
  let cur = "";
  let inQ = false;
  let line = 1;
  let start = 1;
  let touched = false; // anything (even an empty quoted field) seen on this record
  const endRecord = () => {
    cells.push(cur);
    if (touched || cells.length > 1 || cells[0] !== "") out.push({ line: start, cells });
    cells = [];
    cur = "";
    touched = false;
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false;
      } else {
        if (ch === "\n") line++;
        cur += ch;
      }
      continue;
    }
    if (ch === '"') { inQ = true; touched = true; }
    else if (ch === ",") { cells.push(cur); cur = ""; touched = true; }
    else if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      endRecord();
      line++;
      start = line;
    } else cur += ch;
  }
  if (cur !== "" || cells.length || touched) endRecord();
  // records made only of empty cells (e.g. ",,,,") are skipped too
  return out.filter((r) => r.cells.some((c) => c.trim() !== ""));
}

// ---------------------------------------------------------------- main
const args = process.argv.slice(2);
if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
  console.error(USAGE);
  process.exit(2);
}
const closeMissing = args.includes("--cerrar-faltantes");
const files = args.filter((a) => !a.startsWith("--"));
const unknownFlags = args.filter((a) => a.startsWith("--") && a !== "--cerrar-faltantes");
if (unknownFlags.length || files.length !== 1) {
  console.error(unknownFlags.length ? `Opción desconocida: ${unknownFlags.join(", ")}\n` : "Indica un solo archivo CSV.\n");
  console.error(USAGE);
  process.exit(2);
}
const file = files[0];
let raw: string;
try {
  raw = readFileSync(file, "utf8");
} catch {
  console.error(`No se pudo leer el archivo "${file}".`);
  process.exit(1);
}

const errors: string[] = [];
const warnings: string[] = [];
const recs = parseCsv(raw);
if (recs.length === 0) {
  console.error("El archivo está vacío.");
  process.exit(1);
}

const header = recs[0].cells.map((h) => strip(h).toLowerCase().trim().replace(/\s+/g, "_"));
const unknown = header.filter((h) => h && !KNOWN.includes(h));
if (unknown.length) errors.push(`Encabezado desconocido: ${unknown.map((h) => `"${h}"`).join(", ")}. Los encabezados válidos son: ${KNOWN.join(", ")}.`);
const dupHeaders = header.filter((h, i) => h && header.indexOf(h) !== i);
if (dupHeaders.length) errors.push(`Encabezado repetido: ${[...new Set(dupHeaders)].join(", ")}.`);
const missingCols = REQUIRED.filter((c) => !header.includes(c));
if (missingCols.length) errors.push(`Faltan columnas obligatorias: ${missingCols.join(", ")}.`);
if (!header.includes("telefono") && !header.includes("fuente_url")) errors.push("Falta la columna telefono (o fuente_url).");
if (errors.length) fail();

const todayMty = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Monterrey", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const dayNum = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000;

type Branch = { id: string; name: string; colonia: string; lat: number; lng: number; sort: number };
type Company = { id: string; name: string; giro: string; tamano: string; acerca: string; phone: string | null; branches: Map<string, Branch> };
type Job = { id: string; companyId: string; branchId: string; row: string[] };
const companies = new Map<string, Company>();
const jobs = new Map<string, Job>();
const jobRows: string[] = [];
const branchOf = new Map<string, number>(); // branch id -> first row

for (const rec of recs.slice(1)) {
  const n = rec.line;
  const err = (m: string) => errors.push(`Fila ${n}: ${m}`);
  const warn = (m: string) => warnings.push(`Fila ${n}: ${m}`);
  if (rec.cells.length > header.length && rec.cells.slice(header.length).some((c) => c.trim())) err("tiene más celdas que encabezados (¿una coma sin comillas?).");
  const g = (col: string) => {
    const i = header.indexOf(col);
    return i < 0 ? "" : (rec.cells[i] ?? "").trim();
  };
  const before = errors.length;
  const len = (col: string, v: string, min: number, max: number) => {
    if (v.length < min || v.length > max) err(`"${col}" debe tener entre ${min} y ${max} caracteres (tiene ${v.length}).`);
  };
  const need = (col: string) => {
    const v = g(col);
    if (!v) err(`falta "${col}".`);
    return v;
  };
  const choose = (col: string, v: string, options: string[], def: string | null, extra: Record<string, string> = {}) => {
    if (!v) {
      if (def == null) err(`falta "${col}".`);
      return def ?? "";
    }
    const f = fold(v);
    const hit = options.find((o) => fold(o) === f) ?? extra[f];
    if (!hit) err(`"${col}" = "${v}" no es válido. Opciones: ${options.join(", ")}.`);
    return hit ?? "";
  };
  const list = (col: string) => {
    const items = g(col).split(";").map((s) => s.trim()).filter(Boolean);
    if (items.length > 12) err(`"${col}" tiene ${items.length} elementos (máximo 12).`);
    for (const it of items) if (it.length > 120) err(`"${col}": "${it.slice(0, 30)}…" pasa de 120 caracteres.`);
    return items;
  };

  const empresa = need("empresa");
  if (empresa) len("empresa", empresa, 2, 120);
  const empresaId = g("empresa_id") || slug(empresa);
  if (empresa && !empresaId) err('no se pudo generar "empresa_id"; escríbelo con letras o números.');
  const giro = g("giro");
  const tamano = choose("tamano", g("tamano"), SIZES, "Micro");
  const acerca = g("acerca");
  if (acerca.length > 400) err(`"acerca" pasa de 400 caracteres (tiene ${acerca.length}).`);

  const sucursal = need("sucursal");
  if (sucursal) len("sucursal", sucursal, 1, 80);
  const colonia = need("colonia");
  let lat = NaN;
  let lng = NaN;
  const coords = need("coordenadas");
  if (coords) {
    const m = coords.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (!m) err(`"coordenadas" = "${coords}" no tiene el formato "25.4269, -101.0081" (cópialas de Google Maps).`);
    else {
      lat = +m[1];
      lng = +m[2];
      if (lat < 25.2 || lat > 25.75 || lng < -101.35 || lng > -100.75)
        err(`las coordenadas ${lat}, ${lng} caen fuera de Saltillo / Ramos Arizpe / Arteaga (lat 25.20 a 25.75, lng -101.35 a -100.75). ¿Invertiste latitud y longitud?`);
    }
  }

  const puesto = need("puesto");
  if (puesto) len("puesto", puesto, 2, 120);
  const categoria = choose("categoria", g("categoria"), CATEGORIES, null);

  let sueldo = NaN;
  const parseMoney = (col: string, v: string) => {
    const s = v.replace(/[$\s]/g, "").replace(/,/g, "");
    if (!/^\d+(\.\d+)?$/.test(s)) { err(`"${col}" = "${v}" no es un número.`); return NaN; }
    const x = Math.round(+s);
    if (x <= 0) { err(`"${col}" debe ser mayor que 0.`); return NaN; }
    return x;
  };
  if (need("sueldo")) sueldo = parseMoney("sueldo", g("sueldo"));
  let sueldoMax: number | null = null;
  if (g("sueldo_max")) {
    const x = parseMoney("sueldo_max", g("sueldo_max"));
    if (!Number.isNaN(x)) {
      if (!Number.isNaN(sueldo) && x < sueldo) err(`"sueldo_max" (${x}) no puede ser menor que "sueldo" (${sueldo}).`);
      else sueldoMax = x;
    }
  }
  const periodo = choose("periodo", g("periodo"), PERIODS, "semana");
  const turno = choose("turno", g("turno"), SHIFTS, null);
  const horario = g("horario");
  const jornada = choose("jornada", g("jornada"), TYPES, "Tiempo completo");
  const experiencia = choose("experiencia", g("experiencia"), EXPERIENCES, "Sin experiencia");
  const prestaciones = list("prestaciones");
  const requisitos = list("requisitos");
  const descripcion = g("descripcion");
  if (descripcion.length > 1000) err(`"descripcion" pasa de 1000 caracteres (tiene ${descripcion.length}).`);
  let lugares = 1;
  if (g("lugares")) {
    if (!/^\d+$/.test(g("lugares")) || +g("lugares") < 1) err(`"lugares" debe ser un entero de 1 o más.`);
    else lugares = +g("lugares");
  }
  const urge = ["si", "x", "true", "1"].includes(fold(g("urge")));

  const fuenteUrl = g("fuente_url");
  if (fuenteUrl && (!/^https?:\/\/\S+$/.test(fuenteUrl) || fuenteUrl.length > 500)) err(`"fuente_url" debe empezar con http:// o https://, sin espacios, y medir máximo 500 caracteres.`);
  let phone: string | null = null;
  if (g("telefono")) {
    let d = g("telefono").replace(/[\s\-().]/g, "");
    if (/^\+?52\d{10}$/.test(d)) d = d.replace(/^\+?52/, "");
    if (/^\d{10}$/.test(d)) phone = d;
    else err(`"telefono" = "${g("telefono")}" no es un número de 10 dígitos.`);
  } else if (!fuenteUrl) err('falta "telefono" (o "fuente_url"): la vacante necesita una forma de contacto.');
  const fuente = need("fuente");
  if (fuente) len("fuente", fuente, 2, 80);

  let revisada = g("revisada");
  let dias = 21;
  if (revisada) {
    const ok = /^\d{4}-\d{2}-\d{2}$/.test(revisada) && new Date(dayNum(revisada) * 86400000).toISOString().slice(0, 10) === revisada;
    if (!ok) { err(`"revisada" = "${revisada}" debe ser una fecha AAAA-MM-DD.`); revisada = ""; }
    else if (revisada > todayMty) { err(`"revisada" (${revisada}) está en el futuro (hoy es ${todayMty}).`); revisada = ""; }
  }
  if (g("dias")) {
    if (!/^\d+$/.test(g("dias")) || +g("dias") < 1 || +g("dias") > 60) err(`"dias" debe ser un entero de 1 a 60.`);
    else dias = +g("dias");
  }
  if (revisada && dayNum(revisada) + dias <= dayNum(todayMty)) warn(`la vacante ya venció (revisada ${revisada} + ${dias} días); se cerrará sola.`);
  const estado = choose("estado", g("estado"), ["abierta", "cerrada"], "abierta");

  const sucursalSlug = slug(sucursal);
  if (sucursal && !sucursalSlug) err('"sucursal" debe contener letras o números.');
  const jobId = g("id") || "cur-" + slug(`${empresaId}-${puesto}-${sucursal}`);
  if (jobs.has(jobId)) err(`el id de vacante "${jobId}" está repetido (ya aparece en la fila ${jobs.get(jobId)!.row[0]}). Cambia "puesto"/"sucursal" o escribe un "id" distinto.`);

  // grouping
  const branchId = `${empresaId}-${sucursalSlug}`;
  let co = companies.get(empresaId);
  if (!co && empresa && empresaId) {
    co = { id: empresaId, name: empresa, giro, tamano, acerca, phone, branches: new Map() };
    companies.set(empresaId, co);
  } else if (co) {
    if (empresa && co.name !== empresa) warn(`"empresa" = "${empresa}" difiere de "${co.name}" (mismo empresa_id ${empresaId}); se usa la de la primera fila.`);
    if (giro && co.giro && giro !== co.giro) warn(`"giro" difiere del de la primera fila de ${empresaId}; se usa "${co.giro}".`);
    if (g("tamano") && tamano !== co.tamano) warn(`"tamano" difiere del de la primera fila de ${empresaId}; se usa "${co.tamano}".`);
    if (!co.giro && giro) co.giro = giro;
  }
  if (co && sucursalSlug && !Number.isNaN(lat) && !Number.isNaN(lng)) {
    const b = co.branches.get(branchId);
    if (!b) co.branches.set(branchId, { id: branchId, name: sucursal, colonia, lat, lng, sort: co.branches.size });
    else if (b.colonia !== colonia || b.lat !== lat || b.lng !== lng)
      err(`la sucursal "${sucursal}" de ${empresaId} ya apareció (fila ${branchOf.get(branchId)}) con otra colonia o coordenadas.`);
    if (!branchOf.has(branchId)) branchOf.set(branchId, n);
  }

  if (errors.length > before) continue;
  jobs.set(jobId, { id: jobId, companyId: empresaId, branchId, row: [String(n)] });
  const checked = `(date '${revisada}' + time '12:00') at time zone 'America/Monterrey'`;
  jobRows.push(
    `(${q(jobId)}, ${q(empresaId)}, ${q(branchId)}, ${q(puesto)}, ${q(categoria)}, ${sueldo}, ${sueldoMax ?? "null"}, ${q(periodo)}, ${q(turno)}, ${q(horario)}, ${q(jornada)}, ${q(experiencia)}, ${arr(prestaciones)}, ${arr(requisitos)}, ${q(descripcion)}, ${lugares}, ${urge}, ${q(phone)}, ${q(estado)}, 'curada', ${q(fuente)}, ${q(fuenteUrl || null)}, ${checked}, (${checked}) + interval '${dias} days')`,
  );
}

if (recs.length === 1) errors.push("El archivo tiene encabezados pero ninguna vacante.");
if (errors.length) fail();

function fail(): never {
  for (const w of warnings) console.error(`Aviso: ${w}`);
  for (const e of errors) console.error(`Error: ${e}`);
  console.error(`\n${errors.length} error(es). No se generó SQL; corrige el CSV y vuelve a correrlo.`);
  process.exit(1);
}

// ---------------------------------------------------------------- SQL
const coRows = [...companies.values()].map((c) => `(${q(c.id)}, ${q(c.name)}, ${q(c.giro)}, ${q(c.tamano)}, ${q(c.phone)}, ${q(c.acerca)})`);
const brRows = [...companies.values()].flatMap((c) =>
  [...c.branches.values()].map((b) => `(${q(b.id)}, ${q(c.id)}, ${q(b.name)}, ${q(b.colonia)}, ${point(b.lat, b.lng)}, ${b.sort})`),
);
const jobCols = ["company_id", "branch_id", "title", "category", "pay", "pay_max", "period", "shift", "schedule", "type", "experience", "benefits", "requirements", "description", "openings", "urgent", "phone", "status", "source", "source_label", "source_url", "checked_at", "expires_at"];
const sql = [
  `-- Generated by scripts/import-curated.ts from ${basename(file)} at ${new Date().toISOString()}.`,
  "-- Safe to run again: companies with a team and vacancies already claimed by their company are left alone.",
  "begin;",
  `insert into public.companies (id, name, kind, size, phone, about) values\n${coRows.join(",\n")}\non conflict (id) do update set name = excluded.name, kind = excluded.kind, size = excluded.size, phone = excluded.phone, about = excluded.about\n  where public.companies.owner_id is null;`,
  `insert into public.branches (id, company_id, name, colonia, location, sort) values\n${brRows.join(",\n")}\non conflict (id) do update set name = excluded.name, colonia = excluded.colonia, location = excluded.location\n  where not exists (select 1 from public.company_members m where m.company_id = excluded.company_id);`,
  `insert into public.jobs (id, ${jobCols.join(", ")}) values\n${jobRows.join(",\n")}\non conflict (id) do update set ${jobCols.map((c) => `${c} = excluded.${c}`).join(", ")}\n  where public.jobs.source = 'curada';`,
  ...(closeMissing
    ? [`update public.jobs set status = 'cerrada' where source = 'curada' and status = 'abierta' and id <> all (${arr([...jobs.keys()])});`]
    : []),
  "select\n  (select count(*) from public.jobs where source = 'curada' and status = 'abierta') as vacantes_curadas_abiertas,\n  (select count(*) from public.companies c where c.owner_id is null and exists (select 1 from public.jobs j where j.company_id = c.id and j.source = 'curada' and j.status = 'abierta')) as empresas_sin_reclamar;",
  "commit;",
].join("\n");

for (const w of warnings) console.error(`Aviso: ${w}`);
const nBranches = brRows.length;
console.error(`${companies.size} empresas, ${nBranches} sucursales, ${jobRows.length} vacantes`);
process.stdout.write(sql + "\n");
