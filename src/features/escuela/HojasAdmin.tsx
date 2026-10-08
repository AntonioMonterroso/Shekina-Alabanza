import { useState, type FormEvent } from 'react'
import Hoja from '../../components/Hoja'
import { ROL_LABEL } from '../../lib/tipos'
import type { Integrante } from '../../hooks/useEquipo'
import { COLORES, estiloColor, type Clase, type ColorCurso, type Curso } from './api'

// ---------------- Curso ----------------
interface PropsCurso {
  curso: Curso | 'nuevo' | null
  onCerrar: () => void
  onGuardar: (id: string | null, d: { nombre: string; descripcion: string | null; color: ColorCurso; activo: boolean }) => Promise<string | null>
}

function FormCurso({ curso, onCerrar, onGuardar }: Omit<PropsCurso, 'curso'> & { curso: Curso | null }) {
  const [nombre, setNombre] = useState(curso?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(curso?.descripcion ?? '')
  const [color, setColor] = useState<ColorCurso>(curso?.color ?? 'verde')
  const [activo, setActivo] = useState(curso?.activo ?? true)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) return setError('Escribe el nombre del curso.')
    setGuardando(true)
    const fallo = await onGuardar(curso?.id ?? null, { nombre: nombre.trim(), descripcion: descripcion.trim() || null, color, activo })
    setGuardando(false)
    if (fallo) return setError(fallo)
    onCerrar()
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-3">
      <h2 className="display m-0 mx-1 text-2xl font-semibold">{curso ? 'Editar curso' : 'Nuevo curso'}</h2>
      <div className="field"><input id="c-nombre" type="text" placeholder=" " value={nombre} maxLength={60} onChange={(e) => { setNombre(e.target.value); setError('') }} /><label htmlFor="c-nombre">Nombre (ej. Violín)</label></div>
      <div className="field"><input id="c-desc" type="text" placeholder=" " value={descripcion} maxLength={300} onChange={(e) => setDescripcion(e.target.value)} /><label htmlFor="c-desc">Descripción (opcional)</label></div>
      <div role="radiogroup" aria-label="Color" className="flex gap-2.5 px-1">
        {COLORES.map((c) => (
          <button key={c} type="button" role="radio" aria-checked={c === color} aria-label={`Color ${c}`} onClick={() => setColor(c)} className="grid h-11 w-11 place-items-center rounded-2xl" style={{ ...estiloColor(c), outline: c === color ? '3px solid var(--primary)' : 'none', outlineOffset: 2 }}>{c === color ? '✓' : ''}</button>
        ))}
      </div>
      {curso && (
        <div className="flex items-center gap-3 px-1">
          <button type="button" role="switch" aria-checked={activo} aria-label="Curso activo" className={'sw' + (activo ? ' on' : '')} onClick={() => setActivo(!activo)} />
          <span className="text-[15px] font-extrabold">{activo ? 'Activo' : 'Oculto (no se ofrece)'}</span>
        </div>
      )}
      <span role="status" className="min-h-5 px-1 text-sm font-semibold" style={{ color: 'var(--danger)' }}>{error}</span>
      <button type="submit" className="cta" disabled={guardando}>{guardando ? <span className="spinner" aria-label="Guardando" /> : curso ? 'Guardar cambios' : 'Crear curso'}</button>
    </form>
  )
}

export function HojaCurso({ curso, ...resto }: PropsCurso) {
  return (
    <Hoja titulo="Curso" abierta={curso !== null} onCerrar={resto.onCerrar}>
      {curso !== null && <FormCurso key={curso === 'nuevo' ? 'nuevo' : curso.id} curso={curso === 'nuevo' ? null : curso} {...resto} />}
    </Hoja>
  )
}

// ---------------- Clase ----------------
interface PropsClase {
  clase: Clase | 'nueva' | null
  cursos: Curso[]
  /** quienes pueden enseñar: cualquiera menos alumnos y tutores */
  maestros: Integrante[]
  onCerrar: () => void
  onGuardar: (id: string | null, d: Omit<Clase, 'id'>) => Promise<boolean>
  onBorrar?: (id: string) => Promise<boolean>
}

