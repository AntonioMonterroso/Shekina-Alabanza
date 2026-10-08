import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useToast } from '../../components/Toast'
import { useAuth } from '../../hooks/authContext'
import { hoyGT } from '../../lib/fechas'
import { bpmPorToques, BPM_MAX, BPM_MIN, limitarBpm, Metronomo } from '../../lib/metronomo'
import { anotarPractica, borrarRegistro, cargarClase, cargarPractica, cargarRegistros, type Clase, type Practica, type Registro } from './api'
import HojaRegistro from './HojaRegistro'

const TIEMPOS = [2, 3, 4, 6]
const mmss = (ms: number) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }
const urlSegura = (u: string | null) => (u && /^https?:\/\//i.test(u) ? u : null)

/** Modo práctica: pantalla completa con temporizador y metrónomo. Al terminar anota los minutos. */
export default function Practicar() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const { membresia } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const alumnoId = params.get('a') ?? membresia?.id ?? ''
  const hoy = hoyGT()

  const [practica, setPractica] = useState<Practica | null | undefined>(undefined)
  const [clase, setClase] = useState<Clase | null>(null)
  const [registros, setRegistros] = useState<Registro[]>([])

  // Temporizador: suma solo el tiempo en que estuvo corriendo
  const [corriendo, setCorriendo] = useState(false)
  const [acumulado, setAcumulado] = useState(0)
  const [desde, setDesde] = useState(0)
  const [ahora, setAhora] = useState(Date.now())
  const transcurrido = acumulado + (corriendo ? ahora - desde : 0)

  // Metrónomo
  const metro = useRef<Metronomo | null>(null)
  const [bpm, setBpm] = useState(80)
  const [tiempos, setTiempos] = useState(4)
  const [sonando, setSonando] = useState(false)
  const [golpe, setGolpe] = useState(-1)
  const toques = useRef<number[]>([])

  const [terminando, setTerminando] = useState(false)

  useEffect(() => {
    if (!id) return
    void (async () => {
      const p = await cargarPractica(id)
      setPractica(p)
      if (!p) return
      if (p.bpm) setBpm(p.bpm)
      setClase(await cargarClase(p.clase_id))
      setRegistros(await cargarRegistros([p.id], hoy, alumnoId))
    })()
  }, [id, hoy, alumnoId])

  useEffect(() => {
    const m = new Metronomo()
    m.alGolpe = setGolpe
    metro.current = m
    return () => m.cerrar()
  }, [])
  useEffect(() => { if (metro.current) metro.current.bpm = bpm }, [bpm])
  useEffect(() => { if (metro.current) metro.current.tiempos = tiempos }, [tiempos])

  useEffect(() => {
    if (!corriendo) return
    const t = setInterval(() => setAhora(Date.now()), 500)
    return () => clearInterval(t)
  }, [corriendo])

  // Que la pantalla no se apague mientras practica
  useEffect(() => {
    let candado: WakeLockSentinel | null = null
    const pedir = () => { void navigator.wakeLock?.request('screen').then((l) => { candado = l }).catch(() => {}) }
    pedir()
    const v = () => { if (document.visibilityState === 'visible') pedir() }
    document.addEventListener('visibilitychange', v)
    return () => { document.removeEventListener('visibilitychange', v); void candado?.release().catch(() => {}) }
  }, [])

  const minutosSugeridos = useMemo(() => Math.max(1, Math.round(transcurrido / 60000)), [transcurrido])

  function alternarTemporizador() {
    if (corriendo) { setAcumulado(transcurrido); setCorriendo(false) } else { const t = Date.now(); setDesde(t); setAhora(t); setCorriendo(true) }
  }
  async function alternarMetronomo() {
    const m = metro.current
    if (!m) return
    if (m.sonando) { m.detener(); setSonando(false); setGolpe(-1) } else { await m.iniciar(); setSonando(true) }
  }
  function tocarTempo() {
    toques.current = [...toques.current.slice(-6), Date.now()]
    const b = bpmPorToques(toques.current)
    if (b) setBpm(b)
  }

  async function guardar(practicaId: string, fecha: string, minutos: number, nota: string | null) {
    const ok = await anotarPractica(practicaId, alumnoId, fecha, minutos, nota)
    if (ok) { toast('¡Práctica anotada!'); navigate('/escuela', { replace: true }) }
    return ok
  }
  async function quitar(rid: string) {
    const ok = await borrarRegistro(rid)
    if (ok) setRegistros((r) => r.filter((x) => x.id !== rid))
    return ok
  }

  if (practica === undefined) return <div className="esc grid place-items-center"><span className="spinner" aria-label="Cargando" /></div>
  if (practica === null) {
    return (
      <div className="esc">
        <header className="esc-head"><div className="flex items-center gap-2.5"><Link to="/escuela" className="esc-ib" aria-label="Salir"><Icon name="equis" size={20} strokeWidth={2.2} /></Link><span className="esc-titulo">No encontramos esta práctica</span></div></header>
      </div>
    )
  }

  const enlace = urlSegura(practica.enlace)

  return (
    <div className="esc">
      <header className="esc-head">
        <div className="flex items-center gap-2.5">
          <Link to="/escuela" className="esc-ib" aria-label="Salir del modo práctica"><Icon name="equis" size={20} strokeWidth={2.2} /></Link>
          <span className="flex min-w-0 grow flex-col">
            <span className="esc-eyebrow">{clase?.nombre ?? 'Práctica'}{practica.minutos_meta ? ` · meta ${practica.minutos_meta} min` : ''}</span>
            <span className="esc-titulo truncate">{practica.titulo}</span>
          </span>
        </div>
      </header>

      <div className="esc-cuerpo flex flex-col gap-4">
        {practica.detalle && <p className="m-0 rounded-2xl p-3.5 text-[17px] leading-snug whitespace-pre-wrap" style={{ background: 'var(--escena-panel)' }}>{practica.detalle}</p>}
        {enlace && <a href={enlace} target="_blank" rel="noopener noreferrer" className="esc-ib self-start no-underline"><Icon name="audio" size={18} strokeWidth={2} />Material de apoyo</a>}

        <section aria-label="Temporizador" className="flex flex-col items-center gap-3 rounded-3xl p-5" style={{ background: 'var(--escena-panel)' }}>
          <span className="esc-eyebrow">Tiempo de práctica</span>
          <span role="timer" aria-live="off" className="text-[64px] leading-none font-extrabold tabular-nums">{mmss(transcurrido)}</span>
          <div className="flex gap-2.5">
            <button type="button" className={'esc-ib !h-12 !px-6' + (corriendo ? '' : ' on')} onClick={alternarTemporizador}>{corriendo ? 'Pausar' : transcurrido > 0 ? 'Seguir' : 'Empezar'}</button>
            {transcurrido > 0 && !corriendo && <button type="button" className="esc-ib !h-12" onClick={() => { setAcumulado(0) }}>Reiniciar</button>}
          </div>
        </section>

        <section aria-label="Metrónomo" className="flex flex-col items-center gap-3.5 rounded-3xl p-5" style={{ background: 'var(--escena-panel)' }}>
          <span className="esc-eyebrow">Metrónomo</span>
          <div className="flex items-center gap-4">
            <button type="button" className="esc-ib !h-12 !w-12" aria-label="Más lento" onClick={() => setBpm((b) => limitarBpm(b - 1))}><Icon name="menos" size={18} strokeWidth={2.6} /></button>
            <span className="min-w-[132px] text-center"><span className="text-[56px] leading-none font-extrabold tabular-nums">{bpm}</span><small className="block text-[13px] font-bold" style={{ color: 'var(--escena-muted)' }}>BPM</small></span>
            <button type="button" className="esc-ib !h-12 !w-12" aria-label="Más rápido" onClick={() => setBpm((b) => limitarBpm(b + 1))}><Icon name="mas" size={18} strokeWidth={2.6} /></button>
          </div>
          <input type="range" min={BPM_MIN} max={BPM_MAX} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} aria-label="Tempo" className="w-full" style={{ accentColor: 'var(--escena-chord)' }} />
          <div className="flex gap-2" aria-hidden>
            {Array.from({ length: tiempos }, (_, i) => <span key={i} className="h-3.5 w-3.5 rounded-full" style={{ background: sonando && golpe === i ? 'var(--escena-chord)' : '#2a3a30', transform: sonando && golpe === i ? 'scale(1.35)' : 'none', transition: 'transform .08s' }} />)}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2" role="group" aria-label="Compás">
            {TIEMPOS.map((t) => <button key={t} type="button" aria-pressed={tiempos === t} className={'esc-ib' + (tiempos === t ? ' on' : '')} onClick={() => setTiempos(t)}>{t}/4</button>)}
            <button type="button" className="esc-ib" onClick={tocarTempo}>Toca el tempo</button>
          </div>
          <button type="button" className={'esc-nav next !h-14 !flex-none !justify-center !px-10' + (sonando ? '' : '')} style={sonando ? { background: 'var(--escena-panel)', color: 'var(--escena-fg)', boxShadow: 'inset 0 0 0 2px var(--escena-chord)' } : undefined} onClick={alternarMetronomo}>{sonando ? 'Detener' : 'Iniciar metrónomo'}</button>
        </section>
      </div>

      <footer className="esc-pie">
        <button type="button" className="esc-nav next !justify-center" onClick={() => { if (corriendo) { setAcumulado(transcurrido); setCorriendo(false) } setTerminando(true) }}>
          <Icon name="check" size={20} strokeWidth={2.6} />Terminé de practicar
        </button>
      </footer>

      <HojaRegistro practica={terminando ? practica : null} dias={[hoy]} hoy={hoy} registros={registros} minutosIniciales={transcurrido > 0 ? minutosSugeridos : undefined} onGuardar={guardar} onBorrar={quitar} onCerrar={() => setTerminando(false)} />
    </div>
  )
}
