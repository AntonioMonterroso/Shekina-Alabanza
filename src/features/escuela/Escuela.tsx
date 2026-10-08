import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useToast } from '../../components/Toast'
import { useAuth } from '../../hooks/authContext'
import { useEquipo } from '../../hooks/useEquipo'
import { borrarClase, cargarClases, cargarCursos, cargarInscritos, estiloColor, guardarClase, guardarCurso, type Clase, type Curso } from './api'
import { HojaClase, HojaCurso } from './HojasAdmin'
import MiPractica from './MiPractica'
import { useAccesoEscuela } from './useAcceso'

type Pestana = 'practica' | 'clases' | 'cursos'

export default function Escuela() {
  const { membresia } = useAuth()
  const acceso = useAccesoEscuela()
  const toast = useToast()
  const grupoId = membresia?.grupo_id
  const equipo = useEquipo(grupoId)

  const pestanas = useMemo(() => {
    const p: [Pestana, string][] = []
    if (acceso.estudia || acceso.esTutor) p.push(['practica', acceso.esTutor ? 'Mis hijos' : 'Mi práctica'])
    if (acceso.coordina || acceso.ensena) p.push(['clases', 'Clases'])
    if (acceso.coordina) p.push(['cursos', 'Cursos'])
    return p
  }, [acceso.estudia, acceso.esTutor, acceso.coordina, acceso.ensena])
  const [elegida, setElegida] = useState<Pestana | null>(null)
  const actual = elegida && pestanas.some(([id]) => id === elegida) ? elegida : pestanas[0]?.[0] ?? null

  const [cursos, setCursos] = useState<Curso[]>([])
  const [clases, setClases] = useState<Clase[]>([])
  const [inscritos, setInscritos] = useState<Record<string, number>>({})
  const [cargando, setCargando] = useState(true)
  const [hojaCurso, setHojaCurso] = useState<Curso | 'nuevo' | null>(null)
  const [hojaClase, setHojaClase] = useState<Clase | 'nueva' | null>(null)

  const cargar = useCallback(async () => {
    if (!grupoId || !membresia) return setCargando(false)
    const [cs, cl] = await Promise.all([cargarCursos(grupoId), cargarClases(grupoId)])
    setCursos(cs)
    // Un maestro sin coordinación solo ve las clases que enseña (las demás en las que está inscrito son suyas como alumno)
    const visibles = acceso.coordina ? cl : cl.filter((c) => c.maestro_id === membresia.id)
    setClases(visibles)
    const ins = await cargarInscritos(visibles.map((c) => c.id))
    const n: Record<string, number> = {}
    for (const i of ins) n[i.clase_id] = (n[i.clase_id] ?? 0) + 1
    setInscritos(n)
    setCargando(false)
  }, [grupoId, membresia, acceso.coordina])

  useEffect(() => { void cargar() }, [cargar])

  const maestros = equipo.filter((m) => m.rol !== 'alumno' && m.rol !== 'tutor')
  const nombreDe = (id: string | null) => equipo.find((m) => m.id === id)?.nombre

  async function salvarCurso(id: string | null, d: Parameters<typeof guardarCurso>[2]) {
    const fallo = await guardarCurso(grupoId!, id, d, cursos.reduce((m, c) => Math.max(m, c.orden), 0) + 1)
    if (!fallo) { toast(id ? 'Curso actualizado' : 'Curso creado'); await cargar() }
    return fallo
  }
  async function salvarClase(id: string | null, d: Omit<Clase, 'id'>) {
    const nuevo = await guardarClase(grupoId!, id, d)
    if (nuevo) { toast(id ? 'Clase actualizada' : 'Clase creada'); await cargar() }
    return Boolean(nuevo)
  }
  async function quitarClase(id: string) {
    const ok = await borrarClase(id)
    if (ok) { toast('Clase borrada'); await cargar() }
    return ok
  }

  return (
    <div className="relative">
      <div aria-hidden className="blob" style={{ width: 260, height: 240, right: -120, top: -100, background: 'var(--blob1)' }} />
      <div className="relative flex flex-col gap-3.5 px-5 pt-[54px]">
        <header className="rise flex items-center gap-3">
          <Link to="/" className="iconbtn" aria-label="Volver al inicio"><Icon name="atras" size={20} strokeWidth={2.2} /></Link>
          <div className="flex min-w-0 grow flex-col gap-0.5">
            <h1 className="display m-0 text-[30px] leading-[1.1] font-semibold tracking-[-0.02em]">Escuela</h1>
            <span className="truncate text-sm font-bold" style={{ color: 'var(--muted)' }}>Formación musical · {membresia?.grupo.nombre}</span>
          </div>
          {acceso.coordina && actual === 'clases' && <button type="button" className="iconbtn prim" aria-label="Nueva clase" onClick={() => setHojaClase('nueva')}><Icon name="mas" size={20} strokeWidth={2.4} /></button>}
          {acceso.coordina && actual === 'cursos' && <button type="button" className="iconbtn prim" aria-label="Nuevo curso" onClick={() => setHojaCurso('nuevo')}><Icon name="mas" size={20} strokeWidth={2.4} /></button>}
        </header>

        {pestanas.length > 1 && (
          <div className="rise svc" role="tablist" aria-label="Secciones" style={{ animationDelay: '60ms' }}>
            {pestanas.map(([id, t]) => <button key={id} type="button" role="tab" aria-selected={id === actual} className={'schip' + (id === actual ? ' on' : '')} onClick={() => setElegida(id)}><b>{t}</b></button>)}
          </div>
        )}

        {actual === null && <p className="m-0 rounded-2xl p-4" style={{ background: 'var(--soft)', color: 'var(--muted)' }}>No tienes nada que ver en la Escuela todavía.</p>}

        {actual === 'practica' && <MiPractica />}

        {actual === 'clases' && (cargando ? <div className="esqueleto h-32" /> : clases.length === 0 ? (
          <p className="m-0 rounded-2xl p-4 text-base" style={{ background: 'var(--soft)', color: 'var(--muted)' }}>
            {acceso.coordina ? 'Todavía no hay clases. Toca + para crear la primera.' : 'Todavía no tienes clases asignadas.'}
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {clases.map((c) => {
              const curso = cursos.find((x) => x.id === c.curso_id)
              const n = inscritos[c.id] ?? 0
              return (
                <li key={c.id}>
                  <Link to={`/escuela/clase/${c.id}`} className="tile w-full" style={{ opacity: c.activo ? 1 : 0.55 }}>
                    {curso && <span className="chip" style={estiloColor(curso.color)} aria-hidden><Icon name="cancionero" size={20} strokeWidth={2} /></span>}
                    <span className="flex min-w-0 grow flex-col text-left">
                      <span className="truncate text-base font-extrabold">{c.nombre}{c.activo ? '' : ' (terminada)'}</span>
                      <span className="truncate text-[13px]" style={{ color: 'var(--muted)' }}>{[curso?.nombre, c.tipo === 'individual' ? 'Individual' : 'En grupo', nombreDe(c.maestro_id) ?? 'Sin maestro', c.horario].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className="key">{n} {n === 1 ? 'alumno' : 'alumnos'}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        ))}

        {actual === 'cursos' && (cargando ? <div className="esqueleto h-32" /> : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {cursos.map((c) => (
              <li key={c.id}>
                <button type="button" className="tile w-full" style={{ opacity: c.activo ? 1 : 0.55 }} aria-label={`Editar ${c.nombre}`} onClick={() => setHojaCurso(c)}>
                  <span className="chip" style={estiloColor(c.color)} aria-hidden><Icon name="cancionero" size={20} strokeWidth={2} /></span>
                  <span className="flex min-w-0 grow flex-col text-left"><span className="truncate text-base font-extrabold">{c.nombre}{c.activo ? '' : ' (oculto)'}</span>{c.descripcion && <span className="truncate text-[13px]" style={{ color: 'var(--muted)' }}>{c.descripcion}</span>}</span>
                  <Icon name="editar" size={18} strokeWidth={2} />
                </button>
              </li>
            ))}
          </ul>
        ))}
      </div>

      {acceso.coordina && (
        <>
          <HojaCurso curso={hojaCurso} onCerrar={() => setHojaCurso(null)} onGuardar={salvarCurso} />
          <HojaClase clase={hojaClase} cursos={cursos} maestros={maestros} onCerrar={() => setHojaClase(null)} onGuardar={salvarClase} onBorrar={quitarClase} />
        </>
      )}
    </div>
  )
}
