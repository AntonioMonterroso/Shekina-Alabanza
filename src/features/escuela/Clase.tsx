import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useToast } from '../../components/Toast'
import { useAuth } from '../../hooks/authContext'
import { useEquipo } from '../../hooks/useEquipo'
import { fechaCorta, hoyGT, hora, iniciales } from '../../lib/fechas'
import { lunesDe, sumarDias } from '../../lib/semana'
import {
  borrarPractica, borrarSesion, cargarAsistencia, cargarClase, cargarCursos, cargarInscritos, cargarPracticas, cargarRegistros, cargarSesiones,
  crearSesion, desinscribir, estiloColor, guardarPractica, inscribir, marcarAsistencia, type Asistencia, type Clase as ClaseT, type Curso, type Practica, type Registro, type Sesion,
} from './api'
import { HojaAgregarAlumno, HojaAlumno, HojaAsistencia, HojaPractica } from './HojasClase'
import { useAccesoEscuela } from './useAcceso'

export default function Clase() {
  const { id } = useParams()
  const { membresia } = useAuth()
  const acceso = useAccesoEscuela()
  const toast = useToast()
  const equipo = useEquipo(membresia?.grupo_id)

  const [clase, setClase] = useState<ClaseT | null | undefined>(undefined)
  const [curso, setCurso] = useState<Curso | null>(null)
  const [alumnoIds, setAlumnoIds] = useState<string[]>([])
  const [practicas, setPracticas] = useState<Practica[]>([])
  const [registros, setRegistros] = useState<Registro[]>([])
  const [sesiones, setSesiones] = useState<Sesion[]>([])
  const [asistencia, setAsistencia] = useState<Asistencia[]>([])
  const [semanaVista, setSemanaVista] = useState<'esta' | 'proxima'>('esta')
  const [hojaPractica, setHojaPractica] = useState<Practica | 'nueva' | null>(null)
  const [sesionAbierta, setSesionAbierta] = useState<string | null>(null)
  const [alumnoAbierto, setAlumnoAbierto] = useState<string | null>(null)
  const [agregando, setAgregando] = useState(false)

  const hoy = hoyGT()
  const lunes = lunesDe(hoy)
  const semanas = useMemo(() => ({ esta: lunes, proxima: sumarDias(lunes, 7) }), [lunes])
  const gestiona = Boolean(clase && (acceso.coordina || clase.maestro_id === membresia?.id))
  const nombreDe = (x: string | null) => equipo.find((m) => m.id === x)?.nombre ?? '—'
  const alumnos = alumnoIds.map((a) => equipo.find((m) => m.id === a)).filter((x): x is NonNullable<typeof x> => Boolean(x))

  const cargar = useCallback(async () => {
    if (!id || !membresia) return
    const c = await cargarClase(id)
    setClase(c)
    if (!c) return
    const [cursos, ins, prs, ses] = await Promise.all([
      cargarCursos(membresia.grupo_id), cargarInscritos([id]), cargarPracticas([id], [semanas.esta, semanas.proxima]), cargarSesiones(id),
    ])
    setCurso(cursos.find((x) => x.id === c.curso_id) ?? null)
    setAlumnoIds(ins.map((i) => i.alumno_id))
    setPracticas(prs)
    setSesiones(ses)
    setRegistros(await cargarRegistros(prs.map((p) => p.id), semanas.esta))
    setAsistencia(await cargarAsistencia(ses.map((s) => s.id)))
  }, [id, membresia, semanas])

  useEffect(() => { void cargar() }, [cargar])

  async function salvarPractica(d: Omit<Practica, 'id'>, pid?: string) {
    const ok = await guardarPractica(d, pid)
    if (ok) { toast(pid ? 'Práctica actualizada' : 'Práctica dejada'); await cargar() }
    return ok
  }
  async function quitarPractica(pid: string) {
    const ok = await borrarPractica(pid)
    if (ok) { toast('Práctica borrada'); await cargar() }
    return ok
  }
  async function pasarLista() {
    const nueva = await crearSesion(id!, new Date().toISOString(), null)
    if (!nueva) return toast('No se pudo crear la clase. Intenta de nuevo.')
    await cargar()
    setSesionAbierta(nueva)
  }
  async function salvarInscripcion(alumnoId: string) {
    const ok = await inscribir(id!, alumnoId)
    if (ok) await cargar()
    return ok
  }
  async function sacarAlumno(alumnoId: string) {
    const ok = await desinscribir(id!, alumnoId)
    if (ok) { toast('Alumno quitado de la clase'); await cargar() }
    return ok
  }

  if (clase === undefined) return <div className="px-5 pt-[54px]"><div className="esqueleto h-40" /></div>
  if (clase === null) {
    return (
      <div className="px-5 pt-[54px]">
        <Link to="/escuela" className="iconbtn" aria-label="Volver a la Escuela"><Icon name="atras" size={20} strokeWidth={2.2} /></Link>
        <p className="mt-6 text-base font-bold">No encontramos esta clase.</p>
      </div>
    )
  }

  const vistas = practicas.filter((p) => p.semana === semanas[semanaVista])
  const minutosDe = (alumnoId: string) => registros.filter((r) => r.alumno_id === alumnoId && r.fecha >= semanas.esta).reduce((a, r) => a + r.minutos, 0)
  const candidatos = equipo.filter((m) => !alumnoIds.includes(m.id) && m.rol !== 'maestro' && m.rol !== 'tutor' && m.id !== clase.maestro_id)
  const sesionObjetivo = sesiones.find((s) => s.id === sesionAbierta) ?? null
  const alumnoObjetivo = alumnos.find((a) => a.id === alumnoAbierto) ?? null

  return (
    <div className="relative">
      <div aria-hidden className="blob" style={{ width: 260, height: 240, right: -120, top: -100, background: 'var(--blob1)' }} />
      <div className="relative flex flex-col gap-3.5 px-5 pt-[54px]">
        <header className="rise flex items-center gap-3">
          <Link to="/escuela" className="iconbtn" aria-label="Volver a la Escuela"><Icon name="atras" size={20} strokeWidth={2.2} /></Link>
          <div className="flex min-w-0 grow flex-col gap-0.5">
            <h1 className="display m-0 text-[28px] leading-[1.1] font-semibold tracking-[-0.02em]">{clase.nombre}</h1>
            <span className="flex flex-wrap items-center gap-1.5 text-sm" style={{ color: 'var(--muted)' }}>
              {curso && <span className="ppill" style={estiloColor(curso.color)}>{curso.nombre}</span>}
              {[clase.tipo === 'individual' ? 'Individual' : 'En grupo', clase.maestro_id ? nombreDe(clase.maestro_id) : 'Sin maestro', clase.horario, clase.lugar].filter(Boolean).join(' · ')}
            </span>
          </div>
        </header>

        {!clase.activo && <p className="m-0 rounded-2xl p-3 text-sm font-bold" style={{ background: 'var(--soft)', color: 'var(--muted)' }}>Esta clase ya terminó.</p>}

        <section aria-label="Alumnos" className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="display m-0 text-xl font-semibold">Alumnos</h2>
            {acceso.coordina && <button type="button" className="more" onClick={() => setAgregando(true)}><Icon name="mas" size={16} strokeWidth={2.4} />Agregar</button>}
          </div>
          {alumnos.length === 0 ? (
            <p className="m-0 rounded-2xl p-4 text-[15px]" style={{ background: 'var(--soft)', color: 'var(--muted)' }}>{acceso.coordina ? 'Aún no hay alumnos. Toca Agregar.' : 'Aún no hay alumnos inscritos.'}</p>
          ) : alumnos.map((a) => (
            <button key={a.id} type="button" className="tile w-full" aria-label={`Ver a ${a.nombre}`} onClick={() => setAlumnoAbierto(a.id)}>
              <span className="av shrink-0" style={{ background: 'var(--c-lila-bg)', color: 'var(--c-lila-fg)' }}>{iniciales(a.nombre)}</span>
              <span className="flex min-w-0 grow flex-col text-left"><span className="truncate text-base font-extrabold">{a.nombre}</span><span className="text-[13px]" style={{ color: 'var(--muted)' }}>{minutosDe(a.id) > 0 ? `${minutosDe(a.id)} min esta semana` : 'Aún no ha practicado esta semana'}</span></span>
              <Icon name="derecha" size={16} strokeWidth={2.4} />
            </button>
          ))}
        </section>

        <section aria-label="Práctica" className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="display m-0 text-xl font-semibold">Práctica</h2>
            {gestiona && <button type="button" className="more" onClick={() => setHojaPractica('nueva')}><Icon name="mas" size={16} strokeWidth={2.4} />Dejar práctica</button>}
          </div>
          <div className="segmentado" role="tablist" aria-label="Semana">
            {([['esta', 'Esta semana'], ['proxima', 'La próxima']] as const).map(([v, t]) => <button key={v} type="button" role="tab" aria-selected={semanaVista === v} className={semanaVista === v ? 'on' : ''} onClick={() => setSemanaVista(v)}>{t}</button>)}
          </div>
          {vistas.length === 0 ? (
            <p className="m-0 rounded-2xl p-4 text-[15px]" style={{ background: 'var(--soft)', color: 'var(--muted)' }}>{gestiona ? 'No hay práctica para esta semana. Toca “Dejar práctica”.' : 'Sin práctica asignada.'}</p>
          ) : vistas.map((p) => {
            const destinatarios = p.alumno_id ? alumnos.filter((a) => a.id === p.alumno_id) : alumnos
            const hicieron = destinatarios.filter((a) => registros.some((r) => r.practica_id === p.id && r.alumno_id === a.id))
            return (
              <article key={p.id} className="flex flex-col gap-2 rounded-3xl border-[1.5px] p-3.5" style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}>
                <div className="flex items-start gap-2">
                  <span className="flex min-w-0 grow flex-col"><span className="text-base font-extrabold">{p.titulo}</span><span className="text-[13px]" style={{ color: 'var(--muted)' }}>{p.alumno_id ? `Solo para ${nombreDe(p.alumno_id)}` : 'Para toda la clase'}{p.minutos_meta ? ` · ${p.minutos_meta} min al día` : ''}</span></span>
                  {gestiona && <button type="button" className="iconbtn !h-9 !w-9" aria-label={`Editar ${p.titulo}`} onClick={() => setHojaPractica(p)}><Icon name="editar" size={16} strokeWidth={2} /></button>}
                </div>
                {p.detalle && <p className="m-0 text-[15px] whitespace-pre-wrap">{p.detalle}</p>}
                {semanaVista === 'esta' && destinatarios.length > 0 && (
                  <div className="flex flex-wrap gap-1.5" aria-label="Quién practicó">
                    {destinatarios.map((a) => {
                      const min = registros.filter((r) => r.practica_id === p.id && r.alumno_id === a.id).reduce((s, r) => s + r.minutos, 0)
                      return <span key={a.id} className="ppill" style={min > 0 ? { background: 'var(--primary)', color: 'var(--on-primary)' } : { background: 'var(--soft)', color: 'var(--muted)' }}>{a.nombre.split(' ')[0]}{min > 0 ? ` · ${min} min` : ''}</span>
                    })}
                  </div>
                )}
                {semanaVista === 'esta' && destinatarios.length > 0 && <small style={{ color: 'var(--muted)' }}>Han practicado {hicieron.length} de {destinatarios.length}</small>}
              </article>
            )
          })}
        </section>

        <section aria-label="Clases dadas" className="flex flex-col gap-2 pb-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="display m-0 text-xl font-semibold">Asistencia</h2>
            {gestiona && <button type="button" className="more" onClick={pasarLista}><Icon name="check" size={16} strokeWidth={2.4} />Pasar lista</button>}
          </div>
          {sesiones.length === 0 ? (
            <p className="m-0 rounded-2xl p-4 text-[15px]" style={{ background: 'var(--soft)', color: 'var(--muted)' }}>Todavía no se ha pasado lista.</p>
          ) : sesiones.slice(0, 8).map((s) => {
            const marcas = asistencia.filter((a) => a.sesion_id === s.id)
            const presentes = marcas.filter((a) => a.estado === 'presente').length
            return (
              <button key={s.id} type="button" className="tile w-full" disabled={!gestiona} aria-label={`Clase del ${fechaCorta(s.fecha)}`} onClick={() => setSesionAbierta(s.id)}>
                <span className="flex min-w-0 grow flex-col text-left"><span className="text-base font-extrabold">{fechaCorta(s.fecha)} · {hora(s.fecha)}</span><span className="truncate text-[13px]" style={{ color: 'var(--muted)' }}>{s.tema ?? 'Sin tema'}</span></span>
                <span className="key">{presentes} de {alumnos.length}</span>
              </button>
            )
          })}
        </section>
      </div>

      {gestiona && (
        <>
          <HojaPractica practica={hojaPractica} alumnos={alumnos} semana={semanas[semanaVista]} claseId={clase.id} onCerrar={() => setHojaPractica(null)} onGuardar={salvarPractica} onBorrar={quitarPractica} />
          <HojaAsistencia sesion={sesionObjetivo} alumnos={alumnos} asistencia={asistencia} onCerrar={() => setSesionAbierta(null)} onMarcar={marcarAsistencia} onBorrar={borrarSesion} onCambio={cargar} />
        </>
      )}
      {acceso.coordina && <HojaAgregarAlumno abierta={agregando} candidatos={candidatos} onCerrar={() => setAgregando(false)} onInscribir={salvarInscripcion} />}
      <HojaAlumno alumno={alumnoObjetivo} tutoresPosibles={equipo.filter((m) => m.rol === 'tutor')} nombreDe={nombreDe} puedeEditar={acceso.coordina} onCerrar={() => setAlumnoAbierto(null)} onQuitar={sacarAlumno} />
    </div>
  )
}

