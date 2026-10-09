// =============================================================================
// admin-crear-usuario — archivo único para pegar en Supabase (Edge Functions → Via Editor).
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

// ---- supabase/functions/admin-crear-usuario/index.ts ----
// Crea un usuario y lo agrega a un grupo. Solo líder/propietario del grupo.
// Un líder únicamente crea roles que no sean líder; el propietario puede crear líderes.
Deno.serve(async (req) => {
  const pre = preflight(req)
  if (pre) return pre
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  const admin = adminClient()
  const yo = await quienLlama(req, admin)
  if (!yo) return json({ error: 'No autorizado' }, 401)

  const b = await req.json().catch(() => ({}))
  const usuario = String(b.usuario ?? '').trim().toLowerCase()
  const nombre = String(b.nombre ?? '').trim()
  const { grupo_id, password, rol } = b
  const descripcion = b.descripcion ? String(b.descripcion).trim().slice(0, 80) : null

  if (!usuarioValido(usuario)) return json({ error: 'Usuario: 3 a 30 caracteres (letras minúsculas, números, . _ -)' }, 400)
  if (nombre.length < 2 || nombre.length > 80) return json({ error: 'Escribe el nombre del integrante' }, 400)
  if (!passwordValida(password)) return json({ error: 'La contraseña debe tener entre 8 y 72 caracteres' }, 400)
  if (!ROLES_ASIGNABLES.includes(rol)) return json({ error: 'Rol no válido' }, 400)
  if (typeof grupo_id !== 'string') return json({ error: 'Falta el grupo' }, 400)

  const { data: mio } = await admin.from('miembros').select('rol')
    .eq('grupo_id', grupo_id).eq('user_id', yo.id).eq('activo', true).maybeSingle()
  if (!mio || !['propietario', 'lider'].includes(mio.rol)) return json({ error: 'No tienes permiso en este grupo' }, 403)
  if (rol === 'lider' && mio.rol !== 'propietario') return json({ error: 'Solo el propietario nombra líderes' }, 403)

  const { data: existe } = await admin.from('perfiles').select('id').eq('usuario', usuario).maybeSingle()
  if (existe) return json({ error: 'Ese usuario ya existe' }, 409)

  const { data: creado, error: eAuth } = await admin.auth.admin.createUser({
    email: correoDeUsuario(usuario), password, email_confirm: true, user_metadata: { usuario },
  })
  if (eAuth || !creado.user) return json({ error: 'No se pudo crear el usuario' }, 500)
  const uid = creado.user.id

  const { error: ePerfil } = await admin.from('perfiles').insert({ id: uid, usuario, nombre, debe_cambiar_password: true })
  const { data: miembro, error: eMiembro } = ePerfil
    ? { data: null, error: ePerfil }
    : await admin.from('miembros').insert({ grupo_id, user_id: uid, rol, descripcion }).select('id').single()

  if (eMiembro) {
    await admin.auth.admin.deleteUser(uid) // revierte: no deja usuarios a medias
    return json({ error: 'No se pudo agregar al grupo' }, 500)
  }
  return json({ ok: true, miembro_id: miembro!.id, usuario })
})
