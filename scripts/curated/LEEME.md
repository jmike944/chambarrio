# Captura de vacantes curadas

Una vacante curada es un puesto que vimos en una fuente pública (lona "Se solicita" afuera de una planta,
página de empleo de la empresa…) y que publicamos en Chambarrio con el teléfono de contacto.

## Reglas

- Solo vacantes que **muestren sueldo**.
- **Llama al teléfono para confirmar** que la vacante sigue abierta. Solo entonces llena `revisada` con la fecha de la llamada.
- Escribe `descripcion`, `prestaciones` y `requisitos` **con tus propias palabras**. Nunca pegues el texto original.
- Una fila por vacante. Si la empresa tiene varias sucursales o puestos, repite el nombre de la empresa tal cual.

## Columnas

Empieza copiando `plantilla.csv` a una hoja de Google Sheets (no borres los encabezados, pero **sí borra la fila de
"Empresa de Ejemplo"**: es ficticia y se publicaría).

- `empresa` (obligatoria): nombre. `empresa_id`, `giro`, `tamano` (Micro, Pequeña, Mediana, Grande), `acerca`: opcionales; se toman de la primera fila de la empresa.
- `sucursal`, `colonia` (obligatorias): planta o sucursal y su colonia.
- `coordenadas` (obligatoria): en Google Maps, **clic derecho sobre el punto exacto** y clic en los números de arriba para copiarlos. Se pegan tal cual: `25.4269, -101.0081`.
- `puesto` y `categoria` (produccion, almacen, montacargas, chofer, restaurante, caja, ventas, limpieza, mantenimiento, seguridad, oficina, construccion).
- `sueldo` (solo número, ej. 2450), `sueldo_max` (opcional), `periodo` (semana, quincena, mes, dia; si lo dejas vacío es semana).
- `turno` (Matutino, Vespertino, Nocturno, Mixto, Rotativo), `horario` (texto libre), `jornada` (Tiempo completo, Medio tiempo, Temporal, Fines de semana), `experiencia` (Sin experiencia, 6 meses, 1 año, 2 años o más).
- `prestaciones`, `requisitos`: varios elementos separados por `;` (máximo 12).
- `descripcion` (máx. 1000 caracteres), `lugares` (cuántas personas buscan), `urge` (sí o x si urge).
- `telefono`: 10 dígitos. Obligatorio si no hay `fuente_url`.
- `fuente`: dónde la vimos, tal como lo leerá el candidato ("Lona afuera de la planta"). `fuente_url`: enlace a la publicación, si existe.
- `revisada`: fecha AAAA-MM-DD en que confirmaste por teléfono. `dias`: cuántos días vale (21 si lo dejas vacío); después se cierra sola.
- `estado`: abierta (default) o cerrada. `id`: déjalo vacío.

## Generar el SQL

1. En Google Sheets: Archivo > Descargar > Valores separados por comas (.csv). Guárdalo en `scripts/curated/` (por ejemplo `vacantes.csv`).
2. En la terminal, desde la raíz del repo:

   `node scripts/import-curated.ts scripts/curated/vacantes.csv > scripts/curated/vacantes.sql`

   Si hay errores, salen en pantalla con el número de fila; corrígelos en la hoja y repite.
   Agrega `--cerrar-faltantes` para cerrar las vacantes curadas que ya no estén en la hoja. Úsalo solo con la hoja
   completa: cierra **todas** las curadas que no vengan en ese archivo.
3. Abre `vacantes.sql`, cópialo todo y pégalo en Supabase > SQL editor > Run. Se puede correr varias veces sin duplicar nada.

## Volver a confirmar

Cada vacante se cierra sola cuando pasan sus `dias`. Si al llamar sigue abierta, cambia `revisada` a la fecha de hoy y
vuelve a generar y correr el SQL: se reabre con el nuevo plazo.

## Cuando hables con la empresa

Mándale el enlace de su vacante o `https://chambarrio.com/reclamar?empresa=<empresa_id>`. Ahí entra con el **mismo
celular que aparece en la vacante** (le llega un SMS) y la empresa queda a su nombre: sus vacantes empiezan a recibir
postulaciones y desde ese momento este archivo ya no las cambia.

## No subas los datos reales a git

El repositorio es público. Los `.csv` (excepto `plantilla.csv`) están en `.gitignore`; no los fuerces con `git add -f`.
Ten el mismo cuidado con los `.sql` generados: no los subas.
