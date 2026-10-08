import { useCallback, useEffect, useState } from 'react'
import { nivelActual, ultimoCompletado } from '../../lib/camino'
import { cargarHitos, cargarNiveles, marcarHito, quitarHito, quitarRecomendacion, recomendarAlumno, type Curso, type Hito, type Nivel } from './api'
import Camino from './Camino'

interface Props {
  alumnoId: string
  alumnoNombre: string
  /** el curso de la clase desde la que se abrió */
  curso: Curso | null
  /** quien marca (maestro o coordinación) */
  porId: string
  /** un líder puede pasarlo al equipo */
  puedePasar: boolean
  esAlumno: boolean
  onPasar: () => void
}

/** Niveles del alumno en el curso, recomendación para el equipo y paso al equipo. Lo usa quien enseña. */
export default function ProgresoAlumno({ alumnoId, alumnoNombre, curso, porId, puedePasar, esAlumno, onPasar }: Props) {
  const [niveles, setNiveles] = useState<Nivel[]>([])
  const [hitos, setHitos] = useState<Hito[]>([])
  const [nota, setNota] = useState('')
  const [notaRec, setNotaRec] = useState('')
  const [recomendado, setRecomendado] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    if (!curso) return
    const [n, h] = await Promise.all([cargarNiveles([curso.id]), cargarHitos(alumnoId)])
    setNiveles(n)
    setHitos(h.filter((x) => n.some((v) => v.id === x.nivel_id)))
  }, [curso, alumnoId])
  useEffect(() => { void cargar() }, [cargar])

  const hechos = new Set(hitos.map((h) => h.nivel_id))
  const siguiente = nivelActual(niveles, hechos)
  const ultimo = ultimoCompletado(niveles, hechos)

  async function completar() {
    if (!siguiente) return
    setOcupado(true); setError('')
    const ok = await marcarHito(alumnoId, siguiente.id, porId, nota.trim() || null)
    setOcupado(false)
    if (!ok) return setError('No se pudo guardar. Intenta de nuevo.')
    setNota('')
    await cargar()
  }
  async function deshacer() {
    const h = ultimo && hitos.find((x) => x.nivel_id === ultimo.id)
    if (!h) return
    setOcupado(true)
    const ok = await quitarHito(h.id)
    setOcupado(false)
    if (ok) await cargar(); else setError('No se pudo deshacer.')
  }
  async function recomendar() {
    setOcupado(true); setError('')
    const ok = await recomendarAlumno(alumnoId, notaRec.trim() || null)
    setOcupado(false)
    if (ok) setRecomendado(true); else setError('No se pudo recomendar. Intenta de nuevo.')
  }
  async function quitarRec() {
    setOcupado(true)
    const ok = await quitarRecomendacion(alumnoId)
    setOcupado(false)
    if (ok) setRecomendado(false); else setError('No se pudo quitar la recomendación.')
  }

  return (
    <div className="flex flex-col gap-3">
      {curso && niveles.length > 0 && (
        <>
          <Camino curso={curso} niveles={niveles} hitos={hitos} />
          {siguiente ? (
            <div className="flex flex-col gap-2">
              <div className="field"><input id="hi-nota" type="text" placeholder=" " value={nota} maxLength={300} onChange={(e) => setNota(e.target.value)} /><label htmlFor="hi-nota">Nota de la audición (opcional)</label></div>
              <button type="button" className="cta" disabled={ocupado} onClick={completar}>{ocupado ? <span className="spinner" aria-label="Guardando" /> : `Completó «${siguiente.nombre}»`}</button>
            </div>
          ) : <p className="m-0 px-1 text-sm font-bold" style={{ color: 'var(--primary)' }}>¡Completó todos los niveles de {curso.nombre}!</p>}
          {ultimo && <button type="button" className="undo self-start" disabled={ocupado} onClick={deshacer}>Deshacer «{ultimo.nombre}»</button>}
        </>
      )}

      {esAlumno && (
        <div className="flex flex-col gap-2 rounded-2xl p-3" style={{ background: 'var(--soft)' }}>
          <span className="text-sm font-extrabold">Para el equipo de alabanza</span>
          {recomendado ? (
            <>
              <span className="text-sm font-bold" style={{ color: 'var(--primary)' }}>Recomendaste a {alumnoNombre.split(' ')[0]}. Los líderes ya lo pueden ver.</span>
              <button type="button" className="undo self-start" disabled={ocupado} onClick={quitarRec}>Quitar recomendación</button>
            </>
          ) : (
            <>
              <div className="field"><input id="rec-nota" type="text" placeholder=" " value={notaRec} maxLength={300} onChange={(e) => setNotaRec(e.target.value)} /><label htmlFor="rec-nota">Por qué está listo (opcional)</label></div>
              <button type="button" className="ghost-link" disabled={ocupado} onClick={recomendar}>Recomendar para el equipo</button>
            </>
          )}
          {puedePasar && <button type="button" className="cta" onClick={onPasar}>Pasar al equipo</button>}
        </div>
      )}
      {error && <span role="alert" className="text-sm font-bold" style={{ color: 'var(--danger)' }}>{error}</span>}
    </div>
  )
}
