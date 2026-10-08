import { supabase } from '../../lib/supabase'

export type ColorCurso = 'verde' | 'lila' | 'rosa' | 'ambar' | 'azul'
export const COLORES: ColorCurso[] = ['verde', 'lila', 'rosa', 'ambar', 'azul']
export const estiloColor = (c: ColorCurso) => ({ background: `var(--c-${c}-bg)`, color: `var(--c-${c}-fg)` })

export interface Curso { id: string; nombre: string; descripcion: string | null; color: ColorCurso; orden: number; activo: boolean }
export interface Clase { id: string; curso_id: string; nombre: string; tipo: 'grupal' | 'individual'; maestro_id: string | null; horario: string | null; lugar: string | null; activo: boolean }
export interface Practica { id: string; clase_id: string; alumno_id: string | null; semana: string; titulo: string; detalle: string | null; minutos_meta: number | null; enlace: string | null }
export interface Registro { id: string; practica_id: string; alumno_id: string; fecha: string; minutos: number; nota: string | null }
export interface Sesion { id: string; clase_id: string; fecha: string; tema: string | null }
export type EstadoAsistencia = 'presente' | 'ausente' | 'justificado'
export interface Asistencia { sesion_id: string; alumno_id: string; estado: EstadoAsistencia }
export interface PerfilAlumno { miembro_id: string; nacimiento: string | null; objetivo: string | null }

const COLS_CLASE = 'id, curso_id, nombre, tipo, maestro_id, horario, lugar, activo'
const COLS_PRACTICA = 'id, clase_id, alumno_id, semana, titulo, detalle, minutos_meta, enlace'

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
