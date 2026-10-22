import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type TouchEvent } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useAuth } from '../../hooks/authContext'
import { useSync } from '../../hooks/syncContext'
import { distancia, transponerTono, usaBemoles } from '../../lib/chordpro'
import { fechaCorta, hora } from '../../lib/fechas'
import LetraView from '../cancionero/LetraView'
import { cargarEscenario, guardarMiTono, type CancionEscenario, type Escenario as Datos } from './datos'

const TAM_MIN = 16
const TAM_MAX = 44
const VELOCIDADES = [0, 16, 30, 50] // píxeles por segundo: lenta, media, rápida
const NOMBRE_VEL = ['', 'Lenta', 'Media', 'Rápida']

type ModoFondo = 'app' | 'claro' | 'oscuro'
interface Ajustes { tam: number; acordes: boolean | null; modo: ModoFondo; velocidad: 1 | 2 | 3 }
const AJUSTES_INICIALES: Ajustes = { tam: 24, acordes: null, modo: 'app', velocidad: 2 }
const LS_AJUSTES = 'shekina.escenario.ajustes'

function leerAjustes(): Ajustes {
  try {
    const x = JSON.parse(localStorage.getItem(LS_AJUSTES) ?? 'null') as Partial<Ajustes> | null
    return {
      tam: Math.min(TAM_MAX, Math.max(TAM_MIN, Number(x?.tam) || AJUSTES_INICIALES.tam)),
      acordes: typeof x?.acordes === 'boolean' ? x.acordes : null,
      modo: x?.modo === 'claro' || x?.modo === 'oscuro' ? x.modo : 'app',
      velocidad: x?.velocidad === 1 || x?.velocidad === 3 ? x.velocidad : 2,
    }
  } catch { return AJUSTES_INICIALES }
}

/** Semitonos (-6 a +6) entre el tono de la canción y el que el integrante dejó guardado. */
function pasosGuardados(c: CancionEscenario): number {
  if (!c.tono || !c.miTono) return 0
  const d = distancia(c.tono, c.miTono)
  return d > 6 ? d - 12 : d
}

/** Hoja inferior propia: la del resto de la app queda por debajo de esta pantalla completa. */
function EscHoja({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onCerrar])
  return (
    <>
      <div className="esc-fondo" onClick={onCerrar} />
      <div className="esc-hoja" role="dialog" aria-modal="true" aria-label={titulo}>
        <span aria-hidden className="grip" />
        {children}
      </div>
    </>
  )
}

