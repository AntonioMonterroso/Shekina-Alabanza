import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { Membresia, Modo, Perfil, Tema } from '../lib/tipos'
import { Ctx, type AuthCtx } from './authContext'

const LS_GRUPO = 'alabanza.grupo'
const LS_TEMA = 'alabanza.tema'
const LS_MODO = 'alabanza.modo'

const guardado = (k: string) => {
  try { return localStorage.getItem(k) } catch { return null }
}
const guardar = (k: string, v: string) => {
  try { localStorage.setItem(k, v) } catch { /* modo privado */ }
}

const oscuroDelSistema = () => window.matchMedia('(prefers-color-scheme: dark)').matches

/** Pone el tema (color) y el modo (claro/oscuro) en <html>. "auto" sigue al sistema. */
function aplicarApariencia(tema: Tema, modo: Modo) {
  const oscuro = modo === 'oscuro' || (modo === 'auto' && oscuroDelSistema())
  const el = document.documentElement
  el.dataset.tema = tema
  el.dataset.modo = oscuro ? 'oscuro' : 'claro'
  guardar(LS_TEMA, tema)
  guardar(LS_MODO, modo)
  const bg = getComputedStyle(el).getPropertyValue('--bg').trim()
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg || '#f2f7ee')
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [cargandoSesion, setCargandoSesion] = useState(true)
  const [cargandoDatos, setCargandoDatos] = useState(false)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [membresias, setMembresias] = useState<Membresia[]>([])
  const [grupoId, setGrupoId] = useState<string | null>(guardado(LS_GRUPO))

  const [apariencia, setApariencia] = useState<{ tema: Tema; modo: Modo }>({
    tema: (guardado(LS_TEMA) as Tema) || 'salvia',
    modo: (guardado(LS_MODO) as Modo) || 'auto',
  })
  useEffect(() => {
    aplicarApariencia(apariencia.tema, apariencia.modo)
    if (apariencia.modo !== 'auto') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const alCambiar = () => aplicarApariencia(apariencia.tema, 'auto')
    mq.addEventListener('change', alCambiar)
    return () => mq.removeEventListener('change', alCambiar)
  }, [apariencia])

  useEffect(() => {
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
    if (perf) setApariencia({ tema: perf.tema, modo: perf.modo ?? 'auto' })
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
      setApariencia((a) => ({ ...a, tema: t }))
      if (uid) await supabase.from('perfiles').update({ tema: t }).eq('id', uid)
      setPerfil((p) => (p ? { ...p, tema: t } : p))
    },
    cambiarModo: async (m) => {
      setApariencia((a) => ({ ...a, modo: m }))
      if (uid) await supabase.from('perfiles').update({ modo: m }).eq('id', uid)
      setPerfil((p) => (p ? { ...p, modo: m } : p))
    },
    recargar: cargarDatos,
    salir: async () => { await supabase.auth.signOut() },
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
