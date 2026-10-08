import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Rol } from '../lib/tipos'

export interface Integrante { id: string; userId: string; nombre: string; rol: Rol; descripcion: string | null; puestos: string[] }

/** Integrantes activos del grupo, con nombre (miembros no tiene FK directa a perfiles, así que van dos consultas). */
export function useEquipo(grupoId: string | undefined) {
  const [equipo, setEquipo] = useState<Integrante[]>([])
  useEffect(() => {
    if (!grupoId) return
    let vivo = true
    ;(async () => {
      const { data: ms } = await supabase.from('miembros').select('id, user_id, rol, descripcion, puestos').eq('grupo_id', grupoId).eq('activo', true)
      const ids = (ms ?? []).map((m) => m.user_id as string)
      const { data: ps } = ids.length ? await supabase.from('perfiles').select('id, nombre').in('id', ids) : { data: [] }
      const nombre = new Map((ps ?? []).map((p) => [p.id as string, p.nombre as string]))
      if (vivo) setEquipo((ms ?? []).map((m) => ({ id: m.id as string, userId: m.user_id as string, nombre: nombre.get(m.user_id as string) ?? '—', rol: m.rol as Rol, descripcion: m.descripcion as string | null, puestos: (m.puestos as string[] | null) ?? [] })))
    })()
    return () => { vivo = false }
  }, [grupoId])
  return equipo
}