function FormClase({ clase, cursos, maestros, onCerrar, onGuardar, onBorrar }: Omit<PropsClase, 'clase'> & { clase: Clase | null }) {
  const [curso, setCurso] = useState(clase?.curso_id ?? cursos.find((c) => c.activo)?.id ?? '')
  const [nombre, setNombre] = useState(clase?.nombre ?? '')
  const [tipo, setTipo] = useState<Clase['tipo']>(clase?.tipo ?? 'grupal')
  const [maestro, setMaestro] = useState(clase?.maestro_id ?? '')
  const [horario, setHorario] = useState(clase?.horario ?? '')
  const [lugar, setLugar] = useState(clase?.lugar ?? '')
  const [activo, setActivo] = useState(clase?.activo ?? true)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [confirmar, setConfirmar] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!curso) return setError('Elige un curso.')
    if (!nombre.trim()) return setError('Ponle un nombre a la clase (ej. Piano — martes).')
    setGuardando(true)
    const ok = await onGuardar(clase?.id ?? null, { curso_id: curso, nombre: nombre.trim(), tipo, maestro_id: maestro || null, horario: horario.trim() || null, lugar: lugar.trim() || null, activo })
    setGuardando(false)
    if (!ok) return setError('No se pudo guardar. Intenta de nuevo.')
    onCerrar()
  }

  async function borrar() {
    setGuardando(true)
    const ok = await onBorrar!(clase!.id)
    setGuardando(false)
    if (!ok) { setConfirmar(false); return setError('No se pudo borrar. Intenta de nuevo.') }
    onCerrar()
  }

  if (confirmar) {
    return (
      <>
        <h2 className="display m-0 mx-1 text-2xl font-semibold">¿Borrar “{clase!.nombre}”?</h2>
        <p className="m-0 mx-1 text-[15px]" style={{ color: 'var(--muted)' }}>Se pierden sus alumnos inscritos, la asistencia y las prácticas anotadas. Si solo terminó, mejor márcala como inactiva. No se puede deshacer.</p>
        <div className="flex gap-2.5">
          <button type="button" className="ghost-link grow" onClick={() => setConfirmar(false)}>Cancelar</button>
          <button type="button" className="adv grow" style={{ background: 'var(--danger)', color: 'var(--bg)' }} disabled={guardando} onClick={borrar}>Borrar</button>
        </div>
      </>
    )
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-3">
      <h2 className="display m-0 mx-1 text-2xl font-semibold">{clase ? 'Editar clase' : 'Nueva clase'}</h2>
      <label className="campo-sel"><span>Curso</span>
        <select value={curso} onChange={(e) => setCurso(e.target.value)}>{cursos.filter((c) => c.activo || c.id === curso).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
      </label>
      <div className="field"><input id="cl-nombre" type="text" placeholder=" " value={nombre} maxLength={80} onChange={(e) => { setNombre(e.target.value); setError('') }} /><label htmlFor="cl-nombre">Nombre de la clase</label></div>
      <div className="segmentado" role="radiogroup" aria-label="Tipo de clase">
        {([['grupal', 'En grupo'], ['individual', 'Individual']] as const).map(([v, t]) => <button key={v} type="button" role="radio" aria-checked={tipo === v} className={tipo === v ? 'on' : ''} onClick={() => setTipo(v)}>{t}</button>)}
      </div>
      <label className="campo-sel"><span>Maestro</span>
        <select value={maestro} onChange={(e) => setMaestro(e.target.value)}>
          <option value="">Sin asignar</option>
          {maestros.map((m) => <option key={m.id} value={m.id}>{m.nombre} · {ROL_LABEL[m.rol]}</option>)}
        </select>
      </label>
      <div className="field"><input id="cl-horario" type="text" placeholder=" " value={horario} maxLength={80} onChange={(e) => setHorario(e.target.value)} /><label htmlFor="cl-horario">Horario (ej. Martes 6:00 p. m.)</label></div>
      <div className="field"><input id="cl-lugar" type="text" placeholder=" " value={lugar} maxLength={80} onChange={(e) => setLugar(e.target.value)} /><label htmlFor="cl-lugar">Lugar</label></div>
      {clase && (
        <div className="flex items-center gap-3 px-1">
          <button type="button" role="switch" aria-checked={activo} aria-label="Clase activa" className={'sw' + (activo ? ' on' : '')} onClick={() => setActivo(!activo)} />
          <span className="text-[15px] font-extrabold">{activo ? 'Activa' : 'Terminada'}</span>
        </div>
      )}
      <span role="status" className="min-h-5 px-1 text-sm font-semibold" style={{ color: 'var(--danger)' }}>{error}</span>
      <button type="submit" className="cta" disabled={guardando}>{guardando ? <span className="spinner" aria-label="Guardando" /> : clase ? 'Guardar cambios' : 'Crear clase'}</button>
      {clase && onBorrar && <button type="button" className="undo self-center" style={{ color: 'var(--danger)' }} onClick={() => setConfirmar(true)}>Borrar clase</button>}
    </form>
  )
}

export function HojaClase({ clase, ...resto }: PropsClase) {
  return (
    <Hoja titulo="Clase" abierta={clase !== null} onCerrar={resto.onCerrar}>
      {clase !== null && <FormClase key={clase === 'nueva' ? 'nueva' : clase.id} clase={clase === 'nueva' ? null : clase} {...resto} />}
    </Hoja>
  )
}
