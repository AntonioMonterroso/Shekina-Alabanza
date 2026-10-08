import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { Membresia, Perfil, Rol, Tema } from '../lib/tipos'

interface AuthCtx {
  cargando: boolean
  session: Session | null
  perfil: Perfil | null
  membresias: Membresia[]
  membresia: Membresia | null // grupo actual
  rol: Rol | null
  esLider: boolean
  elegirGrupo: (grupoId: string) => void
  cambiarTema: (t: Tema) => Promise<void>
  recargar: () => Promise<void>
  salir: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)
const LS_GRUPO = 'alabanza.grupo'
const LS_TEMA = 'alabanza.tema'

const guardado = (k: string) => {
  try { return localStorage.getItem(k) } catch { return null }
}
const guardar = (k: string, v: string) => {
  try { localStorage.setItem(k, v) } catch { /* modo privado */ }
}

export function aplicarTema(t: Tema) {
  document.documentElement.dataset.tema = t
  guardar(LS_TEMA, t)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [cargandoSesion, setCargandoSesion] = useState(true)
  const [cargandoDatos, setCargandoDatos] = useState(false)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [membresias, setMembresias] = useState<Membresia[]>([])
  const [grupoId, setGrupoId] = useState<string | null>(guardado(LS_GRUPO))

  useEffect(() => {
    aplicarTema((guardado(LS_TEMA) as Tema) || 'salvia')
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setCargandoSesion(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const uid = session?.user.id ?? null

  const cargarDatos = useCallback(async () => {
    if (!uid) {
      setPerfil(null)
      setMembresias([])
      return
    }
    setCargandoDatos(true)
    const [p, m] = await Promise.all([
      supabase.from('perfiles').select('*').eq('id', uid).maybeSingle(),
      supabase.from('miembros').select('id, grupo_id, rol, descripcion, grupo:grupos(id, nombre, slug, activo)')
        .eq('user_id', uid).eq('activo', true),
    ])
    const perf = (p.data as Perfil | null) ?? null
    setPerfil(perf)
    setMembresias(((m.data ?? []) as unknown as Membresia[]).filter((x) => x.grupo))
    if (perf) aplicarTema(perf.tema)
    setCargandoDatos(false)
  }, [uid])

  useEffect(() => { void cargarDatos() }, [cargarDatos])

  const membresia = useMemo(
    () => membresias.find((m) => m.grupo_id === grupoId) ?? membresias[0] ?? null,
    [membresias, grupoId],
  )

  const value: AuthCtx = {
    cargando: cargandoSesion || (Boolean(uid) && cargandoDatos && !perfil),
    session,
    perfil,
    membresias,
    membresia,
    rol: membresia?.rol ?? null,
    esLider: membresia ? ['propietario', 'lider'].includes(membresia.rol) : false,
    elegirGrupo: (id) => { setGrupoId(id); guardar(LS_GRUPO, id) },
    cambiarTema: async (t) => {
      aplicarTema(t)
      if (uid) await supabase.from('perfiles').update({ tema: t }).eq('id', uid)
      setPerfil((p) => (p ? { ...p, tema: t } : p))
    },
    recargar: cargarDatos,
    salir: async () => { await supabase.auth.signOut() },
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth fuera de AuthProvider')
  return c
}
// Nombres del plan (paso 2): usePerfil / useGrupoActual / useRol
export const usePerfil = () => useAuth().perfil
export const useGrupoActual = () => useAuth().membresia?.grupo ?? null
export const useRol = () => useAuth().rol
