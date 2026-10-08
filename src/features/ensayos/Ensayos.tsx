import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useToast } from '../../components/Toast'
import { useAuth } from '../../hooks/authContext'
import { useEquipo } from '../../hooks/useEquipo'
import { diaNum, diaSemana, fechaCorta, fechaLarga, hora, iniciales, mesCorto } from '../../lib/fechas'
import { permisos } from '../../lib/permisos'
import HojaCancionEnsayo from './HojaCancionEnsayo'
import HojaEnsayo from './HojaEnsayo'
import { useEnsayos, type CancionEnsayo } from './useEnsayos'

const urlSegura = (u: string | null) => (u && /^https?:\/\//i.test(u) ? u : null)

export default function Ensayos() {
  const { membresia, rol } = useAuth()
  const p = permisos(rol)
  const toast = useToast()
  const e = useEnsayos(membresia?.grupo_id, membresia?.id, p.verCancionero)
  const equipo = useEquipo(membresia?.grupo_id)
  const [hojaEnsayo, setHojaEnsayo] = useState<'nuevo' | 'editar' | null>(null)
  const [hojaCancion, setHojaCancion] = useState<'agregar' | CancionEnsayo | null>(null)
  const [borrador, setBorrador] = useState('')

  const gente = equipo.filter((m) => m.rol !== 'alumno')
  const nombreDe = (id: string) => equipo.find((m) => m.id === id)?.nombre ?? '—'
  const miVa = membresia ? e.asistencia[membresia.id] : undefined
  const confirmaron = gente.filter((m) => e.asistencia[m.id] === true).length
  const hechas = e.canciones.filter((c) => e.repaso.has(c.cancion_id)).length
  const a = e.actual
  const servicio = a?.servicio_id ? e.servicios.find((s) => s.id === a.servicio_id) : null

  async function responder(va: boolean) {
    const nuevo = miVa === va ? null : va
    const ok = await e.responder(nuevo)
    toast(!ok ? 'No se pudo guardar. Intenta de nuevo.' : nuevo === true ? 'Confirmaste tu asistencia' : nuevo === false ? 'Avisaste que no puedes' : 'Respuesta borrada')
  }

  async function nota(ev: FormEvent) {
    ev.preventDefault()
    const t = borrador.trim()
    if (!t) return
    if (await e.agregarNota(t)) setBorrador('')
    else toast('No se pudo guardar la nota. Intenta de nuevo.')
  }

  return (
    <div className="relative">
      <div aria-hidden className="blob" style={{ width: 260, height: 240, right: -120, top: -100, background: 'var(--blob1)' }} />
      <div className="relative flex flex-col gap-3.5 px-5 pt-[54px]">
        <header className="rise flex items-center gap-3">
          <Link to="/" className="iconbtn" aria-label="Volver al inicio"><Icon name="atras" size={20} strokeWidth={2.2} /></Link>
          <div className="flex min-w-0 grow flex-col gap-0.5">
            <h1 className="display m-0 text-[30px] leading-[1.1] font-semibold tracking-[-0.02em]">Ensayos</h1>
            <span className="truncate text-sm font-bold" style={{ color: 'var(--muted)' }}>{membresia?.grupo.nombre}</span>
          </div>
          {p.esLider && <button type="button" className="iconbtn prim" aria-label="Convocar nuevo ensayo" onClick={() => setHojaEnsayo('nuevo')}><Icon name="mas" size={20} strokeWidth={2.4} /></button>}
        </header>

        {e.proximos.length > 1 && (
          <div className="rise svc" role="tablist" aria-label="Elegir ensayo" style={{ animationDelay: '60ms' }}>
            {e.proximos.map((x) => (
              <button key={x.id} type="button" role="tab" aria-selected={x.id === e.seleccion} className={'schip' + (x.id === e.seleccion ? ' on' : '')} onClick={() => e.setSeleccion(x.id)}>
                <small>{diaSemana(x.fecha)}</small><b>{diaNum(x.fecha)} {mesCorto(x.fecha)}</b>
              </button>
            ))}
          </div>
        )}

        {e.cargando ? (
          <div className="esqueleto h-40" />
        ) : e.error ? (
          <p className="m-0 rounded-2xl p-4" style={{ background: 'var(--alerta-bg)', color: 'var(--alerta-fg)' }}>No se pudieron cargar los ensayos.</p>
        ) : !a ? (
          <p className="m-0 rounded-2xl p-4 text-base" style={{ background: 'var(--soft)', color: 'var(--muted)' }}>
            {p.esLider ? 'No hay ensayos convocados. Toca + para convocar el primero.' : 'No hay ensayos convocados todavía. Cuando tu líder convoque uno, aparecerá aquí.'}
          </p>
        ) : (
          <>
            <section className="rise turn" aria-label="Próximo ensayo" style={{ animationDelay: '90ms' }}>
              <div className="flex items-center gap-3.5">
                <span className="fechita">
                  <span className="text-[11px] font-extrabold uppercase" style={{ color: 'var(--primary)' }}>{diaSemana(a.fecha)}</span>
                  <span className="mt-[3px] text-[22px] font-extrabold">{diaNum(a.fecha)}</span>
                  <span className="text-[11px] font-extrabold uppercase" style={{ color: 'var(--muted)' }}>{mesCorto(a.fecha)}</span>
                </span>
                <span className="flex min-w-0 grow flex-col gap-[3px]">
                  <span className="eyebrow">{a.id === e.proximos[0]?.id ? 'Próximo ensayo' : 'Ensayo'}</span>
                  <span className="text-[17px] font-extrabold">{hora(a.fecha)}{a.lugar ? ` · ${a.lugar}` : ''}</span>
                  {servicio && <span className="text-sm" style={{ color: 'var(--muted)' }}>Para el {fechaLarga(servicio.fecha).toLowerCase()}</span>}
                </span>
                {p.esLider && <button type="button" className="iconbtn" aria-label="Editar ensayo" onClick={() => setHojaEnsayo('editar')}><Icon name="editar" size={18} strokeWidth={2} /></button>}
              </div>

              <div className="flex items-center gap-3">
                <div className="flex flex-wrap" aria-hidden>
                  {gente.slice(0, 8).map((m, i) => {
                    const v = e.asistencia[m.id]
                    return (
                      <span key={m.id} className="av" style={{ marginLeft: i ? -8 : 0, background: v === true ? 'var(--primary)' : 'var(--surface)', color: v === true ? 'var(--on-primary)' : 'var(--ink)', opacity: v === false ? 0.4 : 1, borderStyle: v == null ? 'dashed' : 'solid', borderColor: 'var(--line)' }}>{iniciales(m.nombre)}</span>
                    )
                  })}
                </div>
                <span className="text-sm font-bold" style={{ color: 'var(--muted)' }}>{confirmaron} de {gente.length} confirmaron</span>
              </div>

              <div role="group" aria-label="¿Vas al ensayo?" className="flex gap-2">
                <button type="button" className={miVa === true ? 'confirmed' : 'cbtn yes'} aria-pressed={miVa === true} onClick={() => responder(true)}><Icon name="check" size={18} strokeWidth={2.4} />{miVa === true ? 'Voy' : 'Voy al ensayo'}</button>
                <button type="button" className={miVa === false ? 'confirmed' : 'cbtn no'} aria-pressed={miVa === false} onClick={() => responder(false)}>No puedo</button>
              </div>
            </section>

            {p.verCancionero && (
              <>
                <div className="flex items-baseline justify-between px-1 pt-1">
                  <h2 className="display m-0 text-xl font-semibold">Qué vamos a ensayar</h2>
                  <div className="flex items-center gap-2">
                    {e.canciones.length > 0 && <span className="text-sm font-bold" style={{ color: 'var(--muted)' }}>Repasaste {hechas} de {e.canciones.length}</span>}
                    {p.esLider && <button type="button" className="more" aria-label="Agregar canción al ensayo" onClick={() => { void e.cargarCatalogo(); setHojaCancion('agregar') }}><Icon name="mas" size={16} strokeWidth={2.4} />Agregar</button>}
                  </div>
                </div>
                {e.canciones.length === 0 ? (
                  <p className="m-0 rounded-2xl p-4 text-[15px]" style={{ background: 'var(--soft)', color: 'var(--muted)' }}>{p.esLider ? 'Todavía no elegiste canciones para este ensayo.' : 'El líder aún no define qué canciones se ensayan.'}</p>
                ) : e.canciones.map((c) => {
                  const hecha = e.repaso.has(c.cancion_id)
                  const audio = urlSegura(c.audio)
                  const meta = [c.categoria === 'alabanza' ? 'Alabanza' : c.categoria === 'adoracion' ? 'Adoración' : null, c.tono && `Tono ${c.tono}`, c.bpm && `${c.bpm} BPM`].filter(Boolean).join(' · ')
                  return (
                    <div key={c.cancion_id} className="rise flex flex-col gap-2.5 rounded-3xl border-[1.5px] p-3.5" style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}>
                      <div className="flex items-center gap-3">
                        <span className="flex min-w-0 grow flex-col">
                          <span className="truncate text-[17px] font-extrabold">{c.titulo}</span>
                          {meta && <span className="text-sm" style={{ color: 'var(--muted)' }}>{meta}</span>}
                        </span>
                        {p.esLider && <button type="button" className="iconbtn" aria-label={`Editar ${c.titulo}`} onClick={() => setHojaCancion(c)}><Icon name="editar" size={18} strokeWidth={2} /></button>}
                        <button type="button" role="checkbox" aria-checked={hecha} aria-label={`Ya repasé ${c.titulo}`} className="iconbtn" style={hecha ? { background: 'var(--primary)', color: 'var(--on-primary)' } : undefined} onClick={async () => { if (!(await e.alternarRepaso(c.cancion_id))) toast('No se pudo guardar. Intenta de nuevo.') }}><Icon name="check" size={18} strokeWidth={2.8} /></button>
                      </div>
                      {c.foco && <p className="m-0 rounded-xl px-3 py-2 text-sm font-semibold" style={{ background: 'var(--soft)' }}>{c.foco}</p>}
                      <div className="flex gap-2">
                        <Link to={`/cancionero/${c.cancion_id}`} className="ghost-link">Ver letra</Link>
                        {audio && <a href={audio} target="_blank" rel="noopener noreferrer" className="ghost-link"><Icon name="audio" size={18} strokeWidth={2} />Guía de audio</a>}
                      </div>
                    </div>
                  )
                })}
              </>
            )}

            <div className="flex items-baseline justify-between px-1 pt-1">
              <h2 className="display m-0 text-xl font-semibold">Notas del ensayo</h2>
              <span className="text-[13px] font-bold" style={{ color: 'var(--muted)' }}>Las ve todo el grupo</span>
            </div>
            {e.notas.map((n) => {
              const mia = n.miembro_id === membresia?.id
              return (
                <div key={n.id} className="flex items-start gap-3 rounded-2xl p-3" style={{ background: 'var(--surface)', border: '1.5px solid var(--line)' }}>
                  <span className="av shrink-0" style={{ background: 'var(--soft)', color: 'var(--primary)' }}>{iniciales(nombreDe(n.miembro_id))}</span>
                  <span className="flex min-w-0 grow flex-col">
                    <span className="text-sm font-extrabold">{nombreDe(n.miembro_id)} <span className="font-semibold" style={{ color: 'var(--muted)' }}>· {fechaCorta(n.created_at)}</span></span>
                    <span className="text-[15px] break-words">{n.texto}</span>
                  </span>
                  {(mia || p.esLider) && <button type="button" className="undo !h-9 !px-2" aria-label="Borrar nota" onClick={async () => { if (!(await e.borrarNota(n.id))) toast('No se pudo borrar.') }}><Icon name="borrar" size={16} strokeWidth={2} /></button>}
                </div>
              )
            })}
            <form onSubmit={nota} className="flex gap-2">
              <label htmlFor="nota" className="sr-only">Nueva nota</label>
              <input id="nota" type="text" autoComplete="off" maxLength={1000} placeholder="Agregar una nota…" value={borrador} onChange={(ev) => setBorrador(ev.target.value)} className="h-[52px] min-w-0 grow rounded-2xl border-[1.5px] px-4 text-base outline-none focus:shadow-[0_0_0_5px_var(--ring)]" style={{ borderColor: 'var(--line)', background: 'var(--surface)', color: 'var(--ink)' }} />
              <button type="submit" className="iconbtn prim !h-[52px] !w-[52px]" aria-label="Agregar nota"><Icon name="derecha" size={20} strokeWidth={2.4} /></button>
            </form>
          </>
        )}

        {e.anterior && (
          <p className="m-0 flex items-center gap-2 px-1 pb-2 text-sm" style={{ color: 'var(--muted)' }}>
            <Icon name="reloj" size={18} strokeWidth={2} /><span><b style={{ color: 'var(--ink)' }}>Ensayo anterior</b> · {fechaCorta(e.anterior.fecha)}{e.anterior.total > 0 ? ` · asistieron ${e.anterior.fueron} de ${e.anterior.total}` : ''}</span>
          </p>
        )}
      </div>

      {p.esLider && (
        <>
          <HojaEnsayo abierta={hojaEnsayo !== null} onCerrar={() => setHojaEnsayo(null)} inicial={hojaEnsayo === 'editar' ? a : null} servicios={e.servicios}
            onGuardar={(d) => (hojaEnsayo === 'editar' && a ? e.actualizarEnsayo(a.id, d) : e.crearEnsayo(d))}
            onBorrar={hojaEnsayo === 'editar' && a ? () => e.borrarEnsayo(a.id) : undefined} />
          <HojaCancionEnsayo abierta={hojaCancion !== null} onCerrar={() => setHojaCancion(null)} editando={hojaCancion && hojaCancion !== 'agregar' ? hojaCancion : null}
            catalogo={e.catalogo} yaEstan={new Set(e.canciones.map((c) => c.cancion_id))} onGuardar={e.guardarCancion} onQuitar={e.quitarCancion} />
        </>
      )}
    </div>
  )
}
