import { supabase } from '../../lib/supabase'
import type { Fase } from '../../lib/tipos'
import { FASES } from './fases'

export interface DatosCancion {
  titulo: string
  autor: string | null
  tono_original: string | null
  bpm: number | null
  minutos: number | null
  categoria: 'alabanza' | 'adoracion' | null
  letra_chordpro: string | null
  audio_ref_url: string | null
}

export async function sembrarPendientes(cancionId: string, fase: Fase) {
  const info = FASES.find((f) => f.id === fase)!
  const { data } = await supabase.from('cancion_pendientes')
    .insert(info.pendientes.map((texto, orden) => ({ cancion_id: cancionId, fase, texto, orden })))
    .select('id, cancion_id, fase, texto, hecho, orden')
  return data ?? []
}

/** Crea la canción en fase Nueva con su lista de pendientes. Devuelve el id o null si falla. */
export async function crearCancion(grupoId: string, userId: string, d: DatosCancion): Promise<string | null> {
  const { data, error } = await supabase.from('canciones').insert({ ...d, grupo_id: grupoId, created_by: userId }).select('id').single()
  if (error || !data) return null
  await sembrarPendientes(data.id as string, 'nueva')
  return data.id as string
}

export async function guardarCancion(id: string, d: DatosCancion): Promise<boolean> {
  const { error } = await supabase.from('canciones').update(d).eq('id', id)
  return !error
}

export async function borrarCancion(id: string): Promise<boolean> {
  const { error } = await supabase.from('canciones').delete().eq('id', id)
  return !error
}

export interface ResultadoLote { creadas: number; error: string | null }

/**
 * Crea muchas canciones de una vez, todas en fase Nueva y con su lista de pendientes.
 * Va de 40 en 40: si algo falla a la mitad, las que ya se guardaron se quedan (se avisa cuántas)
 * y al reintentar se saltan solas porque ya existen.
 */
export async function crearCanciones(grupoId: string, userId: string, lista: DatosCancion[]): Promise<ResultadoLote> {
  let creadas = 0
  const pendientes = FASES[0]!.pendientes
  for (let i = 0; i < lista.length; i += 40) {
    const { data, error } = await supabase.from('canciones')
      .insert(lista.slice(i, i + 40).map((d) => ({ ...d, grupo_id: grupoId, created_by: userId })))
      .select('id')
    if (error || !data) return { creadas, error: 'No se pudieron guardar todas. Revisa tu conexión y vuelve a intentar: las ya guardadas se saltan solas.' }
    creadas += data.length
    // La lista de pendientes es un extra: si fallara, las canciones quedan creadas igual
    await supabase.from('cancion_pendientes').insert(
      data.flatMap((c) => pendientes.map((texto, orden) => ({ cancion_id: c.id as string, fase: 'nueva' as const, texto, orden }))),
    )
  }
  return { creadas, error: null }
}
