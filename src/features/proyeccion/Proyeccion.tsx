import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useToast } from '../../components/Toast'
import { useAuth } from '../../hooks/authContext'
import { aTexto } from '../../lib/diapositivas'
import { fechaLarga, hora } from '../../lib/fechas'
import { aplanar, cargarTemas, proximoServicio, useEstadoProyeccion, type ModoPantalla, type ServicioProy, type TemaProy } from './datos'

const MODOS: [ModoPantalla, string][] = [['letra', 'Letra'], ['negro', 'Negro'], ['logo', 'Logo']]

export default function Proyeccion() {
  const { membresia, perfil } = useAuth()
  const toast = useToast()
  const grupoId = membresia?.grupo_id
  const { estado, enVivo, actualizar } = useEstadoProyeccion(grupoId, perfil?.id)
  const [servicio, setServicio] = useState<ServicioProy | null | undefined>(undefined)
  const [temas, setTemas] = useState<TemaProy[]>([])
  const [error, setError] = useState(false)
  const [etiquetas, setEtiquetas] = useState(false)

  useEffect(() => {
    if (!grupoId) return
    let vivo = true
    ;(async () => {
      try {
        const s = await proximoServicio(grupoId)
        if (!vivo) return
        setServicio(s)
        if (s) setTemas(await cargarTemas(s.id))
      } catch { if (vivo) setError(true) }
    })()
    return () => { vivo = false }
  }, [grupoId])

  const lista = useMemo(() => aplanar(temas), [temas])
  // La posición actual solo vale si la pantalla está en este mismo servicio
  const enEste = servicio && estado.servicio_id === servicio.id
  const actual = useMemo(() => {
    if (!enEste) return -1
    const ti = temas.findIndex((t) => t.itemId === estado.item_id)
    if (ti < 0) return -1
    const si = Math.min(estado.diapositiva, temas[ti]!.slides.length - 1)
    return lista.findIndex((x) => x.ti === ti && x.si === si)
  }, [enEste, temas, estado.item_id, estado.diapositiva, lista])

  const ir = useCallback(async (i: number, modo: ModoPantalla = 'letra') => {
    const destino = lista[i]
    if (!servicio || !destino) return
    const ok = await actualizar({ servicio_id: servicio.id, item_id: temas[destino.ti]!.itemId, diapositiva: destino.si, modo })
    if (!ok) toast('No se pudo cambiar la pantalla. Revisa la conexión.')
  }, [lista, servicio, temas, actualizar, toast])

  const mover = useCallback((d: number) => {
    const i = actual < 0 ? (d > 0 ? 0 : lista.length - 1) : actual + d
    if (i >= 0 && i < lista.length) void ir(i)
  }, [actual, lista.length, ir])

  async function poner(modo: ModoPantalla) {
    if (modo === 'letra' && actual < 0) return void ir(0)
    const ok = await actualizar({ modo })
    if (!ok) toast('No se pudo cambiar la pantalla. Revisa la conexión.')
  }

  // Flechas y espacio, como en cualquier programa de proyección
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); mover(1) }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); mover(-1) }
      else if (e.key.toLowerCase() === 'b') void poner('negro')
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  function exportar() {
    const texto = aTexto(temas.map((t) => ({ titulo: t.titulo, letra: t.letra })), etiquetas)
    const url = URL.createObjectURL(new Blob([texto], { type: 'text/plain;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `letras-${servicio ? servicio.fecha.slice(0, 10) : 'servicio'}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast('Letras exportadas')
  }

  const temaActual = actual >= 0 ? temas[lista[actual]!.ti]! : null
  const slide = actual >= 0 ? temaActual!.slides[lista[actual]!.si]! : null
  const sig = actual >= 0 && actual + 1 < lista.length ? lista[actual + 1]! : null
  const siguiente = sig ? temas[sig.ti]!.slides[sig.si]! : null

  return (
    <div className="relative">
      <div aria-hidden className="blob" style={{ width: 260, height: 240, right: -120, top: -100, background: 'var(--blob1)' }} />
      <div className="relative flex flex-col gap-3.5 px-5 pt-[54px]">
        <header className="rise flex items-center gap-3">
          <Link to="/" className="iconbtn" aria-label="Volver al inicio"><Icon name="atras" size={20} strokeWidth={2.2} /></Link>
          <div className="flex min-w-0 grow flex-col gap-0.5">
            <h1 className="display m-0 text-[30px] leading-[1.1] font-semibold tracking-[-0.02em]">Proyección</h1>
            <span className="flex items-center gap-1.5 truncate text-sm font-bold" style={{ color: 'var(--muted)' }}>
              <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: enVivo ? 'var(--primary)' : 'var(--danger)' }} />
              {enVivo ? 'Conectado en vivo' : 'Sin conexión en vivo'}
            </span>
          </div>
          <Link to="/proyeccion/pantalla" target="_blank" className="more" rel="noopener"><Icon name="proyeccion" size={18} strokeWidth={2} />Pantalla</Link>
        </header>

        {servicio === undefined && !error ? (
          <div className="esqueleto h-40" />
        ) : error ? (
          <p className="m-0 rounded-2xl p-4" style={{ background: 'var(--alerta-bg)', color: 'var(--alerta-fg)' }}>No se pudo cargar el servicio.</p>
        ) : !servicio || temas.length === 0 ? (
          <p className="m-0 rounded-2xl p-4 text-base" style={{ background: 'var(--soft)', color: 'var(--muted)' }}>
            {!servicio ? 'No hay un servicio próximo. El líder lo crea en Servicios.' : 'El próximo servicio todavía no tiene canciones.'}
          </p>
        ) : (
          <>
            <p className="m-0 px-1 text-sm font-bold" style={{ color: 'var(--muted)' }}>{servicio.tipo} · {fechaLarga(servicio.fecha)} · {hora(servicio.fecha)}</p>

            <div role="group" aria-label="Qué se ve en la pantalla" className="flex gap-2">
              {MODOS.map(([m, t]) => (
                <button key={m} type="button" aria-pressed={estado.modo === m} className={estado.modo === m ? 'cbtn yes' : 'cbtn no'} style={estado.modo === m ? undefined : { border: '1.5px solid var(--line)' }} onClick={() => poner(m)}>{t}</button>
              ))}
            </div>

            <section aria-label="Ahora en pantalla" className="flex flex-col gap-2 rounded-3xl p-4" style={{ background: '#000', color: '#fff' }}>
              <span className="text-xs font-extrabold tracking-wider uppercase" style={{ color: '#9baea0' }}>
                {estado.modo === 'negro' ? 'Pantalla en negro' : estado.modo === 'logo' ? 'Mostrando el logo' : temaActual ? `${temaActual.titulo}${slide?.etiqueta ? ` · ${slide.etiqueta}` : ''}` : 'Elige una diapositiva'}
              </span>
              <div className="min-h-[96px] text-center text-xl leading-snug font-bold" style={{ opacity: estado.modo === 'letra' ? 1 : 0.35 }}>
                {slide ? slide.lineas.map((l, i) => <div key={i}>{l}</div>) : <span style={{ color: '#9baea0' }}>—</span>}
              </div>
              {siguiente && <div className="border-t pt-2 text-center text-sm" style={{ borderColor: '#2a3a30', color: '#9baea0' }}>Sigue: {siguiente.lineas[0]}</div>}
            </section>

            <div className="flex gap-2.5">
              <button type="button" className="esc-nav !h-16 !justify-center" style={{ background: 'var(--surface)', color: 'var(--ink)' }} disabled={actual <= 0} onClick={() => mover(-1)}><Icon name="atras" size={20} strokeWidth={2.4} />Anterior</button>
              <button type="button" className="esc-nav next !h-16 !justify-center" style={{ background: 'var(--primary)', color: 'var(--on-primary)' }} disabled={actual >= lista.length - 1 && actual >= 0} onClick={() => mover(1)}>Siguiente<Icon name="derecha" size={20} strokeWidth={2.4} /></button>
            </div>

            <h2 className="display m-0 px-1 pt-1 text-xl font-semibold">Canciones</h2>
            {temas.map((t, ti) => {
              const activa = actual >= 0 && lista[actual]!.ti === ti
              return (
                <div key={t.itemId} className="rounded-3xl border-[1.5px] p-3" style={{ background: 'var(--surface)', borderColor: activa ? 'var(--primary)' : 'var(--line)' }}>
                  <div className="mb-2 flex items-baseline justify-between gap-2 px-1">
                    <span className="truncate text-base font-extrabold">{ti + 1}. {t.titulo}</span>
                    {t.momento && <span className="shrink-0 text-xs font-bold" style={{ color: 'var(--muted)' }}>{t.momento}</span>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {t.slides.map((s, si) => {
                      const i = lista.findIndex((x) => x.ti === ti && x.si === si)
                      const on = i === actual
                      return (
                        <button key={si} type="button" className="more !h-auto min-h-11 max-w-full !py-1.5 text-left" aria-label={`${t.titulo}, diapositiva ${si + 1}`} aria-current={on} style={on ? { background: 'var(--primary)', borderColor: 'var(--primary)', color: 'var(--on-primary)' } : undefined} onClick={() => ir(i)}>
                          <span className="flex flex-col"><small className="opacity-70">{s.etiqueta ?? `${si + 1}`}</small><span className="max-w-[210px] truncate">{s.lineas[0]}</span></span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            <h2 className="display m-0 px-1 pt-2 text-xl font-semibold">Para ProPresenter o EasyWorship</h2>
            <p className="m-0 px-1 text-sm" style={{ color: 'var(--muted)' }}>Descarga las letras del servicio en texto: una línea en blanco separa cada diapositiva. En tu programa usa importar texto.</p>
            <div className="flex items-center gap-3 px-1">
              <button type="button" role="switch" aria-checked={etiquetas} aria-label="Incluir nombre de cada sección" className={'sw' + (etiquetas ? ' on' : '')} onClick={() => setEtiquetas(!etiquetas)} />
              <span className="text-[15px] font-extrabold">Incluir Verso / Coro</span>
            </div>
            <button type="button" className="cta" onClick={exportar}>Descargar letras (.txt)</button>
            <p className="m-0 px-1 pb-2 text-[13px]" style={{ color: 'var(--muted)' }}>En la computadora: flechas o espacio para avanzar, B para pantalla en negro.</p>
          </>
        )}
      </div>
    </div>
  )
}
