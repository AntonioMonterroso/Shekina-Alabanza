import { supabase } from '../../lib/supabase'
import { guardarTono, kvLeer, leerCanciones, leerServicios, leerTonos } from '../../lib/offline/almacen'

export interface CancionEscenario {
  /** punto del servicio (null si se eligió del cancionero) */
  itemId: string | null
  cancionId: string
  titulo: string
  autor: string | null
  tono: string | null
  bpm: number | null
  momento: string | null
  letra: string
  /** el tono que este integrante dejó guardado para la canción */
  miTono: string | null
}

export interface Escenario {
  /** cuándo se bajó la copia que se está usando (null si nunca) */
  guardado: string | null
  servicio: { id: string; fecha: string; tipo: string } | null
  /** canciones del próximo servicio, en orden */
  canciones: CancionEscenario[]
  /** todo el cancionero bajado, por si se quiere cantar algo que no está en el servicio */
  catalogo: CancionEscenario[]
}

/**
 * Arma el modo escenario desde la copia guardada en el dispositivo (la sincronización la mantiene al día).
 * Así abre al instante y funciona igual con o sin internet.
 */
export async function cargarEscenario(grupoId: string, miMiembroId: string | undefined): Promise<Escenario> {
  const [canciones, servicios, tonos, guardado] = await Promise.all([
    leerCanciones(grupoId), leerServicios(grupoId), leerTonos(grupoId), kvLeer<string>(`ultimaSync:${grupoId}`),
  ])
  const mio = new Map(tonos.filter((t) => !miMiembroId || t.miembro_id === miMiembroId).map((t) => [t.cancion_id, t.tono]))
  const porId = new Map(canciones.map((c) => [c.id, c]))

  const aEscena = (c: (typeof canciones)[number], extra?: { itemId: string; tono: string | null; momento: string | null }): CancionEscenario => ({
    itemId: extra?.itemId ?? null, cancionId: c.id, titulo: c.titulo, autor: c.autor,
    tono: extra?.tono ?? c.tono_original, bpm: c.bpm, momento: extra?.momento ?? null, letra: c.letra_chordpro ?? '', miTono: mio.get(c.id) ?? null,
  })

  // El próximo servicio: desde ayer (el domingo sigue a la mano el lunes por la mañana)
  const desde = Date.now() - 24 * 3600 * 1000
  const proximo = servicios.find((s) => new Date(s.fecha).getTime() >= desde) ?? null
  const delServicio = (proximo?.items ?? [])
    .filter((i) => i.tipo === 'cancion' && i.cancion_id)
    .sort((a, b) => a.orden - b.orden)
    .flatMap((i) => {
      const c = porId.get(i.cancion_id!)
      return c ? [aEscena(c, { itemId: i.id, tono: i.tono, momento: i.momento })] : []
    })

  return {
    guardado: guardado ?? null,
    servicio: proximo ? { id: proximo.id, fecha: proximo.fecha, tipo: proximo.tipo } : null,
    canciones: delServicio,
    catalogo: canciones.map((c) => aEscena(c)).sort((a, b) => a.titulo.localeCompare(b.titulo, 'es')),
  }
}

/**
 * Guarda mi tono para una canción. Primero en el dispositivo (así se recuerda aunque no haya internet)
 * y luego en la nube; si falla, queda pendiente y la sincronización lo sube después.
 */
export async function guardarMiTono(grupoId: string, cancionId: string, miMiembroId: string, tono: string): Promise<void> {
  await guardarTono({ cancion_id: cancionId, miembro_id: miMiembroId, grupo_id: grupoId, tono, pendiente: true }).catch(() => {})
  if (!navigator.onLine) return
  const { error } = await supabase.from('cancion_tonos').upsert({ cancion_id: cancionId, miembro_id: miMiembroId, tono }, { onConflict: 'cancion_id,miembro_id' })
  if (!error) await guardarTono({ cancion_id: cancionId, miembro_id: miMiembroId, grupo_id: grupoId, tono, pendiente: false }).catch(() => {})
}
