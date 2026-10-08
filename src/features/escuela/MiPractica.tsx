import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useToast } from '../../components/Toast'
import { useAuth } from '../../hooks/authContext'
import { useEquipo } from '../../hooks/useEquipo'
import { diaNum, fechaCorta, hoyGT, hora, mediodiaGT } from '../../lib/fechas'
import { diasDeSemana, INICIAL_DIA, lunesDe, sumarDias } from '../../lib/semana'
import Camino from './Camino'
import { anotarPractica, borrarRegistro, cargarClases, cargarHijos, cargarHitos, cargarNiveles, cargarPracticas, cargarRegistros, clasesDeAlumno, estiloColor, proximaSesion, cargarCursos, type Clase, type Curso, type Hito, type Nivel, type Practica, type Registro, type Sesion } from './api'
import Comentarios from './Comentarios'
import HojaRegistro from './HojaRegistro'
import Materiales from './Materiales'

const urlSegura = (u: string | null) => (u && /^https?:\/\//i.test(u) ? u : null)

/** Lo que le toca practicar a un alumno esta semana. Un tutor ve lo mismo de cada uno de sus hijos. */
export default function MiPractica() {
  const { membresia, rol } = useAuth()
  const toast = useToast()
  const equipo = useEquipo(membresia?.grupo_id)
  const esTutor = rol === 'tutor'
  const [hijos, setHijos] = useState<string[] | null>(esTutor ? null : [])
  const [alumnoId, setAlumnoId] = useState<string | null>(esTutor ? null : membresia?.id ?? null)
  const [clases, setClases] = useState<Clase[]>([])
  const [cursos, setCursos] = useState<Curso[]>([])
  const [practicas, setPracticas] = useState<Practica[]>([])
  const [registros, setRegistros] = useState<Registro[]>([])
  const [sesion, setSesion] = useState<Sesion | null>(null)
  const [niveles, setNiveles] = useState<Nivel[]>([])
  const [hitos, setHitos] = useState<Hito[]>([])
  const [cargando, setCargando] = useState(true)
  const [anotando, setAnotando] = useState<Practica | null>(null)

  const hoy = hoyGT()
  const [atras, setAtras] = useState(0) // semanas hacia atrás
  const lunes = lunesDe(sumarDias(hoy, -7 * atras))
  const semana = useMemo(() => diasDeSemana(lunes), [lunes])
  const nombreDe = (id: string | null) => equipo.find((m) => m.id === id)?.nombre ?? '—'

  useEffect(() => {
    if (!esTutor || !membresia) return
    void cargarHijos(membresia.id).then((h) => { setHijos(h); setAlumnoId((a) => a ?? h[0] ?? null) })
  }, [esTutor, membresia])

  const cargar = useCallback(async () => {
    if (!alumnoId || !membresia) return setCargando(false)
    const [ids, todas, cs] = await Promise.all([clasesDeAlumno(alumnoId), cargarClases(membresia.grupo_id), cargarCursos(membresia.grupo_id)])
    const mias = todas.filter((c) => ids.includes(c.id))
    setClases(mias)
    setCursos(cs)
    const prs = (await cargarPracticas(mias.map((c) => c.id), [lunes])).filter((x) => x.alumno_id === null || x.alumno_id === alumnoId)
    setPracticas(prs)
    setRegistros(await cargarRegistros(prs.map((x) => x.id), lunes, alumnoId))
    setSesion(await proximaSesion(mias.map((c) => c.id)))
    const cursosMios = [...new Set(mias.map((c) => c.curso_id))]
    const [nv, ht] = await Promise.all([cargarNiveles(cursosMios), cargarHitos(alumnoId)])
    setNiveles(nv)
    setHitos(ht)
    setCargando(false)
  }, [alumnoId, membresia, lunes])

  useEffect(() => { void cargar() }, [cargar])

  const minutosPorDia = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of registros) m.set(r.fecha, (m.get(r.fecha) ?? 0) + r.minutos)
    return m
  }, [registros])
  const total = [...minutosPorDia.values()].reduce((a, b) => a + b, 0)
  const diasConPractica = semana.filter((d) => (minutosPorDia.get(d) ?? 0) > 0).length

  async function guardar(practicaId: string, fecha: string, minutos: number, nota: string | null) {
    const ok = await anotarPractica(practicaId, alumnoId!, fecha, minutos, nota)
    if (ok) { toast('¡Práctica anotada!'); await cargar() }
    return ok
  }
  async function quitar(id: string) {
    const ok = await borrarRegistro(id)
    if (ok) { toast('Registro quitado'); await cargar() }
    return ok
  }

  if (esTutor && hijos === null) return <div className="esqueleto h-24" />
  if (esTutor && hijos!.length === 0) return <p className="m-0 rounded-2xl p-4 text-base" style={{ background: 'var(--soft)', color: 'var(--muted)' }}>Todavía no hay hijos asociados a tu cuenta. Pídele a la coordinación de la Escuela que te los asocie.</p>

  return (
    <div className="flex flex-col gap-3.5">
      {esTutor && hijos!.length > 1 && (
        <div className="scrollx" role="tablist" aria-label="Elegir hijo">
          {hijos!.map((h) => <button key={h} type="button" role="tab" aria-selected={h === alumnoId} className={'schip' + (h === alumnoId ? ' on' : '')} onClick={() => { setAlumnoId(h); setCargando(true) }}><b>{nombreDe(h).split(' ')[0]}</b></button>)}
        </div>
      )}
      {esTutor && alumnoId && <p className="m-0 px-1 text-sm font-bold" style={{ color: 'var(--muted)' }}>Avance de {nombreDe(alumnoId)}</p>}

      {cargando ? <div className="esqueleto h-40" /> : clases.length === 0 ? (
        <p className="m-0 rounded-2xl p-4 text-base" style={{ background: 'var(--soft)', color: 'var(--muted)' }}>Todavía no estás inscrito en ninguna clase. Cuando la coordinación te inscriba, tu práctica aparecerá aquí.</p>
      ) : (
        <>
          <section className="turn" aria-label="Tu semana">
            <div className="flex items-baseline justify-between">
              <span className="flex items-center gap-1">
                <button type="button" className="iconbtn !h-9 !w-9" aria-label="Semana anterior" disabled={atras >= 12} onClick={() => setAtras((a) => a + 1)}><Icon name="atras" size={16} strokeWidth={2.4} /></button>
                <span className="eyebrow min-w-[118px] text-center">{atras === 0 ? 'Esta semana' : atras === 1 ? 'Semana pasada' : `Semana del ${fechaCorta(mediodiaGT(lunes))}`}</span>
                <button type="button" className="iconbtn !h-9 !w-9" aria-label="Semana siguiente" disabled={atras === 0} onClick={() => setAtras((a) => a - 1)}><Icon name="derecha" size={16} strokeWidth={2.4} /></button>
              </span>
              <span className="text-sm font-extrabold">{total} min · {diasConPractica} {diasConPractica === 1 ? 'día' : 'días'}</span>
            </div>
            <div className="grid grid-cols-7 gap-1.5" role="img" aria-label={`Practicaste ${diasConPractica} de 7 días esta semana`}>
              {semana.map((d, i) => {
                const hecho = (minutosPorDia.get(d) ?? 0) > 0
                return (
                  <span key={d} className="flex flex-col items-center gap-1">
                    <span className="grid h-9 w-9 place-items-center rounded-full text-[13px] font-extrabold" style={{ background: hecho ? 'var(--primary)' : 'var(--surface)', color: hecho ? 'var(--on-primary)' : d > hoy ? 'var(--muted)' : 'var(--ink)', outline: d === hoy ? '2.5px solid var(--primary)' : 'none', outlineOffset: 2 }}>{hecho ? <Icon name="check" size={16} strokeWidth={3} /> : diaNum(mediodiaGT(d))}</span>
                    <small className="text-[11px] font-bold" style={{ color: 'var(--muted)' }}>{INICIAL_DIA[i]}</small>
                  </span>
                )
              })}
            </div>
          </section>

          {sesion && atras === 0 && (
            <p className="m-0 flex items-center gap-2 px-1 text-sm" style={{ color: 'var(--muted)' }}>
              <Icon name="reloj" size={18} strokeWidth={2} /><span><b style={{ color: 'var(--ink)' }}>Próxima clase</b> · {fechaCorta(sesion.fecha)} · {hora(sesion.fecha)}{sesion.tema ? ` · ${sesion.tema}` : ''}</span>
            </p>
          )}

          <h2 className="display m-0 px-1 pt-1 text-xl font-semibold">Lo que toca practicar</h2>
          {practicas.length === 0 ? (
            <p className="m-0 rounded-2xl p-4 text-[15px]" style={{ background: 'var(--soft)', color: 'var(--muted)' }}>{atras === 0 ? 'Tu maestro todavía no deja práctica para esta semana.' : 'No había práctica asignada esa semana.'}</p>
          ) : practicas.map((pr) => {
            const clase = clases.find((c) => c.id === pr.clase_id)
            const curso = cursos.find((c) => c.id === clase?.curso_id)
            const mios = registros.filter((r) => r.practica_id === pr.id)
            const hechoHoy = mios.find((r) => r.fecha === hoy)
            const enlace = urlSegura(pr.enlace)
            return (
              <article key={pr.id} className="flex flex-col gap-2.5 rounded-3xl border-[1.5px] p-3.5" style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}>
                <div className="flex items-start gap-2.5">
                  <span className="flex min-w-0 grow flex-col gap-0.5">
                    <span className="text-[17px] font-extrabold">{pr.titulo}</span>
                    <span className="flex flex-wrap items-center gap-1.5 text-[13px]" style={{ color: 'var(--muted)' }}>
                      {curso && <span className="ppill" style={estiloColor(curso.color)}>{curso.nombre}</span>}
                      {clase?.nombre}{pr.minutos_meta ? ` · meta ${pr.minutos_meta} min` : ''}
                    </span>
                  </span>
                </div>
                {pr.detalle && <p className="m-0 rounded-xl px-3 py-2 text-[15px] whitespace-pre-wrap" style={{ background: 'var(--soft)' }}>{pr.detalle}</p>}
                {enlace && <a href={enlace} target="_blank" rel="noopener noreferrer" className="ghost-link self-start"><Icon name="audio" size={18} strokeWidth={2} />Material de apoyo</a>}
                <div className="flex gap-2">
                  {atras === 0 && <Link to={`/escuela/practicar/${pr.id}${alumnoId && alumnoId !== membresia?.id ? `?a=${alumnoId}` : ''}`} className="cbtn yes no-underline"><Icon name="audio" size={18} strokeWidth={2.2} />Practicar ahora</Link>}
                  <button type="button" className={hechoHoy && atras === 0 ? 'confirmed' : 'cbtn no'} style={hechoHoy && atras === 0 ? undefined : { border: '1.5px solid var(--line)' }} onClick={() => setAnotando(pr)}>
                    {hechoHoy && atras === 0 ? <><Icon name="check" size={18} strokeWidth={2.4} />Hoy: {hechoHoy.minutos} min</> : 'Anotar'}
                  </button>
                </div>
                {pr.bpm && <small style={{ color: 'var(--muted)' }}>Tempo sugerido: {pr.bpm} BPM</small>}
                {mios.length > 0 && <small style={{ color: 'var(--muted)' }}>Esta semana: {mios.reduce((a, r) => a + r.minutos, 0)} min en {mios.length} {mios.length === 1 ? 'día' : 'días'}</small>}
              </article>
            )
          })}

          {cursos.filter((c) => clases.some((x) => x.curso_id === c.id) && niveles.some((n) => n.curso_id === c.id)).length > 0 && <h2 className="display m-0 px-1 pt-1 text-xl font-semibold">Tu camino</h2>}
          {cursos.filter((c) => clases.some((x) => x.curso_id === c.id)).map((c) => <Camino key={c.id} curso={c} niveles={niveles} hitos={hitos} />)}

          {alumnoId && <Comentarios alumnoId={alumnoId} nombreDe={(i) => nombreDe(i)} titulo="Mensajes de tus maestros" />}
          <Materiales cursos={cursos.filter((c) => clases.some((x) => x.curso_id === c.id))} puedeEditar={false} />

          <h2 className="display m-0 px-1 pt-1 text-xl font-semibold">Tus clases</h2>
          {clases.map((c) => {
            const curso = cursos.find((x) => x.id === c.curso_id)
            return (
              <div key={c.id} className="flex items-center gap-3 rounded-2xl p-3" style={{ background: 'var(--surface)', border: '1.5px solid var(--line)' }}>
                {curso && <span className="chip !h-11 !w-11" style={estiloColor(curso.color)} aria-hidden><Icon name="cancionero" size={20} strokeWidth={2} /></span>}
                <span className="flex min-w-0 grow flex-col">
                  <span className="truncate text-base font-extrabold">{c.nombre}</span>
                  <span className="truncate text-[13px]" style={{ color: 'var(--muted)' }}>{[curso?.nombre, c.maestro_id ? `Maestro: ${nombreDe(c.maestro_id)}` : null, c.horario, c.lugar].filter(Boolean).join(' · ')}</span>
                </span>
              </div>
            )
          })}
        </>
      )}

      <HojaRegistro practica={anotando} dias={semana.filter((d) => d <= hoy)} hoy={hoy} registros={registros} onGuardar={guardar} onBorrar={quitar} onCerrar={() => setAnotando(null)} />
    </div>
  )
}
