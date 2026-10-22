import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { borrarTodo } from '../lib/offline/almacen'
import { audiosActivos, descargarAudios, fijarAudiosActivos, sincronizar, ultimaSincronizacion } from '../lib/offline/sincronizar'
import { permisos } from '../lib/permisos'
import { useAuth } from './authContext'
import { SyncContexto, type SyncCtx } from './syncContext'

const CADA = 20 * 60 * 1000 // mientras la app está abierta, se revisa cada 20 minutos
const TRAS_VOLVER = 5 * 60 * 1000 // al volver a la app, si pasaron más de 5 minutos

/**
 * Mantiene al día la copia del cancionero y del próximo servicio:
 *  · al abrir la app con conexión · cuando vuelve la conexión · al volver a la app · cada 20 minutos mientras está abierta.
 * En iPhone el sistema no deja a una app web trabajar con la pantalla apagada, así que no hay descarga "en segundo plano" real:
 * se hace sola apenas se abre la app con internet.
 */
export function SyncProvider({ children }: { children: ReactNode }) {
  const { membresia, rol, session } = useAuth()
  const grupoId = membresia?.grupo_id
  const miId = membresia?.id
  const activo = Boolean(grupoId && permisos(rol).verCancionero)

  const [enLinea, setEnLinea] = useState(() => navigator.onLine)
  const [sincronizando, setSincronizando] = useState(false)
  const [ultima, setUltima] = useState<string | null>(null)
  const [fallo, setFallo] = useState(false)
  const [version, setVersion] = useState(0)
  const [audios, setAudios] = useState(false)
  const [progresoAudios, setProgreso] = useState<SyncCtx['progresoAudios']>(null)
  const enCurso = useRef(false)
  const ultimoIntento = useRef(0)

  // Estado inicial guardado en el dispositivo
  useEffect(() => {
    if (!grupoId) return
    let vivo = true
    void ultimaSincronizacion(grupoId).then((u) => { if (vivo) setUltima(u ?? null) })
    void audiosActivos(grupoId).then((a) => { if (vivo) setAudios(a) })
    return () => { vivo = false }
  }, [grupoId])

  const bajarAudios = useCallback(async () => {
    if (!grupoId) return
    setProgreso({ hechas: 0, total: 0 })
    try { await descargarAudios(grupoId, (hechas, total) => setProgreso({ hechas, total })) } catch { /* se reintenta en la próxima */ }
    setProgreso(null)
  }, [grupoId])

  const sincronizarAhora = useCallback(async (): Promise<boolean> => {
    if (!activo || !grupoId || enCurso.current || !navigator.onLine) return false
    enCurso.current = true
    ultimoIntento.current = Date.now()
    setSincronizando(true)
    try {
      const r = await sincronizar({ grupoId, miMiembroId: miId, conCancionero: true })
      setUltima(r.cuando)
      setFallo(false)
      setVersion((v) => v + 1)
      // Pide al navegador que no borre esta copia si el teléfono anda corto de espacio
      void navigator.storage?.persist?.().catch(() => {})
      if (await audiosActivos(grupoId)) void bajarAudios()
      return true
    } catch {
      setFallo(true)
      return false
    } finally {
      enCurso.current = false
      setSincronizando(false)
    }
  }, [activo, grupoId, miId, bajarAudios])

  // Al abrir y cada vez que cambia el grupo
  useEffect(() => { if (activo && session) void sincronizarAhora() }, [activo, session, sincronizarAhora])

  // Conexión: al volver el internet se descarga; al perderlo solo se avisa
  useEffect(() => {
    const alVolver = () => { setEnLinea(true); void sincronizarAhora() }
    const alIrse = () => setEnLinea(false)
    window.addEventListener('online', alVolver)
    window.addEventListener('offline', alIrse)
    return () => { window.removeEventListener('online', alVolver); window.removeEventListener('offline', alIrse) }
  }, [sincronizarAhora])

  // Al volver a la app y cada 20 minutos
  useEffect(() => {
    if (!activo) return
    const alMostrar = () => {
      if (document.visibilityState === 'visible' && Date.now() - ultimoIntento.current > TRAS_VOLVER) void sincronizarAhora()
    }
    document.addEventListener('visibilitychange', alMostrar)
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') void sincronizarAhora() }, CADA)
    return () => { document.removeEventListener('visibilitychange', alMostrar); clearInterval(t) }
  }, [activo, sincronizarAhora])

  const fijarAudios = useCallback(async (v: boolean) => {
    if (!grupoId) return
    setAudios(v)
    await fijarAudiosActivos(grupoId, v)
    if (v) void bajarAudios()
  }, [grupoId, bajarAudios])

  const borrarDescarga = useCallback(async () => {
    await borrarTodo()
    setUltima(null)
    setAudios(false)
    setVersion((v) => v + 1)
  }, [])

  const valor = useMemo<SyncCtx>(() => ({
    enLinea, sincronizando, ultima, fallo, version, activo, audios, progresoAudios, sincronizarAhora, fijarAudios, borrarDescarga,
  }), [enLinea, sincronizando, ultima, fallo, version, activo, audios, progresoAudios, sincronizarAhora, fijarAudios, borrarDescarga])

  return <SyncContexto.Provider value={valor}>{children}</SyncContexto.Provider>
}
