import { useCallback, useEffect, useState } from 'react'
import { finDeMes } from '../../lib/fechas'
import { avisarPush } from '../../lib/push'
import { supabase } from '../../lib/supabase'
import type { Rol } from '../../lib/tipos'

export interface IntegranteMini { id: string; nombre: string; rol: Rol }
export interface ServicioProximo { id: string; fecha: string; tipo: string; llegada: string | null }
export interface FilaOrden { n: number; titulo: string; detalle: string; tono: string | null }
export interface MiTurno { id: string; puesto: string; estado: 'pendiente' | 'confirmado' | 'no_puede' }

interface Datos {
  cargando: boolean
  error: boolean
  servicio: ServicioProximo | null
  orden: FilaOrden[]
  miTurno: MiTurno | null
  sinCubrir: number
  equipo: IntegranteMini[]
}

const vacio: Datos = { cargando: true, error: false, servicio: null, orden: [], miTurno: null, sinCubrir: 0, equipo: [] }

export function useInicio(grupoId: string | undefined, miMiembroId: string | undefined, esLider: boolean, verServicios: boolean) {
  const [d, setD] = useState<Datos>(vacio)

  const cargar = useCallback(async () => {
    if (!grupoId) return setD({ ...vacio, cargando: false })

    // Equipo del grupo (nombres de los perfiles: miembros no tiene FK directa a perfiles)
    const { data: ms } = await supabase.from('miembros').select('id, user_id, rol').eq('grupo_id', grupoId).eq('activo', true)
    const ids = (ms ?? []).map((m) => m.user_id as string)
    const { data: ps } = ids.length ? await supabase.from('perfiles').select('id, nombre').in('id', ids) : { data: [] }
    const nombre = new Map((ps ?? []).map((p) => [p.id as string, p.nombre as string]))
    const equipo: IntegranteMini[] = (ms ?? []).map((m) => ({ id: m.id as string, nombre: nombre.get(m.user_id as string) ?? '—', rol: m.rol as Rol }))
    const nombreDe = new Map(equipo.map((e) => [e.id, e.nombre]))

    if (!verServicios) return setD({ ...vacio, cargando: false, equipo })

    // Próximo servicio (o el de ayer, mientras no pase un día)
    const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
    const { data: srv, error } = await supabase.from('servicios').select('id, fecha, tipo, llegada')
      .eq('grupo_id', grupoId).gte('fecha', desde).order('fecha').limit(1).maybeSingle()
    if (error) return setD({ ...vacio, cargando: false, error: true, equipo })
    if (!srv) return setD({ ...vacio, cargando: false, equipo })
    const servicio = srv as ServicioProximo

    const [items, canc, turno, sin] = await Promise.all([
      supabase.from('servicio_items').select('id, orden, tipo, momento, parte_titulo, tono, dirige, responsable').eq('servicio_id', servicio.id).order('orden'),
      supabase.rpc('canciones_del_servicio', { p_servicio: servicio.id }),
      miMiembroId
        ? supabase.from('turnos').select('id, estado, puesto:puestos(nombre)').eq('servicio_id', servicio.id).eq('miembro_id', miMiembroId).maybeSingle()
        : Promise.resolve({ data: null }),
      esLider
        ? supabase.from('servicios').select('id').eq('grupo_id', grupoId).gte('fecha', new Date().toISOString()).lt('fecha', finDeMes())
            .then(async ({ data }) => {
              const sids = (data ?? []).map((s) => s.id as string)
              if (!sids.length) return 0
              const { count } = await supabase.from('turnos').select('id', { count: 'exact', head: true })
                .in('servicio_id', sids).or('miembro_id.is.null,estado.eq.no_puede')
              return count ?? 0
            })
        : Promise.resolve(0),
    ])

    const cancion = new Map(((canc.data ?? []) as { item_id: string; titulo: string; tono: string | null }[]).map((c) => [c.item_id, c]))
    const orden: FilaOrden[] = (items.data ?? []).map((it, i) => {
      const c = cancion.get(it.id as string)
      const dirige = it.dirige ? nombreDe.get(it.dirige as string) : (it.responsable as string | null)
      return {
        n: i + 1,
        titulo: (it.tipo === 'cancion' ? c?.titulo : (it.parte_titulo as string | null)) ?? '—',
        detalle: [it.momento as string | null, dirige ? `Dirige ${dirige}` : null].filter(Boolean).join(' · '),
        tono: (it.tono as string | null) ?? c?.tono ?? null,
      }
    })

    const t = turno.data as { id: string; estado: MiTurno['estado']; puesto: { nombre: string } | { nombre: string }[] | null } | null
    const puesto = Array.isArray(t?.puesto) ? t?.puesto[0]?.nombre : t?.puesto?.nombre
    setD({ cargando: false, error: false, servicio, orden, miTurno: t ? { id: t.id, estado: t.estado, puesto: puesto ?? 'Tu puesto' } : null, sinCubrir: sin, equipo })
  }, [grupoId, miMiembroId, esLider, verServicios])

  useEffect(() => { void cargar() }, [cargar])

  const responder = useCallback(async (estado: MiTurno['estado']) => {
    if (!d.miTurno) return false
    const { error } = await supabase.from('turnos').update({ estado }).eq('id', d.miTurno.id)
    if (error) return false
    if (estado === 'no_puede') avisarPush('no_puede', d.miTurno.id)
    setD((x) => (x.miTurno ? { ...x, miTurno: { ...x.miTurno, estado } } : x))
    return true
  }, [d.miTurno])

  return { ...d, responder }
}