export default function Escenario() {
  const { membresia, rol, perfil } = useAuth()
  const sync = useSync()
  const grupoId = membresia?.grupo_id
  const miembroId = membresia?.id

  const [datos, setDatos] = useState<Datos | undefined>(undefined)
  const [i, setI] = useState(0)
  const [extra, setExtra] = useState<CancionEscenario | null>(null) // una canción del cancionero fuera del servicio
  const [pasos, setPasos] = useState<Record<string, number>>({})
  const [aj, setAj] = useState<Ajustes>(leerAjustes)
  const [auto, setAuto] = useState(false)
  const [hoja, setHoja] = useState<null | 'lista' | 'ajustes'>(null)
  const [pestana, setPestana] = useState<'servicio' | 'cancionero'>('servicio')
  const [busca, setBusca] = useState('')
  const caja = useRef<HTMLDivElement>(null)
  const toque = useRef<{ x: number; y: number; t: number } | null>(null)
  const pidioDescarga = useRef(false)

  // La pantalla lee la copia del dispositivo: abre al instante y funciona igual sin internet
  useEffect(() => {
    if (!grupoId) return
    let vivo = true
    void cargarEscenario(grupoId, miembroId).then((d) => { if (vivo) setDatos(d) })
    return () => { vivo = false }
  }, [grupoId, miembroId, sync.version])

  // Si el dispositivo aún no tiene nada guardado y hay internet, se pide la descarga una vez
  useEffect(() => {
    if (datos && !datos.guardado && sync.enLinea && sync.activo && !sync.sincronizando && !pidioDescarga.current) {
      pidioDescarga.current = true
      void sync.sincronizarAhora()
    }
  }, [datos, sync])

  useEffect(() => { try { localStorage.setItem(LS_AJUSTES, JSON.stringify(aj)) } catch { /* sin espacio */ } }, [aj])

  // Que la pantalla no se apague mientras se canta
  useEffect(() => {
    let candado: WakeLockSentinel | null = null
    const pedir = () => { void navigator.wakeLock?.request('screen').then((l) => { candado = l }).catch(() => {}) }
    pedir()
    const alVolver = () => { if (document.visibilityState === 'visible') pedir() }
    document.addEventListener('visibilitychange', alVolver)
    return () => { document.removeEventListener('visibilitychange', alVolver); void candado?.release().catch(() => {}) }
  }, [])

  // Desplazamiento automático suave, a la velocidad elegida; se detiene al llegar al final
  useEffect(() => {
    if (!auto) return
    const px = VELOCIDADES[aj.velocidad]!
    let ultimo = performance.now(), resto = 0, id = 0
    const paso = (t: number) => {
      const el = caja.current
      if (!el) return
      resto += ((t - ultimo) / 1000) * px
      ultimo = t
      const n = Math.floor(resto)
      if (n > 0) { el.scrollTop += n; resto -= n }
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) return setAuto(false)
      id = requestAnimationFrame(paso)
    }
    id = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(id)
  }, [auto, aj.velocidad])

  const lista = datos?.canciones ?? []
  const c = extra ?? lista[Math.min(i, Math.max(0, lista.length - 1))] ?? null

  const ir = useCallback((n: number) => {
    setI(n)
    setExtra(null)
    setAuto(false)
    caja.current?.scrollTo({ top: 0 })
  }, [])

  // Flechas del teclado (tabletas con teclado, pedal Bluetooth)
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (hoja || extra) return
      if (e.key === 'ArrowRight' && i < lista.length - 1) ir(i + 1)
      if (e.key === 'ArrowLeft' && i > 0) ir(i - 1)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [hoja, extra, i, lista.length, ir])

  const modoApp = document.documentElement.dataset.modo === 'oscuro' ? 'oscuro' : 'claro'
  const modo = aj.modo === 'app' ? modoApp : aj.modo
  const tema = perfil?.tema ?? 'salvia'
  const acordes = aj.acordes ?? rol !== 'voz' // Voz entra con acordes ocultos
  const cambiar = (p: Partial<Ajustes>) => setAj((x) => ({ ...x, ...p }))

  const resultados = useMemo(() => {
    const t = busca.trim().toLowerCase()
    const todo = datos?.catalogo ?? []
    return (t ? todo.filter((x) => x.titulo.toLowerCase().includes(t) || (x.autor ?? '').toLowerCase().includes(t)) : todo).slice(0, 80)
  }, [datos, busca])

  if (datos === undefined) {
    return <div className="esc" data-tema={tema} data-modo={modo}><span className="spinner" role="status" aria-label="Cargando" /></div>
  }

  const salir = <Link to="/" className="esc-ib" aria-label="Salir del modo escenario"><Icon name="equis" size={20} strokeWidth={2.2} /></Link>
  const hayCatalogo = datos.catalogo.length > 0
  const guardado = datos.guardado ? `${fechaCorta(datos.guardado)} ${hora(datos.guardado)}` : null

  if (!c) {
    return (
      <div className="esc" data-tema={tema} data-modo={modo}>
        <header className="esc-head">{salir}<div className="esc-info"><span className="esc-titulo">Modo escenario</span></div></header>
        <div className="flex flex-col gap-4 px-6 pt-6">
          <p className="m-0 text-base leading-normal" style={{ color: 'var(--muted)' }}>
            {!datos.guardado
              ? (sync.enLinea
                ? (sync.sincronizando ? 'Descargando el cancionero a este teléfono…' : 'Todavía no hay nada guardado en este teléfono. Toca “Descargar” para bajar el cancionero.')
                : 'No hay conexión y este teléfono todavía no tiene una copia. Abre la app una vez con internet para guardarla.')
              : 'No hay canciones en el próximo servicio. El líder las agrega en Servicios.'}
          </p>
          {!datos.guardado && sync.enLinea && !sync.sincronizando && <button type="button" className="cta" onClick={() => void sync.sincronizarAhora()}>Descargar</button>}
          {hayCatalogo && <button type="button" className="cta" onClick={() => { setPestana('cancionero'); setHoja('lista') }}>Elegir una canción del cancionero</button>}
        </div>
        {hoja === 'lista' && renderLista()}
      </div>
    )
  }

  const p = pasos[c.cancionId] ?? pasosGuardados(c)
  const tonoActual = c.tono ? transponerTono(c.tono, p) : null
  const bemoles = tonoActual ? usaBemoles(tonoActual) : false
  const hayAnterior = !extra && i > 0
  const haySiguiente = !extra && i < lista.length - 1

  function mover(d: number) {
    if (!c?.tono) return
    const nuevo = Math.max(-6, Math.min(6, p + d))
    setPasos((m) => ({ ...m, [c.cancionId]: nuevo }))
    // Se recuerda en el dispositivo y, si hay internet, también en la nube
    if (miembroId && grupoId) void guardarMiTono(grupoId, c.cancionId, miembroId, transponerTono(c.tono, nuevo))
  }

  function alTocar(e: TouchEvent) {
    if (auto) setAuto(false) // tocar la letra pausa el desplazamiento
    const t = e.touches[0]
    if (t) toque.current = { x: t.clientX, y: t.clientY, t: Date.now() }
  }
  function alSoltar(e: TouchEvent) {
    const ini = toque.current
    toque.current = null
    const t = e.changedTouches[0]
    if (!ini || !t || extra) return
    const dx = t.clientX - ini.x, dy = t.clientY - ini.y
    // Deslizar de lado cambia de canción (rápido, claramente horizontal)
    if (Math.abs(dx) > 90 && Math.abs(dy) < 45 && Date.now() - ini.t < 600) {
      if (dx < 0 && haySiguiente) ir(i + 1)
      if (dx > 0 && hayAnterior) ir(i - 1)
    }
  }

  function renderLista() {
    return (
      <EscHoja titulo="Elegir canción" onCerrar={() => setHoja(null)}>
        <h2 className="display m-0 text-2xl font-semibold">Canciones</h2>
        <div className="segmentado" style={{ gridTemplateColumns: '1fr 1fr' }} role="tablist">
          <button type="button" role="tab" aria-selected={pestana === 'servicio'} className={pestana === 'servicio' ? 'on' : ''} onClick={() => setPestana('servicio')}>Del servicio</button>
          <button type="button" role="tab" aria-selected={pestana === 'cancionero'} className={pestana === 'cancionero' ? 'on' : ''} onClick={() => setPestana('cancionero')}>Cancionero</button>
        </div>
        {pestana === 'servicio' ? (
          <div className="esc-lista">
            {lista.length === 0 && <p className="m-0 p-3 text-[15px]" style={{ color: 'var(--muted)' }}>El próximo servicio todavía no tiene canciones.</p>}
            {lista.map((x, n) => (
              <button key={x.itemId ?? x.cancionId + n} type="button" className={'esc-fila' + (!extra && n === i ? ' actual' : '')} onClick={() => { ir(n); setHoja(null) }}>
                <span className="onum">{n + 1}</span>
                <span className="flex min-w-0 grow flex-col"><span className="truncate text-[15px] font-extrabold">{x.titulo}</span><span className="truncate text-[13px]" style={{ color: 'var(--muted)' }}>{[x.momento, x.autor].filter(Boolean).join(' · ')}</span></span>
                {x.tono && <span className="key">{x.miTono ?? x.tono}</span>}
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="field" style={{ height: 52 }}><input id="esc-busca" type="search" placeholder=" " value={busca} onChange={(e) => setBusca(e.target.value)} style={{ paddingTop: 16 }} /><label htmlFor="esc-busca" style={{ top: 15 }}>Buscar título o autor</label></div>
            <div className="esc-lista">
              {resultados.length === 0 && <p className="m-0 p-3 text-[15px]" style={{ color: 'var(--muted)' }}>{hayCatalogo ? 'Ninguna canción coincide.' : 'Aún no hay canciones descargadas en este teléfono.'}</p>}
              {resultados.map((x) => (
                <button key={x.cancionId} type="button" className={'esc-fila' + (extra?.cancionId === x.cancionId ? ' actual' : '')} onClick={() => { setExtra(x); setAuto(false); setHoja(null); caja.current?.scrollTo({ top: 0 }) }}>
                  <span className="flex min-w-0 grow flex-col"><span className="truncate text-[15px] font-extrabold">{x.titulo}</span>{x.autor && <span className="truncate text-[13px]" style={{ color: 'var(--muted)' }}>{x.autor}</span>}</span>
                  {x.tono && <span className="key">{x.miTono ?? x.tono}</span>}
                </button>
              ))}
            </div>
          </>
        )}
      </EscHoja>
    )
  }

  const subtitulo = [tonoActual ? `Tono ${tonoActual}${p !== 0 && c.tono ? ` (orig. ${c.tono})` : ''}` : null, c.bpm ? `${c.bpm} BPM` : null, c.autor].filter(Boolean).join(' · ')
  const aviso = !sync.enLinea
    ? `Sin conexión${guardado ? ` · copia del ${guardado}` : ''}`
    : sync.fallo ? 'No se pudo actualizar · usando la copia guardada' : null

  return (
    <div className="esc" data-tema={tema} data-modo={modo}>
      <header className="esc-head">
        {salir}
        <div className="esc-info">
          <span className="esc-eyebrow">
            <span className="esc-live" aria-hidden />
            {extra ? 'Del cancionero' : `${datos.servicio ? `${fechaCorta(datos.servicio.fecha)} · ` : ''}${i + 1} de ${lista.length}`}
          </span>
          <span className="esc-titulo">{c.titulo}</span>
          {subtitulo && <span className="text-[13px] font-bold leading-tight" style={{ color: 'var(--muted)' }}>{subtitulo}</span>}
        </div>
        <button type="button" className="esc-ib" aria-label="Elegir otra canción" onClick={() => { setPestana(extra || lista.length === 0 ? 'cancionero' : 'servicio'); setHoja('lista') }}><Icon name="servicios" size={20} strokeWidth={2.2} /></button>
        <button type="button" className="esc-ib" aria-label="Ajustes del escenario" onClick={() => setHoja('ajustes')}><Icon name="ajustes" size={20} strokeWidth={2.2} /></button>
      </header>
      {aviso && <span role="status" className="esc-aviso">{aviso}</span>}

      <div ref={caja} className="esc-cuerpo" onTouchStart={alTocar} onTouchEnd={alSoltar}>
        <div style={{ fontSize: aj.tam }}>
          <LetraView texto={c.letra} pasos={p} bemoles={bemoles} acordes={acordes} />
        </div>
      </div>

      <div role="toolbar" aria-label="Controles" className="esc-controles">
        <div className="esc-grp" role="group" aria-label="Tono">
          <button type="button" className="esc-ib" aria-label="Bajar medio tono" disabled={!c.tono} onClick={() => mover(-1)}><Icon name="menos" size={18} strokeWidth={2.6} /></button>
          <span className="esc-val" aria-live="polite">{tonoActual ?? '—'}</span>
          <button type="button" className="esc-ib" aria-label="Subir medio tono" disabled={!c.tono} onClick={() => mover(1)}><Icon name="mas" size={18} strokeWidth={2.6} /></button>
        </div>
        <div className="esc-grp" role="group" aria-label="Tamaño de letra">
          <button type="button" className="esc-ib" aria-label="Letra más pequeña" disabled={aj.tam <= TAM_MIN} onClick={() => cambiar({ tam: Math.max(TAM_MIN, aj.tam - 2) })} style={{ fontSize: 14 }}>A</button>
          <button type="button" className="esc-ib" aria-label="Letra más grande" disabled={aj.tam >= TAM_MAX} onClick={() => cambiar({ tam: Math.min(TAM_MAX, aj.tam + 2) })} style={{ fontSize: 21 }}>A</button>
        </div>
        <button type="button" className={'esc-ib' + (acordes ? ' on' : '')} aria-pressed={acordes} onClick={() => cambiar({ acordes: !acordes })}>Acordes</button>
        <button type="button" className={'esc-ib' + (auto ? ' on' : '')} aria-pressed={auto} aria-label="Desplazamiento automático" onClick={() => setAuto(!auto)}>
          <Icon name={auto ? 'pausa' : 'play'} size={17} strokeWidth={2.4} />Auto
        </button>
      </div>

      {!extra && lista.length > 1 && lista.length <= 14 && <div className="esc-puntos" aria-hidden>{lista.map((_, n) => <i key={n} className={n === i ? 'on' : ''} />)}</div>}
      <footer className="esc-pie">
        {extra ? (
          <>
            <button type="button" className="esc-nav" onClick={() => { setPestana('cancionero'); setHoja('lista') }}><Icon name="buscar" size={20} strokeWidth={2.4} /><span className="flex min-w-0 flex-col"><small>Cancionero</small><b className="truncate">Elegir otra</b></span></button>
            {lista.length > 0 && <button type="button" className="esc-nav next" onClick={() => ir(Math.min(i, lista.length - 1))}><span className="flex min-w-0 flex-col"><small>Volver al</small><b className="truncate">Servicio</b></span><Icon name="derecha" size={20} strokeWidth={2.4} /></button>}
          </>
        ) : (
          <>
            <button type="button" className="esc-nav" disabled={!hayAnterior} onClick={() => ir(i - 1)}>
              <Icon name="atras" size={20} strokeWidth={2.4} />
              <span className="flex min-w-0 flex-col"><small>Anterior</small><b className="truncate">{hayAnterior ? lista[i - 1]!.titulo : '—'}</b></span>
            </button>
            <button type="button" className="esc-nav next" disabled={!haySiguiente} onClick={() => ir(i + 1)}>
              <span className="flex min-w-0 flex-col"><small>Siguiente</small><b className="truncate">{haySiguiente ? lista[i + 1]!.titulo : 'Fin del servicio'}</b></span>
              <Icon name="derecha" size={20} strokeWidth={2.4} />
            </button>
          </>
        )}
      </footer>

      {hoja === 'lista' && renderLista()}
      {hoja === 'ajustes' && (
        <EscHoja titulo="Ajustes del escenario" onCerrar={() => setHoja(null)}>
          <h2 className="display m-0 text-2xl font-semibold">Ajustes</h2>
          <div className="esc-ajuste"><span>Fondo</span></div>
          <div className="segmentado" role="radiogroup" aria-label="Fondo del escenario" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {([['app', 'Como la app'], ['claro', 'Claro'], ['oscuro', 'Oscuro']] as const).map(([id, nombre]) => (
              <button key={id} type="button" role="radio" aria-checked={aj.modo === id} className={aj.modo === id ? 'on' : ''} onClick={() => cambiar({ modo: id })}>{nombre}</button>
            ))}
          </div>
          <p className="m-0 text-[13px]" style={{ color: 'var(--muted)' }}>Siempre con el color que elegiste en tu perfil. “Oscuro” cansa menos la vista en un escenario con poca luz.</p>
          <div className="esc-ajuste"><span>Tamaño de la letra</span><span className="text-sm font-extrabold">{aj.tam}</span></div>
          <input type="range" min={TAM_MIN} max={TAM_MAX} step={2} value={aj.tam} aria-label="Tamaño de la letra" onChange={(e) => cambiar({ tam: Number(e.target.value) })} />
          <div className="esc-ajuste"><span>Velocidad del desplazamiento</span></div>
          <div className="segmentado" role="radiogroup" aria-label="Velocidad del desplazamiento automático" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {([1, 2, 3] as const).map((v) => <button key={v} type="button" role="radio" aria-checked={aj.velocidad === v} className={aj.velocidad === v ? 'on' : ''} onClick={() => cambiar({ velocidad: v })}>{NOMBRE_VEL[v]}</button>)}
          </div>
          <div className="esc-ajuste"><span>Mostrar acordes</span>
            <button type="button" role="switch" aria-checked={acordes} aria-label="Mostrar acordes" className={'sw' + (acordes ? ' on' : '')} onClick={() => cambiar({ acordes: !acordes })} />
          </div>
          <button type="button" className="cta" onClick={() => setHoja(null)}>Listo</button>
        </EscHoja>
      )}
    </div>
  )
}
