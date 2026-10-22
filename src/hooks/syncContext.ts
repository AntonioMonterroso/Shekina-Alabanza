import { createContext, useContext } from 'react'

// El contexto vive aparte del componente (SyncProvider) para que Vite pueda recargar en caliente sin romperlo.
export interface SyncCtx {
  /** el dispositivo dice tener conexión */
  enLinea: boolean
  sincronizando: boolean
  /** ISO de la última descarga completa, o null si nunca */
  ultima: string | null
  /** la última descarga falló (p. ej. señal mala): se sigue usando la copia */
  fallo: boolean
  /** sube de número cada vez que llega algo nuevo, para que las pantallas vuelvan a leer la copia */
  version: number
  /** este usuario baja el cancionero a su dispositivo */
  activo: boolean
  audios: boolean
  /** progreso de la descarga de audios, o null si no hay una en curso */
  progresoAudios: { hechas: number; total: number } | null
  sincronizarAhora: () => Promise<boolean>
  fijarAudios: (v: boolean) => Promise<void>
  borrarDescarga: () => Promise<void>
}

export const SyncContexto = createContext<SyncCtx | null>(null)

const vacio: SyncCtx = {
  enLinea: true, sincronizando: false, ultima: null, fallo: false, version: 0, activo: false, audios: false, progresoAudios: null,
  sincronizarAhora: async () => false, fijarAudios: async () => {}, borrarDescarga: async () => {},
}

/** Estado de la copia sin conexión. Fuera del proveedor devuelve un estado vacío (no rompe). */
export function useSync(): SyncCtx {
  return useContext(SyncContexto) ?? vacio
}
