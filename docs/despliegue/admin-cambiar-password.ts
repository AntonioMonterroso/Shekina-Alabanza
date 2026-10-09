// =============================================================================
// admin-cambiar-password — archivo único para pegar en Supabase (Edge Functions → Via Editor).
// Generado con scripts/empaquetar-funciones.mjs. No lo edites a mano: cambia los archivos de
// supabase/functions/ y vuelve a generarlo.
// =============================================================================
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

// ---- supabase/functions/_shared/admin.ts ----
export const DOMINIO_USUARIOS = 'usuarios.alabanza.invalid' // nunca recibe correo (TLD reservado)
export const correoDeUsuario = (u: string) => `${u}@${DOMINIO_USUARIOS}`

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

export const preflight = (req: Request) => (req.method === 'OPTIONS' ? new Response('ok', { headers: cors }) : null)

export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/** Devuelve el usuario que llama (validando su JWT) o null. */
export async function quienLlama(req: Request, admin: SupabaseClient) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data, error } = await admin.auth.getUser(token)
  return error ? null : data.user
}

export const ROLES_ASIGNABLES = ['lider', 'musico', 'voz', 'sonido', 'multimedia', 'alumno', 'maestro', 'tutor'] as const
export type RolAsignable = (typeof ROLES_ASIGNABLES)[number]

export const usuarioValido = (u: unknown): u is string => typeof u === 'string' && /^[a-z0-9._-]{3,30}$/.test(u)
export const passwordValida = (p: unknown): p is string => typeof p === 'string' && p.length >= 8 && p.length <= 72

// ---- supabase/functions/admin-cambiar-password/index.ts ----
// Cambia la contraseña de un integrante. El integrante deberá cambiarla al entrar.
//  · líder: puede con músico, voz, sonido, multimedia y alumno
//  · propietario: además con líderes
//  · nadie toca la del propietario (la cambia él mismo desde su perfil)
Deno.serve(async (req) => {
  const pre = preflight(req)
  if (pre) return pre
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  const admin = adminClient()
  const yo = await quienLlama(req, admin)
  if (!yo) return json({ error: 'No autorizado' }, 401)

  const { miembro_id, password } = await req.json().catch(() => ({}))
  if (typeof miembro_id !== 'string') return json({ error: 'Falta el integrante' }, 400)
  if (!passwordValida(password)) return json({ error: 'La contraseña debe tener entre 8 y 72 caracteres' }, 400)

  const { data: objetivo } = await admin.from('miembros').select('user_id, grupo_id, rol').eq('id', miembro_id).maybeSingle()
  if (!objetivo) return json({ error: 'Integrante no encontrado' }, 404)

  const { data: mio } = await admin.from('miembros').select('rol')
    .eq('grupo_id', objetivo.grupo_id).eq('user_id', yo.id).eq('activo', true).maybeSingle()
  if (!mio || !['propietario', 'lider'].includes(mio.rol)) return json({ error: 'No tienes permiso' }, 403)

  if (objetivo.rol === 'propietario') return json({ error: 'La contraseña del propietario la cambia él mismo' }, 403)
  if (objetivo.rol === 'lider' && mio.rol !== 'propietario') return json({ error: 'Solo el propietario cambia la contraseña de un líder' }, 403)

  const { error } = await admin.auth.admin.updateUserById(objetivo.user_id, { password })
  if (error) return json({ error: 'No se pudo cambiar la contraseña' }, 500)

  await admin.from('perfiles').update({ debe_cambiar_password: true }).eq('id', objetivo.user_id)
  return json({ ok: true })
})
