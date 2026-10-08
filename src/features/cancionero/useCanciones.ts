import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Fase } from '../../lib/tipos'
import { sembrarPendientes } from './api'
import { FASES, indiceFase } from './fases'

export interface Cancion {
  id: string
  titulo: string
  autor: string | null
  tono_original: string | null
  bpm: number | null
  categoria: 'alabanza' | 'adoracion' | null
  fase: Fase
  publica: boolean
  created_at: string
  updated_at: string
}
export interface Pendiente { id: string; cancion_id: string; fase: Fase; texto: string; hecho: boolean; orden: number }
export interface Dominio { cancion_id: string; miembro_id: string; ya_la_se: boolean }

interface Estado {
  cargando: boolean
  error: boolean
  canciones: Cancion[]
  pendientes: Pendiente[]
  dominio: Dominio[]
  ultima: Record<string, string>
}
const inicial: Estado = { cargando: true, error: false, canciones: [], pendientes: [], dominio: [], ultima: {} }

export function useCanciones(grupoId: string | undefined, miMiembroId: string | undefined) {
  const [e, setE] = useState<Estado>(inicial)

  const cargar = useCallback(async () => {
    if (!grupoId) return setE({ ...inicial, cargando: false })
    const [c, p, d, u] = await Promise.all([
      supabase.from('canciones').select('id, titulo, autor, tono_original, bpm, categoria, fase, publica, created_at, updated_at').eq('grupo_id', grupoId).order('titulo'),
      supabase.from('cancion_pendientes').select('id, cancion_id, fase, texto, hecho, orden').order('orden'),
      supabase.from('cancion_dominio').select('cancion_id, miembro_id, ya_la_se'),
      supabase.from('v_ultima_vez').select('cancion_id, ultima_fecha').eq('grupo_id', grupoId),
    ])
    if (c.error) return setE({ ...inicial, cargando: false, error: true })
    const canciones = (c.data ?? []) as Cancion[]
    const ids = new Set(canciones.map((x) => x.id))
    setE({
      cargando: false,
      error: false,
      canciones,
      // RLS ya limita a lo visible; el filtro evita mezclar grupos si el usuario está en más de uno
      pendientes: ((p.data ?? []) as Pendiente[]).filter((x) => ids.has(x.cancion_id)),
      dominio: ((d.data ?? []) as Dominio[]).filter((x) => ids.has(x.cancion_id)),
      ultima: Object.fromEntries(((u.data ?? []) as { cancion_id: string; ultima_fecha: string }[]).map((x) => [x.cancion_id, x.ultima_fecha])),
    })
  }, [grupoId])

  useEffect(() => { void cargar() }, [cargar])

  const togglePendiente = useCallback(async (id: string) => {
    const actual = e.pendientes.find((p) => p.id === id)
    if (!actual) return false
    const hecho = !actual.hecho
    setE((x) => ({ ...x, pendientes: x.pendientes.map((p) => (p.id === id ? { ...p, hecho } : p)) }))
    const { error } = await supabase.from('cancion_pendientes').update({ hecho }).eq('id', id)
    if (error) setE((x) => ({ ...x, pendientes: x.pendientes.map((p) => (p.id === id ? { ...p, hecho: !hecho } : p)) }))
    return !error
  }, [e.pendientes])

  const togglePublica = useCallback(async (id: string) => {
    const actual = e.canciones.find((c) => c.id === id)
    if (!actual) return null
    const publica = !actual.publica
    setE((x) => ({ ...x, canciones: x.canciones.map((c) => (c.id === id ? { ...c, publica } : c)) }))
    const { error } = await supabase.from('canciones').update({ publica }).eq('id', id)
    if (error) {
      setE((x) => ({ ...x, canciones: x.canciones.map((c) => (c.id === id ? { ...c, publica: !publica } : c)) }))
      return null
    }
    return publica
  }, [e.canciones])

  /** Pasa a la siguiente fase. Al llegar a Lista el servidor la vuelve pública por defecto. */
  const avanzar = useCallback(async (id: string) => {
    const actual = e.canciones.find((c) => c.id === id)
    if (!actual) return null
    const i = indiceFase(actual.fase)
    if (i >= FASES.length - 1) return null
    const sig = FASES[i + 1]!.id
    const { data, error } = await supabase.from('canciones').update({ fase: sig }).eq('id', id).select('id, fase, publica, updated_at').single()
    if (error || !data) return null
    const nuevos = e.pendientes.some((p) => p.cancion_id === id && p.fase === sig) ? [] : await sembrarPendientes(id, sig)
    setE((x) => ({
      ...x,
      canciones: x.canciones.map((c) => (c.id === id ? { ...c, ...(data as Pick<Cancion, 'fase' | 'publica' | 'updated_at'>) } : c)),
      pendientes: [...x.pendientes, ...(nuevos as Pendiente[])],
    }))
    return sig
  }, [e.canciones, e.pendientes])

  const marcarYaSe = useCallback(async (cancionId: string, valor: boolean) => {
    if (!miMiembroId) return false
    const quitar = (x: Estado) => x.dominio.filter((d) => !(d.cancion_id === cancionId && d.miembro_id === miMiembroId))
    setE((x) => ({ ...x, dominio: [...quitar(x), { cancion_id: cancionId, miembro_id: miMiembroId, ya_la_se: valor }] }))
    const { error } = await supabase.from('cancion_dominio')
      .upsert({ cancion_id: cancionId, miembro_id: miMiembroId, ya_la_se: valor, updated_at: new Date().toISOString() })
    if (error) setE((x) => ({ ...x, dominio: [...quitar(x), { cancion_id: cancionId, miembro_id: miMiembroId, ya_la_se: !valor }] }))
    return !error
  }, [miMiembroId])

  return { ...e, recargar: cargar, togglePendiente, togglePublica, avanzar, marcarYaSe }
}
