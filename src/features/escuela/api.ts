import { supabase } from '../../lib/supabase'

export type ColorCurso = 'verde' | 'lila' | 'rosa' | 'ambar' | 'azul'
export const COLORES: ColorCurso[] = ['verde', 'lila', 'rosa', 'ambar', 'azul']
export const estiloColor = (c: ColorCurso) => ({ background: `var(--c-${c}-bg)`, color: `var(--c-${c}-fg)` })

export interface Curso { id: string; nombre: string; descripcion: string | null; color: ColorCurso; orden: number; activo: boolean }
export interface Clase { id: string; curso_id: string; nombre: string; tipo: 'grupal' | 'individual'; maestro_id: string | null; horario: string | null; lugar: string | null; activo: boolean }
export interface Practica { id: string; clase_id: string; alumno_id: string | null; semana: string; titulo: string; detalle: string | null; minutos_meta: number | null; enlace: string | null; bpm: number | null }
export interface Registro { id: string; practica_id: string; alumno_id: string; fecha: string; minutos: number; nota: string | null }
export interface Sesion { id: string; clase_id: string; fecha: string; tema: string | null }
export type EstadoAsistencia = 'presente' | 'ausente' | 'justificado'
export interface Asistencia { sesion_id: string; alumno_id: string; estado: EstadoAsistencia }
export interface PerfilAlumno { miembro_id: string; nacimiento: string | null; objetivo: string | null }

const COLS_CLASE = 'id, curso_id, nombre, tipo, maestro_id, horario, lugar, activo'
const COLS_PRACTICA = 'id, clase_id, alumno_id, semana, titulo, detalle, minutos_meta, enlace, bpm'

export async function cargarCursos(grupoId: string): Promise<Curso[]> {
  const { data } = await supabase.from('escuela_cursos').select('id, nombre, descripcion, color, orden, activo').eq('grupo_id', grupoId).order('orden').order('nombre')
  return (data ?? []) as Curso[]
}

export async function guardarCurso(grupoId: string, id: string | null, d: { nombre: string; descripcion: string | null; color: ColorCurso; activo: boolean }, orden: number): Promise<string | null> {
  const { error } = id
    ? await supabase.from('escuela_cursos').update(d).eq('id', id)
    : await supabase.from('escuela_cursos').insert({ ...d, grupo_id: grupoId, orden })
  if (!error) return null
  return error.code === '23505' ? 'Ya hay un curso con ese nombre.' : 'No se pudo guardar. Intenta de nuevo.'
}

export async function cargarClases(grupoId: string): Promise<Clase[]> {
  const { data } = await supabase.from('escuela_clases').select(COLS_CLASE).eq('grupo_id', grupoId).order('nombre')
  return (data ?? []) as Clase[]
}

export async function cargarClase(id: string): Promise<Clase | null> {
  const { data } = await supabase.from('escuela_clases').select(COLS_CLASE).eq('id', id).maybeSingle()
  return (data as Clase | null) ?? null
}

export async function guardarClase(grupoId: string, id: string | null, d: Omit<Clase, 'id'>): Promise<string | null> {
  const { data, error } = id
    ? await supabase.from('escuela_clases').update(d).eq('id', id).select('id').single()
    : await supabase.from('escuela_clases').insert({ ...d, grupo_id: grupoId }).select('id').single()
  return error || !data ? null : (data.id as string)
}

export async function borrarClase(id: string): Promise<boolean> {
  const { error } = await supabase.from('escuela_clases').delete().eq('id', id)
  return !error
}

/** alumno_id → cantidad de clases/alumnos: inscritos activos de una o varias clases. */
export async function cargarInscritos(claseIds: string[]): Promise<{ clase_id: string; alumno_id: string }[]> {
  if (claseIds.length === 0) return []
  const { data } = await supabase.from('escuela_inscripciones').select('clase_id, alumno_id').in('clase_id', claseIds).eq('activo', true)
  return (data ?? []) as { clase_id: string; alumno_id: string }[]
}

export async function inscribir(claseId: string, alumnoId: string): Promise<boolean> {
  const { error } = await supabase.from('escuela_inscripciones').upsert({ clase_id: claseId, alumno_id: alumnoId, activo: true }, { onConflict: 'clase_id,alumno_id' })
  if (error) return false
  // Todo inscrito tiene su ficha de alumno (se completa después)
  await supabase.from('escuela_alumnos').upsert({ miembro_id: alumnoId }, { onConflict: 'miembro_id', ignoreDuplicates: true })
  return true
}

export async function desinscribir(claseId: string, alumnoId: string): Promise<boolean> {
  const { error } = await supabase.from('escuela_inscripciones').update({ activo: false }).eq('clase_id', claseId).eq('alumno_id', alumnoId)
  return !error
}

