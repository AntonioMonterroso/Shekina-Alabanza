// Cambia la contraseña de un integrante. El integrante deberá cambiarla al entrar.
//  · líder: puede con músico, voz, sonido, multimedia y alumno
//  · propietario: además con líderes
//  · nadie toca la del propietario (la cambia él mismo desde su perfil)
import { adminClient, json, passwordValida, preflight, quienLlama } from '../_shared/admin.ts'

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
