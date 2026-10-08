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
