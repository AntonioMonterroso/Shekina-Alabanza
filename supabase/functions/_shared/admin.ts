import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

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
