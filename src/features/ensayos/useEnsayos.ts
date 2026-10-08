import { useCallback, useEffect, useMemo, useState } from 'react'
import { avisarPush } from '../../lib/push'
import { supabase } from '../../lib/supabase'

export interface Ensayo { id: string; fecha: string; lugar: string | null; servicio_id: string | null }
export interface DatosEnsayo { fecha: string; lugar: string | null; servicio_id: string | null }
export interface CancionEnsayo {
  cancion_id: string
  foco: string | null
  orden: number
  // de la canción (solo quien ve el cancionero)
  titulo: string
  autor: string | null
  tono: string | null
  bpm: number | null
  categoria: string | null
  audio: string | null
}
export interface Nota { id: string; miembro_id: string; texto: string; created_at: string }
export interface CancionBase { id: string; titulo: string; autor: string | null }
export interface ServicioCorto { id: string; fecha: string; tipo: string }
export interface Anterior { fecha: string; fueron: number; total: number }

// Un ensayo sigue siendo "el próximo" unas horas después de empezar
const GRACIA_MS = 3 * 3600 * 1000

export function useEnsayos(grupoId: string | undefined, miMiembroId: string | undefined, verCancionero: boolean) {
  const [proximos, setProximos] = useState<Ensayo[]>([])
  const [anterior, setAnterior] = useState<Anterior | null>(null)
  const [servicios, setServicios] = useState<ServicioCorto[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(false)
  const [seleccion, setSeleccion] = useState<string | null>(null)

  const [asistencia, setAsistencia] = useState<Record<string, boolean | null>>({})
  const [canciones, setCanciones] = useState<CancionEnsayo[]>([])
  const [repaso, setRepaso] = useState<Set<string>>(new Set())
  const [notas, setNotas] = useState<Nota[]>([])
  const [catalogo, setCatalogo] = useState<CancionBase[]>([])

  const actual = useMemo(() => proximos.find((e) => e.id === seleccion) ?? null, [proximos, seleccion])

  const cargarEnsayos = useCallback(async (elegir?: string) => {
    if (!grupoId) return setCargando(false)
    const limite = new Date(Date.now() - GRACIA_MS).toISOString()
    const [prox, prev, srv] = await Promise.all([
      supabase.from('ensayos').select('id, fecha, lugar, servicio_id').eq('grupo_id', grupoId).gte('fecha', limite).order('fecha').limit(10),
      supabase.from('ensayos').select('id, fecha').eq('grupo_id', grupoId).lt('fecha', limite).order('fecha', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('servicios').select('id, fecha, tipo').eq('grupo_id', grupoId).gte('fecha', new Date(Date.now() - 24 * 3600 * 1000).toISOString()).order('fecha').limit(10),
    ])
    if (prox.error) { setError(true); setCargando(false); return }
    const lista = (prox.data ?? []) as Ensayo[]
    setProximos(lista)
    setServicios((srv.data ?? []) as ServicioCorto[])
    setSeleccion((previa) => (elegir && lista.some((e) => e.id === elegir) ? elegir : previa && lista.some((e) => e.id === previa) ? previa : lista[0]?.id ?? null))

    if (prev.data) {
      const { data: as } = await supabase.from('ensayo_asistencia').select('va').eq('ensayo_id', prev.data.id)
      const filas = (as ?? []) as { va: boolean | null }[]
      setAnterior({ fecha: prev.data.fecha as string, fueron: filas.filter((f) => f.va === true).length, total: filas.length })
    } else setAnterior(null)
    setError(false)
    setCargando(false)
  }, [grupoId])

  useEffect(() => { void cargarEnsayos() }, [cargarEnsayos])

  const cargarDetalle = useCallback(async () => {
    if (!actual) { setAsistencia({}); setCanciones([]); setRepaso(new Set()); setNotas([]); return }
    const [as, ec, rp, nt] = await Promise.all([
      supabase.from('ensayo_asistencia').select('miembro_id, va').eq('ensayo_id', actual.id),
      supabase.from('ensayo_canciones').select('cancion_id, foco, orden').eq('ensayo_id', actual.id).order('orden'),
      supabase.from('ensayo_repaso').select('cancion_id').eq('ensayo_id', actual.id).eq('miembro_id', miMiembroId ?? ''),
      supabase.from('ensayo_notas').select('id, miembro_id, texto, created_at').eq('ensayo_id', actual.id).order('created_at'),
    ])
    setAsistencia(Object.fromEntries(((as.data ?? []) as { miembro_id: string; va: boolean | null }[]).map((a) => [a.miembro_id, a.va])))
    setRepaso(new Set(((rp.data ?? []) as { cancion_id: string }[]).map((r) => r.cancion_id)))
    setNotas((nt.data ?? []) as Nota[])

    const filas = (ec.data ?? []) as { cancion_id: string; foco: string | null; orden: number }[]
    // Sonido y multimedia no ven el cancionero: para ellos la lista de canciones no se muestra
    if (!verCancionero || filas.length === 0) return setCanciones([])
    const { data: cs } = await supabase.from('canciones').select('id, titulo, autor, tono_original, bpm, categoria, audio_ref_url').in('id', filas.map((f) => f.cancion_id))
    const info = new Map(((cs ?? []) as { id: string; titulo: string; autor: string | null; tono_original: string | null; bpm: number | null; categoria: string | null; audio_ref_url: string | null }[]).map((c) => [c.id, c]))
    setCanciones(filas.flatMap((f) => {
      const c = info.get(f.cancion_id)
      return c ? [{ ...f, titulo: c.titulo, autor: c.autor, tono: c.tono_original, bpm: c.bpm, categoria: c.categoria, audio: c.audio_ref_url }] : []
    }))
  }, [actual, miMiembroId, verCancionero])

  useEffect(() => { void cargarDetalle() }, [cargarDetalle])

  const cargarCatalogo = useCallback(async () => {
    if (!grupoId) return
    const { data } = await supabase.from('canciones').select('id, titulo, autor').eq('grupo_id', grupoId).order('titulo')
    setCatalogo((data ?? []) as CancionBase[])
  }, [grupoId])

  // ---------- Yo ----------
  const responder = useCallback(async (va: boolean | null) => {
    if (!actual || !miMiembroId) return false
    const previo = asistencia
    setAsistencia((a) => ({ ...a, [miMiembroId]: va }))
    const { error } = await supabase.from('ensayo_asistencia').upsert({ ensayo_id: actual.id, miembro_id: miMiembroId, va }, { onConflict: 'ensayo_id,miembro_id' })
    if (error) setAsistencia(previo)
    return !error
  }, [actual, miMiembroId, asistencia])

  const alternarRepaso = useCallback(async (cancionId: string) => {
    if (!actual || !miMiembroId) return false
    const tenia = repaso.has(cancionId)
    const poner = (v: boolean) => setRepaso((r) => { const n = new Set(r); if (v) n.add(cancionId); else n.delete(cancionId); return n })
    poner(!tenia)
    const { error } = tenia
      ? await supabase.from('ensayo_repaso').delete().eq('ensayo_id', actual.id).eq('cancion_id', cancionId).eq('miembro_id', miMiembroId)
      : await supabase.from('ensayo_repaso').insert({ ensayo_id: actual.id, cancion_id: cancionId, miembro_id: miMiembroId })
    if (error) poner(tenia)
    return !error
  }, [actual, miMiembroId, repaso])

  const agregarNota = useCallback(async (texto: string) => {
    if (!actual || !miMiembroId) return false
    const { data, error } = await supabase.from('ensayo_notas').insert({ ensayo_id: actual.id, miembro_id: miMiembroId, texto }).select('id, miembro_id, texto, created_at').single()
    if (!error && data) setNotas((n) => [...n, data as Nota])
    return !error
  }, [actual, miMiembroId])

  const borrarNota = useCallback(async (id: string) => {
    const { error } = await supabase.from('ensayo_notas').delete().eq('id', id)
    if (!error) setNotas((n) => n.filter((x) => x.id !== id))
    return !error
  }, [])

  // ---------- Líder ----------
  const crearEnsayo = useCallback(async (d: DatosEnsayo) => {
    if (!grupoId) return false
    const { data, error } = await supabase.from('ensayos').insert({ ...d, grupo_id: grupoId }).select('id').single()
    if (error || !data) return false
    avisarPush('ensayo', data.id as string)
    await cargarEnsayos(data.id as string)
    return true
  }, [grupoId, cargarEnsayos])

  const actualizarEnsayo = useCallback(async (id: string, d: DatosEnsayo) => {
    const { error } = await supabase.from('ensayos').update(d).eq('id', id)
    if (!error) await cargarEnsayos(id)
    return !error
  }, [cargarEnsayos])

  const borrarEnsayo = useCallback(async (id: string) => {
    const { error } = await supabase.from('ensayos').delete().eq('id', id)
    if (!error) { setSeleccion(null); await cargarEnsayos() }
    return !error
  }, [cargarEnsayos])

  const guardarCancion = useCallback(async (cancionId: string, foco: string | null) => {
    if (!actual) return false
    const existe = canciones.some((c) => c.cancion_id === cancionId)
    const orden = existe ? canciones.find((c) => c.cancion_id === cancionId)!.orden : (canciones.reduce((m, c) => Math.max(m, c.orden), 0) + 1)
    const { error } = await supabase.from('ensayo_canciones').upsert({ ensayo_id: actual.id, cancion_id: cancionId, foco, orden }, { onConflict: 'ensayo_id,cancion_id' })
    if (!error) await cargarDetalle()
    return !error
  }, [actual, canciones, cargarDetalle])

  const quitarCancion = useCallback(async (cancionId: string) => {
    if (!actual) return false
    const { error } = await supabase.from('ensayo_canciones').delete().eq('ensayo_id', actual.id).eq('cancion_id', cancionId)
    if (!error) await cargarDetalle()
    return !error
  }, [actual, cargarDetalle])

  return { proximos, anterior, servicios, cargando, error, seleccion, setSeleccion, actual, asistencia, canciones, repaso, notas, catalogo, cargarCatalogo, responder, alternarRepaso, agregarNota, borrarNota, crearEnsayo, actualizarEnsayo, borrarEnsayo, guardarCancion, quitarCancion }
}
