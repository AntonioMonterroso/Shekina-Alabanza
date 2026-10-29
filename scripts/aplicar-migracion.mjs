// Aplica migraciones a Supabase por la API de administración y deja el historial registrado
// (la tabla supabase_migrations.schema_migrations, la misma que usa la CLI de Supabase).
//
//   node scripts/aplicar-migracion.mjs                       lista qué está aplicado y qué falta
//   node scripts/aplicar-migracion.mjs <archivo.sql>         aplica UNA migración (todo o nada) y la registra
//   node scripts/aplicar-migracion.mjs --ensayo <archivo>    la prueba dentro de una transacción que se deshace
//   node scripts/aplicar-migracion.mjs --pendientes          aplica, en orden, todas las que falten
//   node scripts/aplicar-migracion.mjs --registrar-existentes   solo anota las que YA están aplicadas (sin ejecutarlas)
//
// Necesita SUPABASE_ACCESS_TOKEN (token personal de Supabase). Opcional: SUPABASE_REF (por defecto, el proyecto de Shekina).
// Ejemplo:  set -a && . ./.env.supabase && set +a && node scripts/aplicar-migracion.mjs --pendientes
import { readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'

const REF = process.env.SUPABASE_REF ?? 'acdskhdbnnvijyekzuft'
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN
const DIR = 'supabase/migrations'

if (!TOKEN) {
  console.error('Falta SUPABASE_ACCESS_TOKEN. Ejemplo:  set -a && . ./.env.supabase && set +a')
  process.exit(1)
}

async function consulta(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const t = await r.text()
  let j
  try { j = JSON.parse(t) } catch { j = t }
  if (!r.ok) throw new Error(typeof j === 'object' && j?.message ? j.message : t.slice(0, 400))
  return j
}

const archivos = () => readdirSync(DIR).filter((f) => /^\d{8,}_.+\.sql$/.test(f)).sort()
const version = (f) => f.split('_')[0]
const nombre = (f) => basename(f, '.sql').split('_').slice(1).join('_')

/** Un texto SQL entre $mig$…$mig$ (sirve para guardar el contenido de la migración tal cual). */
function literal(texto) {
  let etiqueta = 'mig'
  while (texto.includes(`$${etiqueta}$`)) etiqueta += 'x'
  return `$${etiqueta}$${texto}$${etiqueta}$`
}

const CREAR_HISTORIAL = `
  create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (version text not null primary key, statements text[], name text);
`

const registrar = (f, sql) =>
  `insert into supabase_migrations.schema_migrations (version, name, statements) values ('${version(f)}', '${nombre(f).replace(/'/g, "''")}', array[${literal(sql)}]::text[]) on conflict (version) do nothing;`

async function aplicadas() {
  await consulta(CREAR_HISTORIAL)
  const filas = await consulta('select version from supabase_migrations.schema_migrations order by version')
  return new Set(filas.map((x) => x.version))
}

async function listar() {
  const hechas = await aplicadas()
  const todas = archivos()
  console.log(`Proyecto ${REF}`)
  for (const f of todas) console.log(`  ${hechas.has(version(f)) ? '✔ aplicada ' : '… PENDIENTE'}  ${f}`)
  const raras = [...hechas].filter((v) => !todas.some((f) => version(f) === v))
  if (raras.length) console.log(`  Aplicadas en la base pero sin archivo en el repo: ${raras.join(', ')}`)
  return todas.filter((f) => !hechas.has(version(f)))
}

async function aplicar(f, { ensayo = false } = {}) {
  const sql = readFileSync(join(DIR, f), 'utf8')
  const hechas = await aplicadas()
  if (hechas.has(version(f))) throw new Error(`${f} ya está aplicada (registrada en el historial).`)
  const cuerpo = `${sql}\n;\n${registrar(f, sql)}`
  // Todo en una sola petición: si algo falla, no queda nada a medias.
  await consulta(ensayo ? `begin;\n${cuerpo}\nrollback;` : cuerpo)
  console.log(ensayo ? `✔ Ensayo correcto (se deshizo): ${f}` : `✔ Aplicada y registrada: ${f}`)
}

const args = process.argv.slice(2)
const ensayo = args.includes('--ensayo')
const archivo = args.find((a) => a.endsWith('.sql'))

try {
  if (args.includes('--registrar-existentes')) {
    await consulta(CREAR_HISTORIAL)
    for (const f of archivos()) await consulta(registrar(f, readFileSync(join(DIR, f), 'utf8')))
    console.log('Historial al día: todas las migraciones del repo quedaron anotadas como aplicadas.')
    await listar()
  } else if (args.includes('--pendientes')) {
    const falta = await listar()
    if (falta.length === 0) console.log('\nNo hay migraciones pendientes.')
    for (const f of falta) await aplicar(f, { ensayo })
  } else if (archivo) {
    await aplicar(basename(archivo), { ensayo })
  } else {
    const falta = await listar()
    console.log(falta.length ? `\n${falta.length} pendiente(s). Aplícalas con --pendientes (o una por una).` : '\nTodo al día.')
  }
} catch (e) {
  console.error(`✖ ${e.message}`)
  process.exit(1)
}
