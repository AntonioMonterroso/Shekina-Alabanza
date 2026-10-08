import { supabase } from '../../lib/supabase'

export interface CancionEscenario {
  itemId: string
  cancionId: string
  titulo: string
  autor: string | null
  tono: string | null
  bpm: number | null
  momento: string | null
  letra: string
}
export interface Escenario {
  /** cuándo se bajó esta copia */
  guardado: string
  servicio: { id: string; fecha: string; tipo: string }
  canciones: CancionEscenario[]
}

const clave = (grupoId: string) => `shekina.escenario.${grupoId}`

export function leerCopia(grupoId: string): Escenario | null {
  try {
    const crudo = localStorage.getItem(clave(grupoId))
    return crudo ? (JSON.parse(crudo) as Escenario) : null
  } catch { return null }
}

function guardarCopia(grupoId: string, e: Escenario) {
  try { localStorage.setItem(clave(grupoId), JSON.stringify(e)) } catch { /* sin espacio o modo privado */ }
}

/**
 * Baja el próximo servicio con la letra de cada canción y deja una copia en el dispositivo para
 * usarla sin conexión. Devuelve null si no hay servicio próximo; lanza si falla la red.
 */
export async function cargarEscenario(grupoId: string): Promise<Escenario | null> {
  // Desde ayer: el culto del domingo sigue a la mano el lunes por la mañana (igual que Inicio y Servicios)
  const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const { data: srv, error } = await supabase.from('servicios').select('id, fecha, tipo').eq('grupo_id', grupoId).gte('fecha', desde).order('fecha').limit(1).maybeSingle()
  if (error) throw error
  if (!srv) return null

  const { data: items, error: e2 } = await supabase.from('servicio_items').select('id, orden, tono, momento, cancion_id').eq('servicio_id', srv.id).eq('tipo', 'cancion').order('orden')
  if (e2) throw e2
  const ids = [...new Set((items ?? []).map((i) => i.cancion_id as string).filter(Boolean))]
  const { data: cs, error: e3 } = ids.length
    ? await supabase.from('canciones').select('id, titulo, autor, tono_original, bpm, letra_chordpro').in('id', ids)
    : { data: [], error: null }
  if (e3) throw e3
  const porId = new Map((cs ?? []).map((c) => [c.id as string, c]))

  const canciones: CancionEscenario[] = (items ?? []).flatMap((i) => {
    const c = porId.get(i.cancion_id as string)
    if (!c) return []
    return [{
      itemId: i.id as string, cancionId: c.id as string, titulo: c.titulo as string, autor: (c.autor as string | null) ?? null,
      tono: ((i.tono as string | null) ?? (c.tono_original as string | null)) ?? null, bpm: (c.bpm as number | null) ?? null,
      momento: (i.momento as string | null) ?? null, letra: (c.letra_chordpro as string | null) ?? '',
    }]
  })
  const e: Escenario = { guardado: new Date().toISOString(), servicio: { id: srv.id as string, fecha: srv.fecha as string, tipo: srv.tipo as string }, canciones }
  guardarCopia(grupoId, e)
  return e
}
