import { useCallback, useEffect, useState } from 'react'
import { fechaGT, hoyGT } from '../../lib/fechas'
import { supabase } from '../../lib/supabase'

export interface ServicioTurnos { id: string; fecha: string; tipo: string; llegada: string | null }
export interface Puesto { id: string; nombre: string; orden: number }
export type EstadoTurno = 'pendiente' | 'confirmado' | 'no_puede'
export interface Turno { id: string; servicio_id: string; puesto_id: string; miembro_id: string | null; estado: EstadoTurno }
export interface Indisponible { miembro_id: string; fecha: string }

interface Estado {
  cargando: boolean
  error: boolean
  servicios: ServicioTurnos[]
  puestos: Puesto[]
  turnos: Turno[]
  indis: Indisponible[]
}
const inicial: Estado = { cargando: true, error: false, servicios: [], puestos: [], turnos: [], indis: [] }

export function useTurnos(grupoId: string | undefined, miMiembroId: string | undefined) {
  const [e, setE] = useState<Estado>(inicial)

  const cargar = useCallback(async () => {
    if (!grupoId) return setE({ ...inicial, cargando: false })
    const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
    const [sv, pu, ind] = await Promise.all([
      supabase.from('servicios').select('id, fecha, tipo, llegada').eq('grupo_id', grupoId).gte('fecha', desde).order('fecha').limit(30),
      supabase.from('puestos').select('id, nombre, orden').eq('grupo_id', grupoId).order('orden'),
      // inner: solo integrantes de este grupo
      supabase.from('indisponibilidad').select('miembro_id, fecha, miembro:miembros!inner(grupo_id)').eq('miembro.grupo_id', grupoId).gte('fecha', hoyGT()),
    ])
    if (sv.error || pu.error) return setE({ ...inicial, cargando: false, error: true })
    const servicios = (sv.data ?? []) as ServicioTurnos[]
    const ids = servicios.map((s) => s.id)
    const tu = ids.length ? await supabase.from('turnos').select('id, servicio_id, puesto_id, miembro_id, estado').in('servicio_id', ids) : { data: [], error: null }
    if (tu.error) return setE({ ...inicial, cargando: false, error: true })
    setE({
      cargando: false,
      error: false,
      servicios,
      puestos: (pu.data ?? []) as Puesto[],
      turnos: (tu.data ?? []) as Turno[],
      indis: ((ind.data ?? []) as { miembro_id: string; fecha: string }[]).map((x) => ({ miembro_id: x.miembro_id, fecha: x.fecha })),
    })
  }, [grupoId])

  useEffect(() => { void cargar() }, [cargar])

  const parchear = (id: string, patch: Partial<Turno>) =>
    setE((x) => ({ ...x, turnos: x.turnos.map((t) => (t.id === id ? { ...t, ...patch } : t)) }))

  /** Confirmar / "no puedo" en un turno propio. */
  const responder = useCallback(async (turnoId: string, estado: EstadoTurno) => {
    const previo = e.turnos.find((t) => t.id === turnoId)
    if (!previo) return false
    parchear(turnoId, { estado })
    const { error } = await supabase.from('turnos').update({ estado }).eq('id', turnoId)
    if (error) parchear(turnoId, { estado: previo.estado })
    return !error
  }, [e.turnos])

  /** Reasignar (el servidor deja al nuevo en "pendiente"). null = dejar sin asignar. */
  const asignar = useCallback(async (turnoId: string, miembroId: string | null) => {
    const previo = e.turnos.find((t) => t.id === turnoId)
    if (!previo) return false
    parchear(turnoId, { miembro_id: miembroId, estado: 'pendiente' })
    const { error } = await supabase.from('turnos').update({ miembro_id: miembroId }).eq('id', turnoId)
    if (error) parchear(turnoId, { miembro_id: previo.miembro_id, estado: previo.estado })
    return !error
  }, [e.turnos])

  const agregarPuesto = useCallback(async (servicioId: string, puestoId: string): Promise<Turno | null> => {
    const { data, error } = await supabase.from('turnos').insert({ servicio_id: servicioId, puesto_id: puestoId }).select('id, servicio_id, puesto_id, miembro_id, estado').single()
    if (error || !data) return null
    setE((x) => ({ ...x, turnos: [...x.turnos, data as Turno] }))
    return data as Turno
  }, [])

  const quitarTurno = useCallback(async (turnoId: string) => {
    const previo = e.turnos
    setE((x) => ({ ...x, turnos: x.turnos.filter((t) => t.id !== turnoId) }))
    const { error } = await supabase.from('turnos').delete().eq('id', turnoId)
    if (error) setE((x) => ({ ...x, turnos: previo }))
    return !error
  }, [e.turnos])

  /** Reemplaza mis fechas no disponibles por el conjunto dado (YYYY-MM-DD). */
  const guardarIndisponibilidad = useCallback(async (fechas: string[]) => {
    if (!miMiembroId) return false
    const actuales = new Set(e.indis.filter((i) => i.miembro_id === miMiembroId).map((i) => i.fecha))
    const nuevas = new Set(fechas)
    const agregar = fechas.filter((f) => !actuales.has(f))
    const quitar = [...actuales].filter((f) => !nuevas.has(f))
    if (agregar.length) {
      const { error } = await supabase.from('indisponibilidad').upsert(agregar.map((fecha) => ({ miembro_id: miMiembroId, fecha })))
      if (error) return false
    }
    if (quitar.length) {
      const { error } = await supabase.from('indisponibilidad').delete().eq('miembro_id', miMiembroId).in('fecha', quitar)
      if (error) return false
    }
    setE((x) => ({ ...x, indis: [...x.indis.filter((i) => i.miembro_id !== miMiembroId), ...fechas.map((fecha) => ({ miembro_id: miMiembroId, fecha }))] }))
    return true
  }, [e.indis, miMiembroId])

  const fechasDe = (servicio: ServicioTurnos) => fechaGT(servicio.fecha)

  return { ...e, recargar: cargar, responder, asignar, agregarPuesto, quitarTurno, guardarIndisponibilidad, fechasDe }
}
