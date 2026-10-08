// Envía una notificación push. La app la llama después de una acción (aviso, ensayo, turno, "no puedo").
// Quién puede disparar cada tipo se valida aquí, no en el cliente:
//   aviso, ensayo, turno → líder o propietario del grupo
//   no_puede             → el propio integrante del turno (avisa a los líderes)
//   practica             → quien gestiona la clase (maestro o coordinación); avisa a los alumnos y sus tutores
//   comentario, nivel    → su autor; avisa al alumno y sus tutores
//   recomendado          → quien le enseña o coordina; avisa a los líderes
import webpush from 'npm:web-push@3.6.7'
import { adminClient, json, preflight, quienLlama } from '../_shared/admin.ts'
import { armarMensaje, type DatosPush, type TipoPush } from '../_shared/push.ts'

const EQUIPO = ['propietario', 'lider', 'musico', 'voz', 'sonido', 'multimedia']
const LIDERES = ['propietario', 'lider']

Deno.serve(async (req) => {
  const pre = preflight(req)
  if (pre) return pre
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  const publica = Deno.env.get('VAPID_PUBLIC_KEY')
  const privada = Deno.env.get('VAPID_PRIVATE_KEY')
  const appUrl = Deno.env.get('APP_URL')
  if (!publica || !privada || !appUrl) return json({ error: 'Notificaciones sin configurar' }, 503)

  const admin = adminClient()
  const yo = await quienLlama(req, admin)
  if (!yo) return json({ error: 'No autorizado' }, 401)

  const { tipo, id } = await req.json().catch(() => ({})) as { tipo?: TipoPush; id?: string }
  if (!id || typeof id !== 'string' || !['aviso', 'ensayo', 'turno', 'no_puede', 'practica', 'comentario', 'nivel', 'recomendado'].includes(tipo ?? '')) return json({ error: 'Petición no válida' }, 400)

  async function rolEn(grupoId: string): Promise<string | null> {
    const { data } = await admin.from('miembros').select('rol').eq('grupo_id', grupoId).eq('user_id', yo!.id).eq('activo', true).maybeSingle()
    return (data?.rol as string | undefined) ?? null
  }
  async function usuariosDe(grupoId: string, roles: string[]): Promise<string[]> {
    const { data } = await admin.from('miembros').select('user_id').eq('grupo_id', grupoId).eq('activo', true).in('rol', roles)
    return (data ?? []).map((m) => m.user_id as string)
  }

  /** user_id de unos miembros */
  async function usuariosDeMiembros(ids: string[]): Promise<string[]> {
    if (ids.length === 0) return []
    const { data } = await admin.from('miembros').select('user_id').in('id', ids).eq('activo', true)
    return (data ?? []).map((m) => m.user_id as string)
  }
  /** Los alumnos y sus tutores (a quien le toca enterarse) */
  async function conTutores(alumnos: string[]): Promise<string[]> {
    if (alumnos.length === 0) return []
    const { data: t } = await admin.from('escuela_tutores').select('tutor_id').in('alumno_id', alumnos)
    return usuariosDeMiembros([...alumnos, ...(t ?? []).map((x) => x.tutor_id as string)])
  }
  /** ¿yo gestiono esta clase? (la coordina el grupo, o soy su maestro) */
  async function gestionaClase(claseId: string): Promise<{ grupo: string; nombre: string } | null> {
    const { data: c } = await admin.from('escuela_clases').select('grupo_id, maestro_id, nombre').eq('id', claseId).maybeSingle()
    if (!c) return null
    const { data: mio } = await admin.from('miembros').select('id, rol, coordina_escuela').eq('grupo_id', c.grupo_id).eq('user_id', yo!.id).eq('activo', true).maybeSingle()
    if (!mio) return null
    const coordina = LIDERES.includes(mio.rol as string) || Boolean(mio.coordina_escuela)
    return coordina || c.maestro_id === mio.id ? { grupo: c.grupo_id as string, nombre: c.nombre as string } : null
  }
  async function nombreDe(miembroId: string): Promise<string | undefined> {
    const { data: m } = await admin.from('miembros').select('user_id').eq('id', miembroId).maybeSingle()
    if (!m) return undefined
    const { data: p } = await admin.from('perfiles').select('nombre').eq('id', m.user_id).maybeSingle()
    return (p?.nombre as string | undefined)?.split(' ')[0]
  }

  let destinos: string[] = []
  let datos: DatosPush = {}

  if (tipo === 'aviso') {
    const { data: a } = await admin.from('avisos').select('grupo_id, texto').eq('id', id).maybeSingle()
    if (!a) return json({ error: 'No encontrado' }, 404)
    if (!LIDERES.includes((await rolEn(a.grupo_id as string)) ?? '')) return json({ error: 'Sin permiso' }, 403)
    destinos = await usuariosDe(a.grupo_id as string, [...EQUIPO, 'alumno', 'maestro', 'tutor'])
    datos = { texto: a.texto as string }
  } else if (tipo === 'ensayo') {
    const { data: e } = await admin.from('ensayos').select('grupo_id, fecha, lugar').eq('id', id).maybeSingle()
    if (!e) return json({ error: 'No encontrado' }, 404)
    if (!LIDERES.includes((await rolEn(e.grupo_id as string)) ?? '')) return json({ error: 'Sin permiso' }, 403)
    destinos = await usuariosDe(e.grupo_id as string, EQUIPO)
    datos = { fecha: e.fecha as string, lugar: e.lugar as string | null }
  } else if (tipo === 'practica') {
    const { data: p } = await admin.from('escuela_practicas').select('clase_id, alumno_id, titulo').eq('id', id).maybeSingle()
    if (!p) return json({ error: 'No encontrado' }, 404)
    const clase = await gestionaClase(p.clase_id as string)
    if (!clase) return json({ error: 'Sin permiso' }, 403)
    let alumnos: string[]
    if (p.alumno_id) alumnos = [p.alumno_id as string]
    else {
      const { data: ins } = await admin.from('escuela_inscripciones').select('alumno_id').eq('clase_id', p.clase_id).eq('activo', true)
      alumnos = (ins ?? []).map((i) => i.alumno_id as string)
    }
    destinos = await conTutores(alumnos)
    datos = { titulo: p.titulo as string, clase: clase.nombre }
  } else if (tipo === 'comentario') {
    const { data: c } = await admin.from('escuela_comentarios').select('clase_id, alumno_id, autor_id, texto').eq('id', id).maybeSingle()
    if (!c || !c.autor_id) return json({ error: 'No encontrado' }, 404)
    const [autor] = await usuariosDeMiembros([c.autor_id as string])
    if (autor !== yo.id) return json({ error: 'Sin permiso' }, 403)
    destinos = await conTutores([c.alumno_id as string])
    datos = { texto: c.texto as string, nombre: await nombreDe(c.autor_id as string) }
  } else if (tipo === 'nivel') {
    const { data: h } = await admin.from('escuela_hitos').select('alumno_id, nivel_id, por').eq('id', id).maybeSingle()
    if (!h || !h.por) return json({ error: 'No encontrado' }, 404)
    const [autor] = await usuariosDeMiembros([h.por as string])
    if (autor !== yo.id) return json({ error: 'Sin permiso' }, 403)
    const { data: n } = await admin.from('escuela_niveles').select('nombre, curso:escuela_cursos(nombre)').eq('id', h.nivel_id).maybeSingle()
    const curso = (Array.isArray(n?.curso) ? n?.curso[0] : n?.curso) as { nombre: string } | null | undefined
    destinos = await conTutores([h.alumno_id as string])
    datos = { alumno: await nombreDe(h.alumno_id as string), nivel: n?.nombre as string | undefined, curso: curso?.nombre }
  } else if (tipo === 'recomendado') {
    // id = el miembro recomendado; quien avisa debe enseñarle o coordinar su grupo
    const { data: al } = await admin.from('miembros').select('grupo_id').eq('id', id).maybeSingle()
    if (!al) return json({ error: 'No encontrado' }, 404)
    const { data: ins } = await admin.from('escuela_inscripciones').select('clase_id').eq('alumno_id', id).eq('activo', true)
    let permitido = LIDERES.includes((await rolEn(al.grupo_id as string)) ?? '')
    for (const i of ins ?? []) if (!permitido && await gestionaClase(i.clase_id as string)) permitido = true
    if (!permitido) return json({ error: 'Sin permiso' }, 403)
    destinos = await usuariosDe(al.grupo_id as string, LIDERES)
    datos = { alumno: await nombreDe(id) }
  } else {
    const { data: t } = await admin.from('turnos')
      .select('estado, miembro_id, puesto:puestos(nombre), servicio:servicios(grupo_id, fecha, tipo)').eq('id', id).maybeSingle()
    const puesto = (Array.isArray(t?.puesto) ? t?.puesto[0] : t?.puesto) as { nombre: string } | null | undefined
    const servicio = (Array.isArray(t?.servicio) ? t?.servicio[0] : t?.servicio) as { grupo_id: string; fecha: string; tipo: string } | null | undefined
    if (!t || !servicio || !t.miembro_id) return json({ error: 'No encontrado' }, 404)
    const { data: m } = await admin.from('miembros').select('user_id').eq('id', t.miembro_id).maybeSingle()
    if (!m) return json({ error: 'No encontrado' }, 404)

    if (tipo === 'turno') {
      if (!LIDERES.includes((await rolEn(servicio.grupo_id)) ?? '')) return json({ error: 'Sin permiso' }, 403)
      destinos = [m.user_id as string]
      datos = { puesto: puesto?.nombre, servicio: servicio.tipo, fecha: servicio.fecha }
    } else {
      if (m.user_id !== yo.id || t.estado !== 'no_puede') return json({ error: 'Sin permiso' }, 403)
      const { data: p } = await admin.from('perfiles').select('nombre').eq('id', yo.id).maybeSingle()
      destinos = await usuariosDe(servicio.grupo_id, LIDERES)
      datos = { nombre: (p?.nombre as string | undefined)?.split(' ')[0], puesto: puesto?.nombre, fecha: servicio.fecha }
    }
  }

  destinos = destinos.filter((u) => u !== yo.id)
  if (destinos.length === 0) return json({ ok: true, enviadas: 0 })

  const { data: subs } = await admin.from('push_suscripciones').select('id, endpoint, p256dh, auth').in('user_id', destinos)
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com', publica, privada)
  const mensaje = JSON.stringify(armarMensaje(tipo as TipoPush, datos, appUrl))

  let enviadas = 0
  const caducadas: string[] = []
  await Promise.all((subs ?? []).map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint as string, keys: { p256dh: s.p256dh as string, auth: s.auth as string } }, mensaje)
      enviadas++
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode
      if (code === 404 || code === 410) caducadas.push(s.id as string) // el dispositivo ya no existe
    }
  }))
  if (caducadas.length) await admin.from('push_suscripciones').delete().in('id', caducadas)
  return json({ ok: true, enviadas })
})
