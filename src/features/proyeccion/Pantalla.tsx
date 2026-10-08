import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../hooks/authContext'
import { cargarTemas, useEstadoProyeccion, type TemaProy } from './datos'

/** Tamaño de letra que llena la pantalla sin cortar la línea más larga ni salirse en alto. */
function tamano(lineas: string[], ancho: number, alto: number): number {
  const largo = Math.max(...lineas.map((l) => l.length), 8)
  const porAncho = (ancho * 0.9) / (largo * 0.5)
  const porAlto = (alto * 0.72) / (lineas.length * 1.3)
  return Math.max(24, Math.min(porAncho, porAlto, alto * 0.16))
}

/** Salida para el proyector del templo: negro, sin controles, sigue en vivo lo que haga el operador. */
export default function Pantalla() {
  const { membresia, perfil } = useAuth()
  const { estado, enVivo } = useEstadoProyeccion(membresia?.grupo_id, perfil?.id)
  const [temas, setTemas] = useState<TemaProy[]>([])
  const [dim, setDim] = useState({ w: window.innerWidth, h: window.innerHeight })
  const [pista, setPista] = useState(true)
  const cargado = useRef<string | null>(null)

  useEffect(() => {
    const a = () => setDim({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', a)
    return () => window.removeEventListener('resize', a)
  }, [])

  // Las letras del servicio que se está proyectando; si falla se reintenta con el siguiente cambio
  useEffect(() => {
    const id = estado.servicio_id
    if (!id || cargado.current === id) return
    cargado.current = id
    cargarTemas(id).then(setTemas).catch(() => { cargado.current = null })
  }, [estado.servicio_id])

  // Que el proyector no se apague
  useEffect(() => {
    let candado: WakeLockSentinel | null = null
    const pedir = () => { void navigator.wakeLock?.request('screen').then((l) => { candado = l }).catch(() => {}) }
    pedir()
    const v = () => { if (document.visibilityState === 'visible') pedir() }
    document.addEventListener('visibilitychange', v)
    return () => { document.removeEventListener('visibilitychange', v); void candado?.release().catch(() => {}) }
  }, [])

  useEffect(() => { const t = setTimeout(() => setPista(false), 6000); return () => clearTimeout(t) }, [])

  const slide = useMemo(() => {
    const t = temas.find((x) => x.itemId === estado.item_id)
    return t ? t.slides[Math.min(estado.diapositiva, t.slides.length - 1)] ?? null : null
  }, [temas, estado.item_id, estado.diapositiva])

  const fs = slide ? tamano(slide.lineas, dim.w, dim.h) : 0

  function pantallaCompleta() {
    setPista(false)
    if (!document.fullscreenElement) void document.documentElement.requestFullscreen?.().catch(() => {})
  }

  return (
    <div onClick={pantallaCompleta} className="fixed inset-0 z-40 grid cursor-none place-items-center overflow-hidden bg-black text-center text-white" style={{ fontFamily: "'Nunito', system-ui, sans-serif" }}>
      {estado.modo === 'letra' && slide && (
        <div key={`${estado.item_id}-${estado.diapositiva}`} className="pantalla-letra px-[5vw]" style={{ fontSize: fs, lineHeight: 1.3, fontWeight: 700 }}>
          {slide.lineas.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
      {estado.modo === 'logo' && (
        <div className="flex flex-col items-center gap-6" style={{ opacity: 0.9 }}>
          <span className="eq" aria-hidden style={{ height: 120, gap: 14 }}>
            {[0, 1, 2, 3].map((i) => <span key={i} style={{ width: 18, height: 120, borderRadius: 9, background: i % 2 ? '#3d6b4a' : '#a9d4a0' }} />)}
          </span>
          <span className="display" style={{ fontSize: Math.min(dim.w * 0.06, 72), fontWeight: 600 }}>{membresia?.grupo.nombre}</span>
        </div>
      )}
      {pista && <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-xl px-4 py-2 text-sm" style={{ background: '#1e2a22', color: '#93a898' }}>Toca la pantalla para ponerla completa</span>}
      {!enVivo && <span className="absolute top-3 right-3 h-2.5 w-2.5 rounded-full" style={{ background: '#b3261e' }} title="Sin conexión en vivo" />}
    </div>
  )
}
