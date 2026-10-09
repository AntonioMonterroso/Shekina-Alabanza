// Junta cada Edge Function con sus archivos compartidos (_shared) en UN solo archivo, para pegarlo
// en el editor de Supabase (Edge Functions → Via Editor), que no entiende imports entre carpetas.
// Uso: node scripts/empaquetar-funciones.mjs   → escribe docs/despliegue/<función>.ts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const leer = (p) => readFileSync(p, 'utf8')
const sinImports = (t) => t.replace(/^import [^\n]*\n/gm, '').replace(/^import \{[^}]*\} from [^\n]*\n/gm, '')
// Los imports pueden ocupar varias líneas: se quitan completos
const quitarImports = (t) => t.replace(/^import\s+(?:[^;'"]*?\sfrom\s+)?['"][^'"]+['"];?\s*\n/gm, '').replace(/^import\s*\{[\s\S]*?\}\s*from\s*['"][^'"]+['"];?\s*\n/gm, '')

const cabecera = (nombre) => `// =============================================================================
// ${nombre} — archivo único para pegar en Supabase (Edge Functions → Via Editor).
// Generado con scripts/empaquetar-funciones.mjs. No lo edites a mano: cambia los archivos de
// supabase/functions/ y vuelve a generarlo.
// =============================================================================
`

const FUNCIONES = {
  'enviar-push': { imports: ["import webpush from 'npm:web-push@3.6.7'", "import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'"], partes: ['supabase/functions/_shared/admin.ts', 'supabase/functions/_shared/push.ts', 'supabase/functions/enviar-push/index.ts'] },
  'admin-crear-usuario': { imports: ["import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'"], partes: ['supabase/functions/_shared/admin.ts', 'supabase/functions/admin-crear-usuario/index.ts'] },
  'admin-cambiar-password': { imports: ["import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'"], partes: ['supabase/functions/_shared/admin.ts', 'supabase/functions/admin-cambiar-password/index.ts'] },
}

mkdirSync('docs/despliegue', { recursive: true })
for (const [nombre, f] of Object.entries(FUNCIONES)) {
  const cuerpo = f.partes.map((p) => `// ---- ${p} ----\n${quitarImports(leer(p)).trim()}\n`).join('\n')
  writeFileSync(`docs/despliegue/${nombre}.ts`, `${cabecera(nombre)}${f.imports.join('\n')}\n\n${cuerpo}`)
  console.log('docs/despliegue/' + nombre + '.ts')
}