export async function cargarFicha(alumnoId: string): Promise<{ perfil: PerfilAlumno | null; tutores: string[] }> {
  const [p, t] = await Promise.all([
    supabase.from('escuela_alumnos').select('miembro_id, nacimiento, objetivo').eq('miembro_id', alumnoId).maybeSingle(),
    supabase.from('escuela_tutores').select('tutor_id').eq('alumno_id', alumnoId),
  ])
  return { perfil: (p.data as PerfilAlumno | null) ?? null, tutores: ((t.data ?? []) as { tutor_id: string }[]).map((x) => x.tutor_id) }
}

export async function guardarFicha(alumnoId: string, nacimiento: string | null, objetivo: string | null): Promise<boolean> {
  const { error } = await supabase.from('escuela_alumnos').upsert({ miembro_id: alumnoId, nacimiento, objetivo }, { onConflict: 'miembro_id' })
  return !error
}

export async function ponerTutor(tutorId: string, alumnoId: string): Promise<boolean> {
  const { error } = await supabase.from('escuela_tutores').upsert({ tutor_id: tutorId, alumno_id: alumnoId }, { onConflict: 'tutor_id,alumno_id', ignoreDuplicates: true })
  return !error
}

export async function quitarTutor(tutorId: string, alumnoId: string): Promise<boolean> {
  const { error } = await supabase.from('escuela_tutores').delete().eq('tutor_id', tutorId).eq('alumno_id', alumnoId)
  return !error
}

export async function cargarPracticas(claseIds: string[], semanas: string[]): Promise<Practica[]> {
  if (claseIds.length === 0 || semanas.length === 0) return []
  const { data } = await supabase.from('escuela_practicas').select(COLS_PRACTICA).in('clase_id', claseIds).in('semana', semanas).order('created_at')
  return (data ?? []) as Practica[]
}

export async function guardarPractica(d: Omit<Practica, 'id'>, id?: string): Promise<boolean> {
  const { error } = id ? await supabase.from('escuela_practicas').update(d).eq('id', id) : await supabase.from('escuela_practicas').insert(d)
  return !error
}

export async function borrarPractica(id: string): Promise<boolean> {
  const { error } = await supabase.from('escuela_practicas').delete().eq('id', id)
  return !error
}

export async function cargarRegistros(practicaIds: string[], desde: string, alumnoId?: string): Promise<Registro[]> {
  if (practicaIds.length === 0) return []
  let q = supabase.from('escuela_registro').select('id, practica_id, alumno_id, fecha, minutos, nota').in('practica_id', practicaIds).gte('fecha', desde)
  if (alumnoId) q = q.eq('alumno_id', alumnoId)
  const { data } = await q
  return (data ?? []) as Registro[]
}

export async function anotarPractica(practicaId: string, alumnoId: string, fecha: string, minutos: number, nota: string | null): Promise<boolean> {
  const { error } = await supabase.from('escuela_registro').upsert({ practica_id: practicaId, alumno_id: alumnoId, fecha, minutos, nota }, { onConflict: 'practica_id,alumno_id,fecha' })
  return !error
}

export async function borrarRegistro(id: string): Promise<boolean> {
  const { error } = await supabase.from('escuela_registro').delete().eq('id', id)
  return !error
}

export async function cargarSesiones(claseId: string): Promise<Sesion[]> {
  const { data } = await supabase.from('escuela_sesiones').select('id, clase_id, fecha, tema').eq('clase_id', claseId).order('fecha', { ascending: false }).limit(20)
  return (data ?? []) as Sesion[]
}

export async function crearSesion(claseId: string, fecha: string, tema: string | null): Promise<string | null> {
  const { data, error } = await supabase.from('escuela_sesiones').insert({ clase_id: claseId, fecha, tema }).select('id').single()
  return error || !data ? null : (data.id as string)
}

export async function borrarSesion(id: string): Promise<boolean> {
  const { error } = await supabase.from('escuela_sesiones').delete().eq('id', id)
  return !error
}

export async function cargarAsistencia(sesionIds: string[]): Promise<Asistencia[]> {
  if (sesionIds.length === 0) return []
  const { data } = await supabase.from('escuela_asistencia').select('sesion_id, alumno_id, estado').in('sesion_id', sesionIds)
  return (data ?? []) as Asistencia[]
}

export async function marcarAsistencia(sesionId: string, alumnoId: string, estado: EstadoAsistencia | null): Promise<boolean> {
  const { error } = estado
    ? await supabase.from('escuela_asistencia').upsert({ sesion_id: sesionId, alumno_id: alumnoId, estado }, { onConflict: 'sesion_id,alumno_id' })
    : await supabase.from('escuela_asistencia').delete().eq('sesion_id', sesionId).eq('alumno_id', alumnoId)
  return !error
}

