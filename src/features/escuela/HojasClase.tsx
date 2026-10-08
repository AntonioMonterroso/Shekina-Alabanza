import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import Hoja from '../../components/Hoja'
import Icon from '../../components/Icon'
import type { Integrante } from '../../hooks/useEquipo'
import { aInputLocal, desdeInputLocal, fechaCorta } from '../../lib/fechas'
import { ROL_LABEL } from '../../lib/tipos'
import Comentarios from './Comentarios'
import ProgresoAlumno from './ProgresoAlumno'
import { actualizarSesion, cargarFicha, guardarFicha, ponerTutor, quitarTutor, type Asistencia, type Curso, type EstadoAsistencia, type Practica, type Sesion } from './api'

const ESTADOS: [EstadoAsistencia, string][] = [['presente', 'Presente'], ['ausente', 'Ausente'], ['justificado', 'Justificado']]

// ---------------- Asignar práctica ----------------
interface PropsPractica {
  practica: Practica | 'nueva' | null
  alumnos: Integrante[]
  semana: string
  claseId: string
  onCerrar: () => void
  onGuardar: (d: Omit<Practica, 'id'>, id?: string) => Promise<boolean>
  onBorrar: (id: string) => Promise<boolean>
}

function FormPractica({ practica, alumnos, semana, claseId, onCerrar, onGuardar, onBorrar }: Omit<PropsPractica, 'practica'> & { practica: Practica | null }) {
  const [titulo, setTitulo] = useState(practica?.titulo ?? '')
  const [detalle, setDetalle] = useState(practica?.detalle ?? '')
  const [minutos, setMinutos] = useState(practica?.minutos_meta?.toString() ?? '15')
  const [para, setPara] = useState(practica?.alumno_id ?? '')
  const [enlace, setEnlace] = useState(practica?.enlace ?? '')
  const [bpm, setBpm] = useState(practica?.bpm?.toString() ?? '')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const tempo = bpm ? Number(bpm) : null
    if (tempo !== null && !(Number.isInteger(tempo) && tempo >= 30 && tempo <= 240)) return setError('El tempo va de 30 a 240 BPM.')
    if (!titulo.trim()) return setError('Escribe qué deben practicar.')
    const m = minutos ? Number(minutos) : null
    if (m !== null && !(Number.isInteger(m) && m >= 1 && m <= 600)) return setError('Los minutos van de 1 a 600.')
    if (enlace.trim() && !/^https?:\/\//i.test(enlace.trim())) return setError('El enlace debe empezar con http:// o https://')
    setGuardando(true)
    const ok = await onGuardar({ clase_id: claseId, alumno_id: para || null, semana, titulo: titulo.trim(), detalle: detalle.trim() || null, minutos_meta: m, enlace: enlace.trim() || null, bpm: tempo }, practica?.id)
    setGuardando(false)
    if (!ok) return setError('No se pudo guardar. Intenta de nuevo.')
    onCerrar()
  }

  async function borrar() {
    setGuardando(true)
    const ok = await onBorrar(practica!.id)
    setGuardando(false)
    if (!ok) return setError('No se pudo borrar. Intenta de nuevo.')
    onCerrar()
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-3">
      <h2 className="display m-0 mx-1 text-2xl font-semibold">{practica ? 'Editar práctica' : 'Práctica de la semana'}</h2>
      <div className="field"><input id="p-titulo" type="text" placeholder=" " value={titulo} maxLength={120} onChange={(e) => { setTitulo(e.target.value); setError('') }} /><label htmlFor="p-titulo">Qué practicar (ej. Escala de Do mayor)</label></div>
      <textarea className="letra-editor" style={{ fontFamily: 'inherit', fontSize: 16 }} rows={3} maxLength={1000} value={detalle} onChange={(e) => setDetalle(e.target.value)} placeholder="Detalles o instrucciones (opcional)" aria-label="Detalles" />
      <div className="grid grid-cols-2 gap-3">
        <div className="field"><input id="p-min" type="number" inputMode="numeric" placeholder=" " value={minutos} onChange={(e) => setMinutos(e.target.value)} /><label htmlFor="p-min">Minutos al día</label></div>
        <label className="campo-sel"><span>Para</span>
          <select value={para} onChange={(e) => setPara(e.target.value)}><option value="">Toda la clase</option>{alumnos.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select>
        </label>
      </div>
      <div className="field"><input id="p-bpm" type="number" inputMode="numeric" placeholder=" " value={bpm} onChange={(e) => { setBpm(e.target.value); setError('') }} /><label htmlFor="p-bpm">Tempo sugerido, BPM (opcional)</label></div>
      <div className="field"><input id="p-enlace" type="url" inputMode="url" placeholder=" " value={enlace} onChange={(e) => { setEnlace(e.target.value); setError('') }} /><label htmlFor="p-enlace">Enlace de apoyo (video, audio…)</label></div>
      <span role="status" className="min-h-5 px-1 text-sm font-semibold" style={{ color: 'var(--danger)' }}>{error}</span>
      <button type="submit" className="cta" disabled={guardando}>{guardando ? <span className="spinner" aria-label="Guardando" /> : practica ? 'Guardar cambios' : 'Dejar práctica'}</button>
      {practica && <button type="button" className="undo self-center" style={{ color: 'var(--danger)' }} disabled={guardando} onClick={borrar}>Borrar práctica</button>}
    </form>
  )
}

export function HojaPractica({ practica, ...resto }: PropsPractica) {
  return (
    <Hoja titulo="Práctica" abierta={practica !== null} onCerrar={resto.onCerrar}>
      {practica !== null && <FormPractica key={practica === 'nueva' ? 'nueva' : practica.id} practica={practica === 'nueva' ? null : practica} {...resto} />}
    </Hoja>
  )
}

// ---------------- Pasar lista ----------------
interface PropsAsistencia {
  sesion: Sesion | null
  alumnos: Integrante[]
  asistencia: Asistencia[]
  onCerrar: () => void
  onMarcar: (sesionId: string, alumnoId: string, estado: EstadoAsistencia | null) => Promise<boolean>
  onBorrar: (sesionId: string) => Promise<boolean>
  onCambio: () => Promise<void>
}

function ContenidoAsistencia({ sesion, alumnos, asistencia, onCerrar, onMarcar, onBorrar, onCambio }: Omit<PropsAsistencia, 'sesion'> & { sesion: Sesion }) {
  const [tema, setTema] = useState(sesion.tema ?? '')
  const [fecha, setFecha] = useState(aInputLocal(sesion.fecha))
  const [error, setError] = useState('')
  const [confirmar, setConfirmar] = useState(false)
  const estado = (a: string) => asistencia.find((x) => x.sesion_id === sesion.id && x.alumno_id === a)?.estado ?? null

  async function marcar(a: string, e: EstadoAsistencia) {
    const nuevo = estado(a) === e ? null : e // tocar de nuevo lo quita
    if (await onMarcar(sesion.id, a, nuevo)) await onCambio(); else setError('No se pudo guardar. Intenta de nuevo.')
  }
  async function todos() {
    for (const a of alumnos) if (estado(a.id) === null) await onMarcar(sesion.id, a.id, 'presente')
    await onCambio()
  }
  async function guardarDatos() {
    const nuevoTema = tema.trim() || null
    const nuevaFecha = fecha ? desdeInputLocal(fecha) : sesion.fecha
    if (nuevoTema === (sesion.tema ?? null) && nuevaFecha === new Date(sesion.fecha).toISOString()) return
    if (await actualizarSesion(sesion.id, { tema: nuevoTema, fecha: nuevaFecha })) await onCambio()
  }
  async function borrar() {
    if (await onBorrar(sesion.id)) onCerrar(); else { setConfirmar(false); setError('No se pudo borrar. Intenta de nuevo.') }
  }

  if (confirmar) {
    return (
      <>
        <h2 className="display m-0 mx-1 text-2xl font-semibold">¿Borrar esta clase?</h2>
        <p className="m-0 mx-1 text-[15px]" style={{ color: 'var(--muted)' }}>Se pierde su asistencia. No se puede deshacer.</p>
        <div className="flex gap-2.5">
          <button type="button" className="ghost-link grow" onClick={() => setConfirmar(false)}>Cancelar</button>
          <button type="button" className="adv grow" style={{ background: 'var(--danger)', color: 'var(--bg)' }} onClick={borrar}>Borrar</button>
        </div>
      </>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="display m-0 mx-1 text-2xl font-semibold">Pasar lista</h2>
      <label className="campo-sel"><span>Fecha y hora</span><input type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)} onBlur={guardarDatos} style={{ border: 0, background: 'transparent', color: 'var(--ink)', font: 'inherit', fontSize: 17, outline: 'none', padding: 0 }} /></label>
      <div className="field"><input id="s-tema" type="text" placeholder=" " value={tema} maxLength={120} onChange={(e) => setTema(e.target.value)} onBlur={guardarDatos} /><label htmlFor="s-tema">Tema de la clase (opcional)</label></div>
      {alumnos.length === 0 ? <p className="m-0 text-[15px]" style={{ color: 'var(--muted)' }}>Esta clase todavía no tiene alumnos inscritos.</p> : (
        <>
          <button type="button" className="ghost-link self-start" onClick={todos}><Icon name="check" size={18} strokeWidth={2.4} />Marcar a todos presentes</button>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {alumnos.map((a) => (
              <li key={a.id} className="flex flex-col gap-1.5 rounded-2xl p-2.5" style={{ background: 'var(--soft)' }}>
                <span className="px-1 text-[15px] font-extrabold">{a.nombre}</span>
                <div className="grid grid-cols-3 gap-1.5" role="group" aria-label={`Asistencia de ${a.nombre}`}>
                  {ESTADOS.map(([e, t]) => {
                    const on = estado(a.id) === e
                    return <button key={e} type="button" aria-pressed={on} className="more !h-11 justify-center !px-1 !text-[13px]" style={on ? { background: e === 'presente' ? 'var(--primary)' : e === 'ausente' ? 'var(--danger)' : 'var(--c-ambar-fg)', borderColor: 'transparent', color: 'var(--on-primary)' } : undefined} onClick={() => marcar(a.id, e)}>{t}</button>
                  })}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      <span role="status" className="min-h-5 px-1 text-sm font-semibold" style={{ color: 'var(--danger)' }}>{error}</span>
      <button type="button" className="cta" onClick={onCerrar}>Listo</button>
      <button type="button" className="undo self-center" style={{ color: 'var(--danger)' }} onClick={() => setConfirmar(true)}>Borrar esta clase</button>
    </div>
  )
}

export function HojaAsistencia({ sesion, ...resto }: PropsAsistencia) {
  return (
    <Hoja titulo="Pasar lista" abierta={sesion !== null} onCerrar={resto.onCerrar}>
      {sesion && <ContenidoAsistencia key={sesion.id} sesion={sesion} {...resto} />}
    </Hoja>
  )
}

// ---------------- Agregar alumnos ----------------
interface PropsAgregar {
  abierta: boolean
  candidatos: Integrante[]
  onCerrar: () => void
  onInscribir: (alumnoId: string) => Promise<boolean>
}

function ContenidoAgregar({ candidatos, onCerrar, onInscribir }: Omit<PropsAgregar, 'abierta'>) {
  const [q, setQ] = useState('')
  const [hechos, setHechos] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const lista = candidatos.filter((c) => !hechos.has(c.id) && (!q.trim() || c.nombre.toLowerCase().includes(q.trim().toLowerCase())))

  async function agregar(id: string) {
    if (await onInscribir(id)) setHechos((h) => new Set(h).add(id)); else setError('No se pudo inscribir. Intenta de nuevo.')
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="display m-0 mx-1 text-2xl font-semibold">Agregar alumnos</h2>
      <div className="field"><input id="a-q" type="search" placeholder=" " value={q} onChange={(e) => setQ(e.target.value)} /><label htmlFor="a-q">Buscar por nombre</label></div>
      {hechos.size > 0 && <p className="m-0 px-1 text-sm font-bold" style={{ color: 'var(--primary)' }}>{hechos.size} {hechos.size === 1 ? 'agregado' : 'agregados'} a la clase</p>}
      <div className="flex max-h-[34dvh] flex-col gap-1.5 overflow-y-auto">
        {lista.length === 0 && <p className="m-0 p-2 text-sm" style={{ color: 'var(--muted)' }}>No hay más personas para agregar.</p>}
        {lista.map((c) => (
          <button key={c.id} type="button" className="more !h-auto min-h-11 justify-between !py-2" onClick={() => agregar(c.id)}>
            <span className="flex flex-col text-left"><span>{c.nombre}</span><small className="font-semibold opacity-70">{ROL_LABEL[c.rol]}</small></span><Icon name="mas" size={18} strokeWidth={2.4} />
          </button>
        ))}
      </div>
      <p className="m-0 px-1 text-[13px]" style={{ color: 'var(--muted)' }}>¿No aparece? Primero créale su usuario en <Link to="/equipo" className="font-extrabold">Equipo</Link> con el rol Alumno (o Tutor para su papá o mamá).</p>
      <span role="status" className="min-h-5 px-1 text-sm font-semibold" style={{ color: 'var(--danger)' }}>{error}</span>
      <button type="button" className="cta" onClick={onCerrar}>Listo</button>
    </div>
  )
}

export function HojaAgregarAlumno({ abierta, ...resto }: PropsAgregar) {
  return <Hoja titulo="Agregar alumnos" abierta={abierta} onCerrar={resto.onCerrar}>{abierta && <ContenidoAgregar {...resto} />}</Hoja>
}

// ---------------- Ficha del alumno ----------------
interface PropsAlumno {
  alumno: Integrante | null
  tutoresPosibles: Integrante[]
  nombreDe: (id: string) => string
  /** solo la coordinación edita la ficha, los tutores y la inscripción */
  puedeEditar: boolean
  /** el maestro externo no ve la ficha (nacimiento, meta, tutores) de los alumnos */
  verFicha: boolean
  /** si quien mira puede escribir comentarios a este alumno */
  escribir?: { claseId: string; autorId: string; puedeBorrarTodos: boolean }
  /** curso de la clase: de ahí salen los niveles */
  curso: Curso | null
  /** un líder puede pasarlo al equipo */
  puedePasar: boolean
  onPasar: (alumnoId: string) => void
  onCerrar: () => void
  onQuitar: (alumnoId: string) => Promise<boolean>
}

const edad = (nac: string) => Math.floor((Date.now() - new Date(`${nac}T12:00:00Z`).getTime()) / (365.25 * 86_400_000))

function ContenidoAlumno({ alumno, tutoresPosibles, nombreDe, puedeEditar, verFicha, escribir, curso, puedePasar, onPasar, onCerrar, onQuitar }: Omit<PropsAlumno, 'alumno'> & { alumno: Integrante }) {
  const [nacimiento, setNacimiento] = useState('')
  const [objetivo, setObjetivo] = useState('')
  const [tutores, setTutores] = useState<string[]>([])
  const [nuevoTutor, setNuevoTutor] = useState('')
  const [cargado, setCargado] = useState(false)
  const [error, setError] = useState('')
  const [quitando, setQuitando] = useState(false)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!verFicha) { setCargado(true); return }
    void cargarFicha(alumno.id).then(({ perfil, tutores: t }) => {
      setNacimiento(perfil?.nacimiento ?? ''); setObjetivo(perfil?.objetivo ?? ''); setTutores(t); setCargado(true)
    })
  }, [alumno.id, verFicha])

  async function guardar() {
    setGuardando(true)
    const ok = await guardarFicha(alumno.id, nacimiento || null, objetivo.trim() || null)
    setGuardando(false)
    if (!ok) return setError('No se pudo guardar. Intenta de nuevo.')
    onCerrar()
  }
  async function agregarTutor() {
    if (!nuevoTutor) return
    if (await ponerTutor(nuevoTutor, alumno.id)) { setTutores((t) => [...new Set([...t, nuevoTutor])]); setNuevoTutor('') } else setError('No se pudo asociar al tutor.')
  }
  async function sacarTutor(id: string) {
    if (await quitarTutor(id, alumno.id)) setTutores((t) => t.filter((x) => x !== id)); else setError('No se pudo quitar al tutor.')
  }
  async function quitar() {
    setQuitando(true)
    const ok = await onQuitar(alumno.id)
    setQuitando(false)
    if (ok) onCerrar(); else setError('No se pudo quitar de la clase.')
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="display m-0 mx-1 text-2xl font-semibold">{alumno.nombre}</h2>
      <p className="m-0 mx-1 -mt-2 text-sm font-bold" style={{ color: 'var(--muted)' }}>{verFicha ? ROL_LABEL[alumno.rol] : 'Alumno'}{nacimiento ? ` · ${edad(nacimiento)} años${edad(nacimiento) < 18 ? ' · menor de edad' : ''}` : ''}</p>
      {!verFicha ? (
        <p className="m-0 rounded-xl px-3 py-2 text-[13px]" style={{ background: 'var(--soft)', color: 'var(--muted)' }}>Por privacidad, la ficha del alumno (edad, meta y tutores) solo la ve la coordinación y los maestros del ministerio.</p>
      ) : !cargado ? <div className="esqueleto h-20" /> : (
        <>
          {puedeEditar ? (
            <>
              <label className="campo-sel"><span>Fecha de nacimiento</span><input type="date" value={nacimiento} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setNacimiento(e.target.value)} style={{ border: 0, background: 'transparent', color: 'var(--ink)', font: 'inherit', fontSize: 17, outline: 'none', padding: 0 }} /></label>
              <div className="field"><input id="al-obj" type="text" placeholder=" " value={objetivo} maxLength={300} onChange={(e) => setObjetivo(e.target.value)} /><label htmlFor="al-obj">Meta (ej. tocar el piano en el grupo)</label></div>
            </>
          ) : objetivo ? <p className="m-0 rounded-xl px-3 py-2 text-[15px]" style={{ background: 'var(--soft)' }}><b>Meta:</b> {objetivo}</p> : null}

          <div className="flex flex-col gap-2">
            <span className="px-1 text-sm font-extrabold">Tutores (papá, mamá o encargado)</span>
            {tutores.length === 0 && <span className="px-1 text-sm" style={{ color: 'var(--muted)' }}>Sin tutor asociado.</span>}
            <div className="flex flex-wrap gap-2">
              {tutores.map((t) => (
                <span key={t} className="ppill flex items-center gap-1.5" style={{ background: 'var(--soft)', color: 'var(--ink)' }}>{nombreDe(t)}{puedeEditar && <button type="button" aria-label={`Quitar a ${nombreDe(t)}`} onClick={() => sacarTutor(t)} className="grid place-items-center"><Icon name="equis" size={14} strokeWidth={2.6} /></button>}</span>
              ))}
            </div>
            {puedeEditar && (
              <div className="flex gap-2">
                <label className="campo-sel grow"><span>Agregar tutor</span>
                  <select value={nuevoTutor} onChange={(e) => setNuevoTutor(e.target.value)}><option value="">Elegir…</option>{tutoresPosibles.filter((t) => !tutores.includes(t.id)).map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select>
                </label>
                <button type="button" className="iconbtn prim !h-[62px] !w-[52px]" aria-label="Asociar tutor" disabled={!nuevoTutor} onClick={agregarTutor}><Icon name="mas" size={20} strokeWidth={2.4} /></button>
              </div>
            )}
          </div>
        </>
      )}
      {escribir && (
        <div className="flex flex-col gap-1.5">
          <span className="px-1 text-sm font-extrabold">Avance{curso ? ` en ${curso.nombre}` : ''}</span>
          <ProgresoAlumno alumnoId={alumno.id} alumnoNombre={alumno.nombre} curso={curso} porId={escribir.autorId} puedePasar={puedePasar && alumno.rol === 'alumno'} esAlumno={alumno.rol === 'alumno'} onPasar={() => onPasar(alumno.id)} />
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <span className="px-1 text-sm font-extrabold">Comentarios</span>
        <Comentarios alumnoId={alumno.id} claseId={escribir?.claseId} escribir={escribir} nombreDe={(i) => nombreDe(i ?? '')} vacio="Todavía no hay comentarios para este alumno." />
      </div>
      <span role="status" className="min-h-5 px-1 text-sm font-semibold" style={{ color: 'var(--danger)' }}>{error}</span>
      {puedeEditar && verFicha ? (
        <>
          <button type="button" className="cta" disabled={guardando || !cargado} onClick={guardar}>{guardando ? <span className="spinner" aria-label="Guardando" /> : 'Guardar'}</button>
          <button type="button" className="undo self-center" style={{ color: 'var(--danger)' }} disabled={quitando} onClick={quitar}>Quitar de esta clase</button>
        </>
      ) : <button type="button" className="cta" onClick={onCerrar}>Cerrar</button>}
    </div>
  )
}

export function HojaAlumno({ alumno, ...resto }: PropsAlumno) {
  return (
    <Hoja titulo="Alumno" abierta={alumno !== null} onCerrar={resto.onCerrar}>
      {alumno && <ContenidoAlumno key={alumno.id} alumno={alumno} {...resto} />}
    </Hoja>
  )
}

export const fechaSesion = (s: Sesion) => fechaCorta(s.fecha)
