import { useCallback, useEffect, useMemo, useState } from 'react'
import { diasDesde } from '../../lib/tiempo'
import { supabase } from '../../lib/supabase'

export interface Servicio {
  id: string
  fecha: string
  tipo: string
  dirige: string | null
  llegada: string | null
  publicado: boolean
  notas: string | null
}
export interface Item {
  id: string
  orden: number
  tipo: 'cancion' | 'parte'
  cancion_id: string | null
  momento: string | null
  dirige: string | null
  tono: string | null
  parte_titulo: string | null
  responsable: string | null
  minutos: number | null
  // de la canción (RPC canciones_del_servicio)
  titulo: string
  autor: string | null
  tonoMostrado: string | null
  minutosEfectivos: number
  /** días desde que se cantó (en un culto de los 14 días anteriores a este) */
  repetida: number | null
}
export interface CancionLista { id: string; titulo: string; autor: string | null; tono_original: string | null }
export type DatosServicio = Pick<Servicio, 'tipo' | 'dirige' | 'llegada' | 'notas'> & { fecha: string }
export type DatosItem = Partial<Pick<Item, 'momento' | 'dirige' | 'tono' | 'parte_titulo' | 'responsable' | 'minutos'>>

const MARGEN_REPETICION = 14

export function useServicios(grupoId: string | undefined) {
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(false)
  const [seleccion, setSeleccion] = useState<string | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [cargandoItems, setCargandoItems] = useState(false)
  const [catalogo, setCatalogo] = useState<CancionLista[]>([])
  const [ultimaVez, setUltimaVez] = useState<Record<string, string>>({})

  const actual = useMemo(() => servicios.find((s) => s.id === seleccion) ?? null, [servicios, seleccion])

  const cargarServicios = useCallback(async (elegir?: string) => {
    if (!grupoId) return setCargando(false)
    // Desde ayer en adelante: el culto del domingo sigue a la mano el lunes por la mañana
    const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
    const { data, error } = await supabase.from('servicios').select('id, fecha, tipo, dirige, llegada, publicado, notas')
      .eq('grupo_id', grupoId).gte('fecha', desde).order('fecha').limit(30)
    if (error) { setError(true); setCargando(false); return }
    const lista = (data ?? []) as Servicio[]
    setServicios(lista)
    setSeleccion((previa) => (elegir && lista.some((s) => s.id === elegir) ? elegir : previa && lista.some((s) => s.id === previa) ? previa : lista[0]?.id ?? null))
    setError(false)
    setCargando(false)
  }, [grupoId])

  useEffect(() => { void cargarServicios() }, [cargarServicios])

  const cargarItems = useCallback(async () => {
    if (!actual) return setItems([])
    setCargandoItems(true)
    const [it, canc] = await Promise.all([
      supabase.from('servicio_items').select('id, orden, tipo, cancion_id, momento, dirige, tono, parte_titulo, responsable, minutos').eq('servicio_id', actual.id).order('orden'),
      supabase.rpc('canciones_del_servicio', { p_servicio: actual.id }),
    ])
    const info = new Map(((canc.data ?? []) as { item_id: string; titulo: string; autor: string | null; tono: string | null; minutos: number | null }[]).map((c) => [c.item_id, c]))
    const base = (it.data ?? []) as Omit<Item, 'titulo' | 'autor' | 'tonoMostrado' | 'minutosEfectivos' | 'repetida'>[]

    // Aviso de repetición: canciones que se cantaron en los 14 días anteriores a ESTE servicio
    const ids = base.map((x) => x.cancion_id).filter(Boolean) as string[]
    const previa = new Map<string, number>()
    if (ids.length && grupoId) {
      const fin = new Date(actual.fecha)
      const ini = new Date(fin.getTime() - MARGEN_REPETICION * 86_400_000)
      const { data: ps } = await supabase.from('servicios').select('id, fecha').eq('grupo_id', grupoId).gte('fecha', ini.toISOString()).lt('fecha', fin.toISOString()).neq('id', actual.id)
      const pids = (ps ?? []).map((p) => p.id as string)
      if (pids.length) {
        const fechaDe = new Map((ps ?? []).map((p) => [p.id as string, p.fecha as string]))
        const { data: pi } = await supabase.from('servicio_items').select('servicio_id, cancion_id').in('servicio_id', pids).in('cancion_id', ids)
        for (const r of pi ?? []) {
          const d = Math.max(1, diasDesde(fechaDe.get(r.servicio_id as string)!, fin))
          const cid = r.cancion_id as string
          previa.set(cid, Math.min(previa.get(cid) ?? Infinity, d))
        }
      }
    }

    setItems(base.map((x) => {
      const c = info.get(x.id)
      return {
        ...x,
        titulo: x.tipo === 'cancion' ? c?.titulo ?? '—' : x.parte_titulo ?? '—',
        autor: c?.autor ?? null,
        tonoMostrado: x.tipo === 'cancion' ? c?.tono ?? null : null,
        minutosEfectivos: x.tipo === 'cancion' ? (x.minutos ?? c?.minutos ?? 4) : (x.minutos ?? 0),
        repetida: x.cancion_id ? previa.get(x.cancion_id) ?? null : null,
      }
    }))
    setCargandoItems(false)
  }, [actual, grupoId])

  useEffect(() => { void cargarItems() }, [cargarItems])

  /** Canciones en fase Lista (las únicas que se pueden agregar) y cuándo se cantaron por última vez. */
  const cargarCatalogo = useCallback(async () => {
    if (!grupoId) return
    const [c, u] = await Promise.all([
      supabase.from('canciones').select('id, titulo, autor, tono_original').eq('grupo_id', grupoId).eq('fase', 'lista').order('titulo'),
      supabase.from('v_ultima_vez').select('cancion_id, ultima_fecha').eq('grupo_id', grupoId),
    ])
    setCatalogo((c.data ?? []) as CancionLista[])
    setUltimaVez(Object.fromEntries(((u.data ?? []) as { cancion_id: string; ultima_fecha: string }[]).map((x) => [x.cancion_id, x.ultima_fecha])))
  }, [grupoId])

  // ---------- Servicio ----------
  const crearServicio = useCallback(async (d: DatosServicio) => {
    if (!grupoId) return null
    const { data, error } = await supabase.from('servicios').insert({ ...d, grupo_id: grupoId }).select('id').single()
    if (error || !data) return null
    await cargarServicios(data.id as string)
    return data.id as string
  }, [grupoId, cargarServicios])

  const actualizarServicio = useCallback(async (id: string, d: DatosServicio) => {
    const { error } = await supabase.from('servicios').update(d).eq('id', id)
    if (!error) await cargarServicios(id)
    return !error
  }, [cargarServicios])

  const borrarServicio = useCallback(async (id: string) => {
    const { error } = await supabase.from('servicios').delete().eq('id', id)
    if (!error) { setSeleccion(null); await cargarServicios() }
    return !error
  }, [cargarServicios])

  const togglePublicado = useCallback(async (id: string) => {
    const s = servicios.find((x) => x.id === id)
    if (!s) return null
    const publicado = !s.publicado
    setServicios((l) => l.map((x) => (x.id === id ? { ...x, publicado } : x)))
    const { error } = await supabase.from('servicios').update({ publicado }).eq('id', id)
    if (error) { setServicios((l) => l.map((x) => (x.id === id ? { ...x, publicado: !publicado } : x))); return null }
    return publicado
  }, [servicios])

  // ---------- Orden del culto ----------
  const siguienteOrden = () => items.reduce((m, i) => Math.max(m, i.orden), 0) + 1

  const agregarCancion = useCallback(async (cancionId: string) => {
    if (!actual) return false
    const { error } = await supabase.from('servicio_items').insert({ servicio_id: actual.id, orden: siguienteOrden(), tipo: 'cancion', cancion_id: cancionId, dirige: actual.dirige })
    if (!error) await cargarItems()
    return !error
  }, [actual, items, cargarItems])

  const agregarParte = useCallback(async (titulo: string, responsable: string | null, minutos: number | null) => {
    if (!actual) return false
    const { error } = await supabase.from('servicio_items').insert({ servicio_id: actual.id, orden: siguienteOrden(), tipo: 'parte', parte_titulo: titulo, responsable, minutos })
    if (!error) await cargarItems()
    return !error
  }, [actual, items, cargarItems])

  const editarItem = useCallback(async (id: string, patch: DatosItem) => {
    const { error } = await supabase.from('servicio_items').update(patch).eq('id', id)
    if (!error) await cargarItems()
    return !error
  }, [cargarItems])

  const quitarItem = useCallback(async (id: string) => {
    const previo = items
    setItems((l) => l.filter((x) => x.id !== id))
    const { error } = await supabase.from('servicio_items').delete().eq('id', id)
    if (error) setItems(previo)
    return !error
  }, [items])

  /** Intercambia el orden con el vecino (dir = -1 sube, +1 baja). */
  const mover = useCallback(async (id: string, dir: -1 | 1) => {
    const i = items.findIndex((x) => x.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= items.length) return false
    const a = items[i]!, b = items[j]!
    const previo = items
    const nuevo = items.slice()
    nuevo[i] = { ...b, orden: a.orden }
    nuevo[j] = { ...a, orden: b.orden }
    setItems(nuevo)
    const [r1, r2] = await Promise.all([
      supabase.from('servicio_items').update({ orden: b.orden }).eq('id', a.id),
      supabase.from('servicio_items').update({ orden: a.orden }).eq('id', b.id),
    ])
    if (r1.error || r2.error) { setItems(previo); await cargarItems(); return false }
    return true
  }, [items, cargarItems])

  return {
    servicios, cargando, error, seleccion, setSeleccion, actual, items, cargandoItems, catalogo, ultimaVez,
    cargarCatalogo, crearServicio, actualizarServicio, borrarServicio, togglePublicado,
    agregarCancion, agregarParte, editarItem, quitarItem, mover,
  }
}
