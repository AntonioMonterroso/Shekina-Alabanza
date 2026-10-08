import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Rol } from '../../lib/tipos'

export interface Integrante { id: string; userId: string; usuario: string; nombre: string; rol: Rol; descripcion: string | null; puestos: string[] }
export type RolAsignable = Exclude<Rol, 'propietario'>

/** Mensaje de error de una Edge Function (el cuerpo trae { error }). */
async function mensajeDe(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response } | null)?.context
  if (ctx && typeof ctx.json === 'function') {
    try { const b = await ctx.json() as { error?: string }; if (b.error) return b.error } catch { /* cuerpo vacío */ }
  }
  return 'No se pudo completar. Intenta de nuevo.'
}

export function useEquipoAdmin(grupoId: string | undefined) {
  const [equipo, setEquipo] = useState<Integrante[]>([])
  const [puestos, setPuestos] = useState<string[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(false)

  const cargar = useCallback(async () => {
    if (!grupoId) return setCargando(false)
    const [ms, pu] = await Promise.all([
      supabase.from('miembros').select('id, user_id, rol, descripcion, puestos').eq('grupo_id', grupoId).eq('activo', true),
      supabase.from('puestos').select('nombre').eq('grupo_id', grupoId).order('orden'),
    ])
    if (ms.error) { setError(true); setCargando(false); return }
    const ids = (ms.data ?? []).map((m) => m.user_id as string)
    const { data: ps } = ids.length ? await supabase.from('perfiles').select('id, nombre, usuario').in('id', ids) : { data: [] }
    const perfil = new Map((ps ?? []).map((p) => [p.id as string, p as { id: string; nombre: string; usuario: string }]))
    const orden: Rol[] = ['propietario', 'lider', 'musico', 'voz', 'sonido', 'multimedia', 'alumno']
    setEquipo((ms.data ?? []).map((m) => ({
      id: m.id as string, userId: m.user_id as string, nombre: perfil.get(m.user_id as string)?.nombre ?? '—', usuario: perfil.get(m.user_id as string)?.usuario ?? '',
      rol: m.rol as Rol, descripcion: (m.descripcion as string | null) ?? null, puestos: (m.puestos as string[] | null) ?? [],
    })).sort((a, b) => orden.indexOf(a.rol) - orden.indexOf(b.rol) || a.nombre.localeCompare(b.nombre, 'es')))
    setPuestos((pu.data ?? []).map((p) => p.nombre as string))
    setError(false)
    setCargando(false)
  }, [grupoId])

  useEffect(() => { void cargar() }, [cargar])

  const guardar = useCallback(async (id: string, cambios: { rol?: RolAsignable; descripcion?: string | null; puestos?: string[] }): Promise<string | null> => {
    const { error } = await supabase.from('miembros').update(cambios).eq('id', id)
    if (error) return error.message.includes('líder') ? 'Solo el propietario nombra o cambia líderes.' : 'No se pudo guardar. Intenta de nuevo.'
    await cargar()
    return null
  }, [cargar])

  /** Quitar del grupo = marcar como inactivo (se conserva su historial de turnos y notas). */
  const quitar = useCallback(async (id: string): Promise<string | null> => {
    const { error } = await supabase.from('miembros').update({ activo: false }).eq('id', id)
    if (error) return 'No se pudo quitar. Intenta de nuevo.'
    await cargar()
    return null
  }, [cargar])

  const crear = useCallback(async (d: { usuario: string; nombre: string; password: string; rol: RolAsignable; descripcion: string }): Promise<string | null> => {
    if (!grupoId) return 'Sin grupo'
    const { error } = await supabase.functions.invoke('admin-crear-usuario', { body: { ...d, grupo_id: grupoId } })
    if (error) return mensajeDe(error)
    await cargar()
    return null
  }, [grupoId, cargar])

  const cambiarPassword = useCallback(async (miembroId: string, password: string): Promise<string | null> => {
    const { error } = await supabase.functions.invoke('admin-cambiar-password', { body: { miembro_id: miembroId, password } })
    return error ? mensajeDe(error) : null
  }, [])

  return { equipo, puestos, cargando, error, guardar, quitar, crear, cambiarPassword }
}

/** Contraseña temporal legible: sin 0/O, 1/l/I que se confunden al dictarla. */
export function passwordTemporal(): string {
  const letras = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const b = crypto.getRandomValues(new Uint32Array(10))
  return Array.from(b, (n) => letras[n % letras.length]).join('')
}

/** "José Monterroso" → "jose.monterroso" (3 a 30 caracteres, minúsculas, sin acentos). */
export function sugerirUsuario(nombre: string): string {
  const base = nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().split(/\s+/).slice(0, 2).join('.').replace(/[^a-z0-9._-]/g, '')
  return base.slice(0, 30)
}
