import { useState } from 'react'
import Hoja from '../../components/Hoja'
import { diaSemanaCap, diaNum, mediodiaGT, mesCorto } from '../../lib/fechas'
import type { Practica, Registro } from './api'

const RAPIDOS = [10, 15, 20, 30, 45]

interface Props {
  practica: Practica | null
  /** días de esta semana hasta hoy, donde se puede anotar */
  dias: string[]
  hoy: string
  registros: Registro[]
  onGuardar: (practicaId: string, fecha: string, minutos: number, nota: string | null) => Promise<boolean>
  onBorrar: (registroId: string) => Promise<boolean>
  onCerrar: () => void
}

function Contenido({ practica, dias, hoy, registros, onGuardar, onBorrar, onCerrar }: Props & { practica: Practica }) {
  const [fecha, setFecha] = useState(hoy)
  const previo = registros.find((r) => r.practica_id === practica.id && r.fecha === fecha)
  const [minutos, setMinutos] = useState(String(previo?.minutos ?? practica.minutos_meta ?? 15))
  const [nota, setNota] = useState(previo?.nota ?? '')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  function elegirDia(f: string) {
    setFecha(f)
    const r = registros.find((x) => x.practica_id === practica.id && x.fecha === f)
    setMinutos(String(r?.minutos ?? practica.minutos_meta ?? 15))
    setNota(r?.nota ?? '')
  }

  async function guardar() {
    const m = Number(minutos)
    if (!Number.isInteger(m) || m < 1 || m > 600) return setError('Escribe cuántos minutos practicaste (1 a 600).')
    setGuardando(true)
    const ok = await onGuardar(practica.id, fecha, m, nota.trim() || null)
    setGuardando(false)
    if (!ok) return setError('No se pudo guardar. Intenta de nuevo.')
    onCerrar()
  }

  async function borrar() {
    if (!previo) return
    setGuardando(true)
    const ok = await onBorrar(previo.id)
    setGuardando(false)
    if (!ok) return setError('No se pudo borrar. Intenta de nuevo.')
    onCerrar()
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="display m-0 mx-1 text-2xl font-semibold">¿Cuánto practicaste?</h2>
      <p className="m-0 mx-1 -mt-1 text-[15px] font-bold">{practica.titulo}</p>
      {dias.length > 1 && (
        <div className="scrollx" role="radiogroup" aria-label="Día">
          {dias.map((d) => (
            <button key={d} type="button" role="radio" aria-checked={d === fecha} className={'schip' + (d === fecha ? ' on' : '')} onClick={() => elegirDia(d)}>
              <small>{d === hoy ? 'Hoy' : diaSemanaCap(mediodiaGT(d))}</small><b>{diaNum(mediodiaGT(d))} {mesCorto(mediodiaGT(d))}</b>
            </button>
          ))}
        </div>
      )}
      <div className="scrollx" role="group" aria-label="Minutos">
        {RAPIDOS.map((m) => <button key={m} type="button" className="more" aria-pressed={Number(minutos) === m} style={Number(minutos) === m ? { background: 'var(--primary)', borderColor: 'var(--primary)', color: 'var(--on-primary)' } : undefined} onClick={() => { setMinutos(String(m)); setError('') }}>{m} min</button>)}
      </div>
      <div className="field"><input id="r-min" type="number" inputMode="numeric" placeholder=" " value={minutos} onChange={(e) => { setMinutos(e.target.value); setError('') }} /><label htmlFor="r-min">Minutos</label></div>
      <div className="field"><input id="r-nota" type="text" placeholder=" " value={nota} maxLength={500} onChange={(e) => setNota(e.target.value)} /><label htmlFor="r-nota">¿Cómo te fue? (opcional)</label></div>
      <span role="status" className="min-h-5 px-1 text-sm font-semibold" style={{ color: 'var(--danger)' }}>{error}</span>
      <button type="button" className="cta" disabled={guardando} onClick={guardar}>{guardando ? <span className="spinner" aria-label="Guardando" /> : previo ? 'Guardar cambios' : 'Anotar práctica'}</button>
      {previo && <button type="button" className="undo self-center" style={{ color: 'var(--danger)' }} disabled={guardando} onClick={borrar}>Quitar este registro</button>}
    </div>
  )
}

export default function HojaRegistro(props: Props) {
  return (
    <Hoja titulo="Anotar práctica" abierta={props.practica !== null} onCerrar={props.onCerrar}>
      {props.practica && <Contenido key={props.practica.id} {...props} practica={props.practica} />}
    </Hoja>
  )
}
