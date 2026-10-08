import { useCallback, useEffect, useRef, useState } from 'react'
import { diapositivasDe, type Diapositiva } from '../../lib/diapositivas'
import { supabase } from '../../lib/supabase'

export type ModoPantalla = 'letra' | 'negro' | 'logo'
export interface EstadoProyeccion { servicio_id: string | null; item_id: string | null; diapositiva: number; modo: ModoPantalla }
export interface ServicioProy { id: string; fecha: string; tipo: string }
export interface TemaProy { itemId: string; cancionId: string; titulo: string; autor: string | null; momento: string | null; letra: string; slides: Diapositiva[] }

export const ESTADO_INICIAL: EstadoProyeccion = { servicio_id: null, item_id: null, diapositiva: 0, modo: 'negro' }

/** Próximo servicio (o el de ayer, mientras no pase un día), igual que Inicio y Servicios. */
export async function proximoServicio(grupoId: string): Promise<ServicioProy | null> {
  const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const { data, error } = await supabase.from('servicios').select('id, fecha, tipo').eq('grupo_id', grupoId).gte('fecha', desde).order('fecha').limit(1).maybeSingle()
  if (error) throw error
  return (data as ServicioProy | null) ?? null
}

/** Canciones del servicio con su letra sin acordes (RPC: multimedia no lee la tabla de canciones) y las diapositivas. */
export async function cargarTemas(servicioId: string): Promise<TemaProy[]> {
  const { data, error } = await supabase.rpc('canciones_del_servicio', { p_servicio: servicioId })
  if (error) throw error
  const filas = (data ?? []) as { item_id: string; orden: number; cancion_id: string; titulo: string; autor: string | null; momento: string | null }[]
  return Promise.all(filas.sort((a, b) => a.orden - b.orden).map(async (f) => {
    const { data: letra } = await supabase.rpc('letra_proyeccion', { p_cancion: f.cancion_id })
    const texto = (letra as string | null) ?? ''
    const slides = diapositivasDe(texto)
    return { itemId: f.item_id, cancionId: f.cancion_id, titulo: f.titulo, autor: f.autor, momento: f.momento, letra: texto, slides: slides.length ? slides : [{ etiqueta: null, lineas: [f.titulo] }] }
  }))
}

/** Posición lineal (canción, diapositiva) → índice en la lista de todas las diapositivas. */
export const aplanar = (temas: TemaProy[]) => temas.flatMap((t, ti) => t.slides.map((_, si) => ({ ti, si })))

/** Estado compartido de la pantalla: se lee, se escucha en vivo (Realtime, con sondeo de respaldo) y se actualiza. */
export function useEstadoProyeccion(grupoId: string | undefined, userId: string | undefined) {
  const [estado, setEstado] = useState<EstadoProyeccion>(ESTADO_INICIAL)
  const [listo, setListo] = useState(false)
  const [enVivo, setEnVivo] = useState(false)
  const ultimo = useRef(ESTADO_INICIAL)
  ultimo.current = estado

  const leer = useCallback(async () => {
    if (!grupoId) return
    const { data } = await supabase.from('proyeccion_estado').select('servicio_id, item_id, diapositiva, modo').eq('grupo_id', grupoId).maybeSingle()
    if (data) setEstado(data as EstadoProyeccion)
    setListo(true)
  }, [grupoId])

  useEffect(() => {
    if (!grupoId) return
    void leer()
    const canal = supabase.channel(`proyeccion-${grupoId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'proyeccion_estado', filter: `grupo_id=eq.${grupoId}` }, (p) => {
        const n = p.new as Partial<EstadoProyeccion> & { grupo_id?: string }
        if (n && n.grupo_id) setEstado({ servicio_id: n.servicio_id ?? null, item_id: n.item_id ?? null, diapositiva: n.diapositiva ?? 0, modo: (n.modo as ModoPantalla) ?? 'negro' })
      })
      .subscribe((s) => setEnVivo(s === 'SUBSCRIBED'))
    // Respaldo si se cae el socket (wifi de la iglesia): se vuelve a leer cada 10 s
    const t = setInterval(() => { void leer() }, 10_000)
    return () => { clearInterval(t); void supabase.removeChannel(canal) }
  }, [grupoId, leer])

  const actualizar = useCallback(async (cambios: Partial<EstadoProyeccion>): Promise<boolean> => {
    if (!grupoId) return false
    const nuevo = { ...ultimo.current, ...cambios }
    const previo = ultimo.current
    setEstado(nuevo)
    const { error } = await supabase.from('proyeccion_estado').upsert({ grupo_id: grupoId, ...nuevo, updated_by: userId ?? null }, { onConflict: 'grupo_id' })
    if (error) { setEstado(previo); return false }
    return true
  }, [grupoId, userId])

  return { estado, listo, enVivo, actualizar }
}
