import type { Session } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'
import type { Membresia, Modo, Perfil, Rol, Tema } from '../lib/tipos'

// El contexto y los hooks viven aparte del componente AuthProvider: así Vite puede recargar en caliente
// el proveedor sin crear un contexto nuevo (eso causaba pantallas en blanco al editar en desarrollo).
export interface AuthCtx {
  cargando: boolean
  session: Session | null
  perfil: Perfil | null
  membresias: Membresia[]
  membresia: Membresia | null // grupo actual
  rol: Rol | null
  esLider: boolean
  elegirGrupo: (grupoId: string) => void
  cambiarTema: (t: Tema) => Promise<void>
  cambiarModo: (m: Modo) => Promise<void>
  recargar: () => Promise<void>
  salir: () => Promise<void>
}

export const Ctx = createContext<AuthCtx | null>(null)

export function useAuth() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth fuera de AuthProvider')
  return c
}
// Nombres del plan (paso 2): usePerfil / useGrupoActual / useRol
export const usePerfil = () => useAuth().perfil
export const useGrupoActual = () => useAuth().membresia?.grupo ?? null
export const useRol = () => useAuth().rol
