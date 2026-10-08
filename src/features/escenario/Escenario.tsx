import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useAuth } from '../../hooks/authContext'
import { distancia, transponerTono, usaBemoles } from '../../lib/chordpro'
import { fechaCorta, hora } from '../../lib/fechas'
import LetraView from '../cancionero/LetraView'
import { cargarEscenario, guardarMiTono, leerCopia, type CancionEscenario, type Escenario as Datos } from './datos'

const TAM_MIN = 16
const TAM_MAX = 40

/** Semitonos (-6 a +6) entre el tono del servicio y el que el integrante dejó guardado. */
function pasosGuardados(c: CancionEscenario): number {
  if (!c.tono || !c.miTono) return 0
  const d = distancia(c.tono, c.miTono)
  return d > 6 ? d - 12 : d
}

export default function Escenario() {
  const { membresia, rol } = useAuth()
  const grupoId = membresia?.grupo_id
  const miembroId = membresia?.id
  const [datos, setDatos] = useState<Datos | null | undefined>(undefined)
  const [sinConexion, setSinConexion] = useState(false)
  const [i, setI] = useState(0)
  const [pasos, setPasos] = useState<Record<string, number>>({})
  const [tam, setTam] = useState(22)
  const [acordes, setAcordes] = useState(rol !== 'voz') // Voz entra con acordes ocultos
  const [auto, setAuto] = useState(false)
  const caja = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!grupoId) return
    let vivo = true
    // Se muestra de inmediato la copia del dispositivo y se refresca si hay red
    const copia = leerCopia(grupoId)
    if (copia) setDatos(copia)
    cargarEscenario(grupoId, miembroId).then((d) => { if (vivo) { setDatos(d); setSinConexion(false) } })
      .catch(() => { if (vivo) { setSinConexion(true); setDatos((previo) => previo ?? null) } })
    return () => { vivo = false }
  }, [grupoId, miembroId])

  // Que la pantalla no se apague mientras se canta
  useEffect(() => {
    let candado: WakeLockSentinel | null = null
    const pedir = () => { void navigator.wakeLock?.request('screen').then((l) => { candado = l }).catch(() => {}) }
    pedir()
    const alVolver = () => { if (document.visibilityState === 'visible') pedir() }
    document.addEventListener('visibilitychange', alVolver)
    return () => { document.removeEventListener('visibilitychange', alVolver); void candado?.release().catch(() => {}) }
  }, [])

  useEffect(() => {
    if (!auto) return
    const t = setInterval(() => { if (caja.current) caja.current.scrollTop += 1 }, 45)
    return () => clearInterval(t)
  }, [auto])

  const ir = useCallback((n: number) => {
    setI(n)
    setAuto(false)
    caja.current?.scrollTo({ top: 0 })
  }, [])

  if (datos === undefined) {
    return <div className="esc grid place-items-center"><span className="spinner" aria-label="Cargando" /></div>
  }

  const salir = <Link to="/" className="esc-ib" aria-label="Salir del modo escenario"><Icon name="equis" size={20} strokeWidth={2.2} /></Link>

  if (!datos || datos.canciones.length === 0) {
    return (
      <div className="esc">
        <header className="esc-head"><div className="flex items-center gap-2.5">{salir}<span className="esc-titulo">Modo escenario</span></div></header>
        <p className="m-0 px-6 pt-8 text-base leading-normal" style={{ color: 'var(--escena-muted)' }}>
          {!datos && sinConexion
            ? 'No hay conexión y este dispositivo todavía no tiene una copia del servicio. Abre la app una vez con internet para guardarla.'
            : 'No hay canciones en el próximo servicio. El líder las agrega en Servicios.'}
        </p>
      </div>
    )
  }

  const c = datos.canciones[Math.min(i, datos.canciones.length - 1)]!
  const p = pasos[c.cancionId] ?? pasosGuardados(c)
  const tonoActual = c.tono ? transponerTono(c.tono, p) : null
  const bemoles = tonoActual ? usaBemoles(tonoActual) : false
  const hayAnterior = i > 0
  const haySiguiente = i < datos.canciones.length - 1
  const mover = (d: number) => {
    const nuevo = Math.max(-6, Math.min(6, p + d))
    setPasos((m) => ({ ...m, [c.cancionId]: nuevo }))
    // Se recuerda el tono para la próxima vez; si no hay red o permiso, la transposición sigue valiendo en esta sesión
    if (c.tono && miembroId) void guardarMiTono(c.cancionId, miembroId, transponerTono(c.tono, nuevo))
  }
  const meta = [c.autor, c.momento, c.bpm ? `${c.bpm} BPM` : null].filter(Boolean).join(' · ')

  return (
    <div className="esc">
      <header className="esc-head">
        <div className="flex items-center gap-2.5">
          {salir}
          <span className="flex min-w-0 grow flex-col">
            <span className="esc-eyebrow"><span className="esc-live" aria-hidden />{fechaCorta(datos.servicio.fecha)} · {hora(datos.servicio.fecha)} · {i + 1} de {datos.canciones.length}</span>
            <span className="esc-titulo truncate">{c.titulo}</span>
          </span>
          {tonoActual && <span className="esc-tono">Tono {tonoActual}{p !== 0 && c.tono ? ` (orig. ${c.tono})` : ''}</span>}
        </div>
        <div role="toolbar" aria-label="Controles" className="esc-tools">
          <div className="esc-grp" role="group" aria-label="Tono">
            <button type="button" className="esc-ib" aria-label="Bajar medio tono" disabled={!c.tono} onClick={() => mover(-1)}><Icon name="menos" size={16} strokeWidth={2.6} /></button>
            <span className="esc-val" aria-live="polite">{p > 0 ? `+${p}` : p}</span>
            <button type="button" className="esc-ib" aria-label="Subir medio tono" disabled={!c.tono} onClick={() => mover(1)}><Icon name="mas" size={16} strokeWidth={2.6} /></button>
          </div>
          <div className="esc-grp" role="group" aria-label="Tamaño de letra">
            <button type="button" className="esc-ib" aria-label="Letra más pequeña" disabled={tam <= TAM_MIN} onClick={() => setTam((t) => Math.max(TAM_MIN, t - 2))} style={{ fontSize: 13 }}>A</button>
            <button type="button" className="esc-ib" aria-label="Letra más grande" disabled={tam >= TAM_MAX} onClick={() => setTam((t) => Math.min(TAM_MAX, t + 2))} style={{ fontSize: 19 }}>A</button>
          </div>
          <button type="button" className={'esc-ib' + (acordes ? ' on' : '')} aria-pressed={acordes} onClick={() => setAcordes(!acordes)}>Acordes</button>
          <button type="button" className={'esc-ib' + (auto ? ' on' : '')} aria-pressed={auto} aria-label="Desplazamiento automático" onClick={() => setAuto(!auto)}>
            {auto ? <span aria-hidden>❚❚</span> : <Icon name="arriba" size={16} strokeWidth={2.2} style={{ transform: 'rotate(180deg)' }} />}Auto
          </button>
        </div>
        {sinConexion && <span role="status" className="esc-aviso">Sin conexión · copia guardada {fechaCorta(datos.guardado)} {hora(datos.guardado)}</span>}
      </header>

      <div ref={caja} className="esc-cuerpo">
        {meta && <p className="m-0 mb-3 text-[13px] font-bold" style={{ color: 'var(--escena-muted)' }}>{meta}</p>}
        <div style={{ fontSize: tam }}>
          <LetraView texto={c.letra} pasos={p} bemoles={bemoles} acordes={acordes} />
        </div>
      </div>

      <footer className="esc-pie">
        <button type="button" className="esc-nav" disabled={!hayAnterior} onClick={() => ir(i - 1)}>
          <Icon name="atras" size={20} strokeWidth={2.4} />
          <span className="flex min-w-0 flex-col"><small>Anterior</small><b className="truncate">{hayAnterior ? datos.canciones[i - 1]!.titulo : '—'}</b></span>
        </button>
        <button type="button" className="esc-nav next" disabled={!haySiguiente} onClick={() => ir(i + 1)}>
          <span className="flex min-w-0 flex-col"><small>Siguiente</small><b className="truncate">{haySiguiente ? datos.canciones[i + 1]!.titulo : 'Fin del servicio'}</b></span>
          <Icon name="derecha" size={20} strokeWidth={2.4} />
        </button>
      </footer>
    </div>
  )
}