/** Hijos de este tutor (miembro_id de los alumnos). */
export async function cargarHijos(tutorId: string): Promise<string[]> {
  const { data } = await supabase.from('escuela_tutores').select('alumno_id').eq('tutor_id', tutorId)
  return ((data ?? []) as { alumno_id: string }[]).map((x) => x.alumno_id)
}

/** La clase (sesión) que viene, de entre estas clases. Se sigue mostrando unas horas después de empezar. */
export async function proximaSesion(claseIds: string[]): Promise<Sesion | null> {
  if (claseIds.length === 0) return null
  const desde = new Date(Date.now() - 3 * 3600 * 1000).toISOString()
  const { data } = await supabase.from('escuela_sesiones').select('id, clase_id, fecha, tema').in('clase_id', claseIds).gte('fecha', desde).order('fecha').limit(1).maybeSingle()
  return (data as Sesion | null) ?? null
}

/** Las clases en las que está inscrito este alumno. */
export async function clasesDeAlumno(alumnoId: string): Promise<string[]> {
  const { data } = await supabase.from('escuela_inscripciones').select('clase_id').eq('alumno_id', alumnoId).eq('activo', true)
  return ((data ?? []) as { clase_id: string }[]).map((x) => x.clase_id)
}

export async function actualizarSesion(id: string, d: { fecha?: string; tema?: string | null }): Promise<boolean> {
  const { error } = await supabase.from('escuela_sesiones').update(d).eq('id', id)
  return !error
}

export async function cargarPractica(id: string): Promise<Practica | null> {
  const { data } = await supabase.from('escuela_practicas').select(COLS_PRACTICA).eq('id', id).maybeSingle()
  return (data as Practica | null) ?? null
}

// ---------------- Materiales ----------------
export interface Material { id: string; curso_id: string; titulo: string; url: string | null; storage_path: string | null }
export const MAX_MB_MATERIAL = 25

export async function cargarMateriales(cursoIds: string[]): Promise<Material[]> {
  if (cursoIds.length === 0) return []
  const { data } = await supabase.from('escuela_materiales').select('id, curso_id, titulo, url, storage_path').in('curso_id', cursoIds).order('created_at')
  return (data ?? []) as Material[]
}

/** Enlaces temporales (1 hora) para abrir los archivos del bucket privado: path → url. */
export async function urlsDeMateriales(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {}
  const { data } = await supabase.storage.from('escuela').createSignedUrls(paths, 3600)
  const fuera: Record<string, string> = {}
  for (const x of data ?? []) if (x.signedUrl && x.path) fuera[x.path] = x.signedUrl
  return fuera
}

export async function agregarEnlace(grupoId: string, cursoId: string, titulo: string, url: string, autorId: string): Promise<boolean> {
  const { error } = await supabase.from('escuela_materiales').insert({ grupo_id: grupoId, curso_id: cursoId, titulo, url, created_by: autorId })
  return !error
}

export function validarMaterial(f: File): string | null {
  const ok = f.type === 'application/pdf' || f.type.startsWith('image/') || f.type.startsWith('audio/') || f.type === 'video/mp4'
  if (!ok) return 'Sube un PDF, una imagen, un audio o un video mp4.'
  if (f.size > MAX_MB_MATERIAL * 1024 * 1024) return `El archivo pesa más de ${MAX_MB_MATERIAL} MB.`
  return null
}

