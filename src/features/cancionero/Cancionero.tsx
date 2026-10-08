import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useToast } from '../../components/Toast'
import { useAuth } from '../../hooks/AuthProvider'
import { useEquipo } from '../../hooks/useEquipo'
import { iniciales } from '../../lib/fechas'
import { permisos } from '../../lib/permisos'
import { relativo } from '../../lib/tiempo'
import type { Fase } from '../../lib/tipos'
import { FASES, indiceFase, infoFase } from './fases'
import { useCanciones } from './useCanciones'

type Filtro = 'todas' | Fase

export default function Cancionero() {
  const { membresia, rol } = useAuth()
  const p = permisos(rol)
  const toast = useToast()
  const c = useCanciones(membresia?.grupo_id, membresia?.id)
  const equipo = useEquipo(membresia?.grupo_id)
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [abierta, setAbierta] = useState<string | null>(null)
  const [q, setQ] = useState('')

  const conteo = useMemo(() => FASES.map((f) => c.canciones.filter((x) => x.fase === f.id).length), [c.canciones])
  const listas = conteo[FASES.length - 1] ?? 0

  const lista = useMemo(() => {
    const t = q.trim().toLowerCase()
    return c.canciones
      .filter((x) => filtro === 'todas' || x.fase === filtro)
      .filter((x) => !t || x.titulo.toLowerCase().includes(t) || (x.autor ?? '').toLowerCase().includes(t))
      .sort((a, b) => indiceFase(a.fase) - indiceFase(b.fase) || a.titulo.localeCompare(b.titulo, 'es'))
  }, [c.canciones, filtro, q])

  const nombreDe = (miembroId: string) => equipo.find((m) => m.id === miembroId)?.nombre ?? '?'
  const miParte = membresia?.descripcion

  async function avanzar(id: string, titulo: string) {
    const sig = await c.avanzar(id)
    if (!sig) return toast('No se pudo avanzar. Intenta de nuevo.')
    toast(`${titulo} pasó a ${infoFase(sig).nombre}`)
    if (filtro !== 'todas') setFiltro(sig)
  }

  async function publicar(id: string) {
    const v = await c.togglePublica(id)
    if (v === null) return toast('No se pudo cambiar. Intenta de nuevo.')
    toast(v ? 'Visible en el repertorio público' : 'Oculta del repertorio público')
  }

  async function yaMeLaSe(id: string, valor: boolean) {
    const ok = await c.marcarYaSe(id, valor)
    toast(!ok ? 'No se pudo guardar. Intenta de nuevo.' : valor ? 'El líder verá que ya te la sabes' : 'Marcada como pendiente')
  }

  return (
    <div className="relative">
      <div aria-hidden className="blob" style={{ width: 260, height: 240, right: -120, top: -100, background: 'var(--blob1)' }} />
      <div className="relative flex flex-col px-5 pt-[54px]">
        <header className="rise flex items-center gap-3.5">
          <Link to="/" className="iconbtn" aria-label="Volver al inicio"><Icon name="atras" size={20} strokeWidth={2.2} /></Link>
          <div className="flex min-w-0 grow flex-col gap-0.5">
            <h1 className="display m-0 text-[30px] leading-[1.1] font-semibold tracking-[-0.02em]">Cancionero</h1>
            <span className="text-[15px]" style={{ color: 'var(--muted)' }}>{c.canciones.length === 1 ? '1 canción' : `${c.canciones.length} canciones`} · {c.canciones.length - listas} por preparar</span>
          </div>
          {p.esLider && <Link to="/cancionero/nueva" className="iconbtn prim" aria-label="Agregar canción"><Icon name="mas" size={22} strokeWidth={2.4} /></Link>}
        </header>

        <div className="rise mt-5 flex flex-col gap-2 rounded-[20px] p-3.5" style={{ animationDelay: '90ms', background: 'var(--surface)', border: '1.5px solid var(--line)' }}>
          <span className="flex justify-between text-[13px] font-extrabold" style={{ color: 'var(--muted)' }}><span>De nueva a lista para servicio</span><span>{listas === 1 ? '1 lista' : `${listas} listas`}</span></span>
          <div className="pipe" role="img" aria-label={FASES.map((f, i) => `${f.nombre}: ${conteo[i]}`).join(', ')}>
            {FASES.map((f, i) => conteo[i]! > 0 && <span key={f.id} style={{ flexGrow: conteo[i], background: f.barra, animationDelay: `${200 + i * 60}ms` }} />)}
          </div>
        </div>

        <div className="rise field mt-3.5" style={{ animationDelay: '120ms', height: 50 }}>
          <input id="buscar" type="search" placeholder=" " value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingTop: 14, paddingLeft: 46 }} />
          <label htmlFor="buscar" style={{ top: 14, left: 46 }}>Buscar título o autor</label>
          <Icon name="buscar" size={20} style={{ position: 'absolute', left: 16, top: 14, color: 'var(--muted)' }} />
        </div>

        <div className="rise chips" role="tablist" aria-label="Filtrar por fase" style={{ animationDelay: '150ms', marginTop: 14 }}>
          {[{ id: 'todas' as const, nombre: 'Todas', n: c.canciones.length }, ...FASES.map((f, i) => ({ id: f.id as Filtro, nombre: f.nombre, n: conteo[i]! }))].map((f) => (
            <button key={f.id} type="button" role="tab" aria-selected={filtro === f.id} className={'fchip' + (filtro === f.id ? ' on' : '')} onClick={() => setFiltro(f.id)}>
              <span>{f.nombre}</span><span className="n">{f.n}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2.5 pt-2">
          {c.cargando && [0, 1, 2].map((i) => <div key={i} className="esqueleto" style={{ height: 112, background: 'var(--surface)', opacity: 0.7 }} />)}
          {c.error && <p className="rounded-2xl p-4 text-[15px] font-bold" style={{ background: 'var(--alerta-bg)', color: 'var(--alerta-fg)' }}>No pudimos cargar el cancionero. Revisa tu conexión e intenta de nuevo.</p>}
          {!c.cargando && !c.error && lista.length === 0 && (
            <div className="px-5 py-10 text-center text-[15px] font-bold" style={{ color: 'var(--muted)' }}>
              {c.canciones.length === 0 ? (p.esLider ? 'Aún no hay canciones. Agrega la primera con el botón +.' : 'Aún no hay canciones en el cancionero.') : 'No hay canciones con ese filtro.'}
            </div>
          )}

          {lista.map((s, idx) => {
            const f = infoFase(s.fase)
            const fi = indiceFase(s.fase)
            const abierto = abierta === s.id
            const ultima = c.ultima[s.id]
            const sabe = c.dominio.filter((d) => d.cancion_id === s.id && d.ya_la_se)
            const yoSe = sabe.some((d) => d.miembro_id === membresia?.id)
            const checks = c.pendientes.filter((x) => x.cancion_id === s.id && x.fase === s.fase)
            const meta = [s.autor, s.tono_original, s.bpm ? `${s.bpm} BPM` : null].filter(Boolean).join(' · ')
            return (
              <div key={s.id} className={'song' + (abierto ? ' open' : '')} style={{ animationDelay: `${Math.min(idx, 8) * 50}ms` }}>
                <button type="button" className="songhead" aria-expanded={abierto} onClick={() => setAbierta(abierto ? null : s.id)}>
                  <span className="flex min-w-0 grow flex-col gap-0.5">
                    <span className="truncate text-[17px] font-extrabold">{s.titulo}</span>
                    <span className="text-[13px]" style={{ color: 'var(--muted)' }}>{meta || 'Sin datos todavía'}</span>
                  </span>
                  <span className="ppill" style={{ background: f.bg, color: f.fg }}>{f.nombre}</span>
                </button>
                <div className="segs" aria-hidden>{FASES.map((x, i) => <i key={x.id} className={i <= fi ? 'f' : ''} />)}</div>
                <div className="flex items-center justify-between">
                  <div className="flex">
                    {sabe.slice(0, 3).map((d) => <span key={d.miembro_id} className="avm" title={`${nombreDe(d.miembro_id)} ya se la sabe`}>{iniciales(nombreDe(d.miembro_id))}</span>)}
                    {sabe.length > 3 && <span className="avm">+{sabe.length - 3}</span>}
                  </div>
                  <span className="flex items-center gap-1.5 text-xs font-bold" style={{ color: 'var(--muted)' }}>
                    {s.publica && <><Icon name="mundo" size={14} strokeWidth={2.2} /><span>En repertorio ·</span></>}
                    <span>{ultima ? `Cantada ${relativo(ultima)}` : `Agregada ${relativo(s.created_at)}`}</span>
                  </span>
                </div>

                {abierto && (
                  <div className="detail">
                    {p.esLider ? (
                      <>
                        <span className="text-[13px] font-extrabold tracking-[0.05em] uppercase" style={{ color: 'var(--muted)' }}>Pendientes de {f.nombre}</span>
                        {checks.length === 0 && <span className="px-1 text-sm" style={{ color: 'var(--muted)' }}>Sin pendientes en esta fase.</span>}
                        {checks.map((x) => (
                          <button key={x.id} type="button" role="checkbox" aria-checked={x.hecho} className={'pendiente' + (x.hecho ? ' on' : '')} onClick={() => c.togglePendiente(x.id)}>
                            <span className="pbox"><Icon name="check" size={14} strokeWidth={3} /></span>
                            <span className="lbl">{x.texto}</span>
                          </button>
                        ))}
                        <div className="flex items-center gap-3 p-1">
                          <span className="flex grow flex-col gap-px">
                            <span className="text-[15px] font-extrabold">Mostrar en repertorio público</span>
                            <span className="text-[13px]" style={{ color: 'var(--muted)' }}>Solo título y datos básicos</span>
                          </span>
                          <button type="button" role="switch" aria-checked={s.publica} aria-label="Mostrar en repertorio público" className={'sw' + (s.publica ? ' on' : '')} onClick={() => publicar(s.id)} />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex flex-col gap-1 rounded-[14px] p-3" style={{ background: 'var(--soft)' }}>
                          <span className="text-xs font-extrabold tracking-[0.05em] uppercase" style={{ color: 'var(--muted)' }}>Tu parte</span>
                          <span className="text-[15px] font-bold">{miParte ?? 'Aprende tu parte con la letra y los acordes.'}</span>
                        </div>
                        <button type="button" className={'know' + (yoSe ? ' on' : '')} aria-pressed={yoSe} onClick={() => yaMeLaSe(s.id, !yoSe)}>
                          <Icon name="check" size={18} strokeWidth={2.4} /><span>{yoSe ? 'Ya me la sé' : 'Marcar que ya me la sé'}</span>
                        </button>
                      </>
                    )}
                    <div className="flex gap-2">
                      <Link to={`/cancionero/${s.id}`} className="ghost-link grow"><Icon name="cancionero" size={18} strokeWidth={2} />Ver letra</Link>
                      {p.esLider && <Link to={`/cancionero/${s.id}/editar`} className="ghost-link grow"><Icon name="editar" size={18} strokeWidth={2} />Editar</Link>}
                    </div>
                    {p.esLider && (
                      <button type="button" className="adv" disabled={fi === FASES.length - 1} onClick={() => avanzar(s.id, s.titulo)}>
                        <span>{fi === FASES.length - 1 ? 'Lista para servicios' : `Pasar a ${FASES[fi + 1]!.nombre}`}</span>
                        {fi < FASES.length - 1 && <Icon name="derecha" size={18} strokeWidth={2.2} style={{ transform: 'none' }} />}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