export async function subirMaterial(grupoId: string, cursoId: string, titulo: string, f: File, autorId: string): Promise<string | null> {
  const mal = validarMaterial(f)
  if (mal) return mal
  const ext = (f.name.split('.').pop() ?? 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin'
  const path = `${grupoId}/${cursoId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('escuela').upload(path, f, { contentType: f.type, upsert: false })
  if (error) return 'No se pudo subir el archivo. Intenta de nuevo.'
  const { error: e2 } = await supabase.from('escuela_materiales').insert({ grupo_id: grupoId, curso_id: cursoId, titulo, storage_path: path, created_by: autorId })
  if (e2) {
    await supabase.storage.from('escuela').remove([path]) // no deja archivos huérfanos
    return 'No se pudo guardar el material. Intenta de nuevo.'
  }
  return null
}

export async function borrarMaterial(m: Material): Promise<boolean> {
  const { error } = await supabase.from('escuela_materiales').delete().eq('id', m.id)
  if (error) return false
  if (m.storage_path) await supabase.storage.from('escuela').remove([m.storage_path])
  return true
}

// ---------------- Comentarios del maestro ----------------
export interface Comentario { id: string; clase_id: string; alumno_id: string; autor_id: string | null; texto: string; created_at: string }

export async function cargarComentarios(alumnoId: string, claseId?: string): Promise<Comentario[]> {
  let q = supabase.from('escuela_comentarios').select('id, clase_id, alumno_id, autor_id, texto, created_at').eq('alumno_id', alumnoId).order('created_at', { ascending: false }).limit(30)
  if (claseId) q = q.eq('clase_id', claseId)
  const { data } = await q
  return (data ?? []) as Comentario[]
}

export async function crearComentario(claseId: string, alumnoId: string, autorId: string, texto: string): Promise<boolean> {
  const { error } = await supabase.from('escuela_comentarios').insert({ clase_id: claseId, alumno_id: alumnoId, autor_id: autorId, texto })
  return !error
}

export async function borrarComentario(id: string): Promise<boolean> {
  const { error } = await supabase.from('escuela_comentarios').delete().eq('id', id)
  return !error
}

// ---------------- Niveles, hitos y paso al equipo ----------------
export interface Nivel { id: string; curso_id: string; orden: number; nombre: string; descripcion: string | null }
export interface Hito { id: string; alumno_id: string; nivel_id: string; fecha: string; nota: string | null }

export async function cargarNiveles(cursoIds: string[]): Promise<Nivel[]> {
  if (cursoIds.length === 0) return []
  const { data } = await supabase.from('escuela_niveles').select('id, curso_id, orden, nombre, descripcion').in('curso_id', cursoIds).order('orden')
  return (data ?? []) as Nivel[]
}

export async function guardarNivel(cursoId: string, id: string | null, orden: number, nombre: string): Promise<boolean> {
  const { error } = id
    ? await supabase.from('escuela_niveles').update({ nombre }).eq('id', id)
    : await supabase.from('escuela_niveles').insert({ curso_id: cursoId, orden, nombre })
  return !error
}

export async function borrarNivel(id: string): Promise<boolean> {
  const { error } = await supabase.from('escuela_niveles').delete().eq('id', id)
  return !error
}

export async function cargarHitos(alumnoId: string): Promise<Hito[]> {
  const { data } = await supabase.from('escuela_hitos').select('id, alumno_id, nivel_id, fecha, nota').eq('alumno_id', alumnoId)
  return (data ?? []) as Hito[]
}

export async function marcarHito(alumnoId: string, nivelId: string, por: string, nota: string | null): Promise<boolean> {
  const { error } = await supabase.from('escuela_hitos').upsert({ alumno_id: alumnoId, nivel_id: nivelId, por, nota }, { onConflict: 'alumno_id,nivel_id' })
  return !error
}

export async function quitarHito(id: string): Promise<boolean> {
  const { error } = await supabase.from('escuela_hitos').delete().eq('id', id)
  return !error
}

export async function recomendarAlumno(alumnoId: string, nota: string | null): Promise<boolean> {
  const { error } = await supabase.rpc('recomendar_alumno', { p_alumno: alumnoId, p_nota: nota ?? '' })
  return !error
}

export async function quitarRecomendacion(alumnoId: string): Promise<boolean> {
  const { error } = await supabase.rpc('quitar_recomendacion', { p_alumno: alumnoId })
  return !error
}

/** Alumnos que el maestro recomendó para el equipo y aún no han pasado. */
export async function cargarRecomendados(): Promise<{ miembro_id: string; nota: string | null; fecha: string }[]> {
  const { data } = await supabase.from('escuela_alumnos').select('miembro_id, listo_equipo_nota, listo_equipo_at').not('listo_equipo_at', 'is', null).order('listo_equipo_at')
  return ((data ?? []) as { miembro_id: string; listo_equipo_nota: string | null; listo_equipo_at: string }[]).map((x) => ({ miembro_id: x.miembro_id, nota: x.listo_equipo_nota, fecha: x.listo_equipo_at }))
}

export type RolEquipo = 'musico' | 'voz' | 'sonido' | 'multimedia'

/** Un líder pasa al alumno al equipo: cambia su rol y los puestos que puede cubrir, y limpia la recomendación. */
export async function pasarAlEquipo(alumnoId: string, rol: RolEquipo, puestos: string[]): Promise<string | null> {
  const { error } = await supabase.from('miembros').update({ rol, puestos }).eq('id', alumnoId)
  if (error) return 'No se pudo pasar al equipo. Solo un líder puede hacerlo.'
  await supabase.rpc('quitar_recomendacion', { p_alumno: alumnoId })
  return null
}

export async function cargarPuestos(grupoId: string): Promise<string[]> {
  const { data } = await supabase.from('puestos').select('nombre').eq('grupo_id', grupoId).order('orden')
  return ((data ?? []) as { nombre: string }[]).map((x) => x.nombre)
}
