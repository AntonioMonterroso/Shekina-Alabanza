import { useState, type FormEvent } from 'react'
import Hoja from '../../components/Hoja'
import { aInputLocal, desdeInputLocal, fechaCorta } from '../../lib/fechas'
import type { DatosEnsayo, Ensayo, ServicioCorto } from './useEnsayos'

/** Hoy a las 19:00 (hora de Guatemala) como valor de datetime-local; si ya pasó, mañana. */
function sugerida(): string {
  const ahora = aInputLocal(new Date().toISOString())
  const d = new Date(`${ahora.slice(0, 10)}T12:00:00Z`)
  if (ahora.slice(11) >= '19:00') d.setUTCDate(d.getUTCDate() + 1)
  return `${d.toISOString().slice(0, 10)}T19:00`
}

interface Props {
  abierta: boolean
  onCerrar: () => void
  inicial: Ensayo | null
  servicios: ServicioCorto[]
  onGuardar: (d: DatosEnsayo) => Promise<boolean>
  onBorrar?: () => Promise<boolean>
}

function Formulario({ inicial, servicios, onGuardar, onBorrar, onCerrar }: Omit<Props, 'abierta'>) {
  const [fecha, setFecha] = useState(inicial ? aInputLocal(inicial.fecha) : sugerida())
  const [lugar, setLugar] = useState(inicial?.lugar ?? '')
  const [servicio, setServicio] = useState(inicial?.servicio_id ?? '')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [confirmar, setConfirmar] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!fecha) return setError('Elige la fecha y la hora.')
    setGuardando(true)
    const ok = await onGuardar({ fecha: desdeInputLocal(fecha), lugar: lugar.trim() || null, servicio_id: servicio || null })
    setGuardando(false)
    if (!ok) return setError('No se pudo guardar. Intenta de nuevo.')
    onCerrar()
  }

  async function borrar() {
    setGuardando(true)
    const ok = await onBorrar!()
    setGuardando(false)
    if (!ok) { setConfirmar(false); return setError('No se pudo borrar. Intenta de nuevo.') }
    onCerrar()
  }

  if (confirmar) {
    return (
      <>
        <h2 className="display m-0 mx-1 text-2xl font-semibold">¿Borrar este ensayo?</h2>
        <p className="m-0 mx-1 text-[15px]" style={{ color: 'var(--muted)' }}>Se pierden la asistencia, las canciones a ensayar y las notas. No se puede deshacer.</p>
        <div className="flex gap-2.5">
          <button type="button" className="ghost-link grow" onClick={() => setConfirmar(false)}>Cancelar</button>
          <button type="button" className="adv grow" style={{ background: 'var(--danger)', color: 'var(--bg)' }} disabled={guardando} onClick={borrar}>Borrar</button>
        </div>
      </>
    )
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-3">
      <h2 className="display m-0 mx-1 text-2xl font-semibold">{inicial ? 'Editar ensayo' : 'Convocar ensayo'}</h2>
      <label className="campo-sel"><span>Fecha y hora</span><input type="datetime-local" value={fecha} onChange={(e) => { setFecha(e.target.value); setError('') }} style={{ border: 0, background: 'transparent', color: 'var(--ink)', font: 'inherit', fontSize: 17, outline: 'none', padding: 0 }} /></label>
      <div className="field"><input id="e-lugar" type="text" placeholder=" " value={lugar} onChange={(e) => setLugar(e.target.value)} maxLength={80} /><label htmlFor="e-lugar">Lugar (ej. Salón de la iglesia)</label></div>
      <label className="campo-sel"><span>Para el servicio</span>
        <select value={servicio} onChange={(e) => setServicio(e.target.value)}>
          <option value="">Ninguno en particular</option>
          {servicios.map((s) => <option key={s.id} value={s.id}>{s.tipo} · {fechaCorta(s.fecha)}</option>)}
        </select>
      </label>
      <span role="status" className="min-h-5 px-1 text-sm font-semibold" style={{ color: 'var(--danger)' }}>{error}</span>
      <button type="submit" className="cta" disabled={guardando}>{guardando ? <span className="spinner" aria-label="Guardando" /> : inicial ? 'Guardar cambios' : 'Convocar'}</button>
      {onBorrar && <button type="button" className="undo self-center" onClick={() => setConfirmar(true)} style={{ color: 'var(--danger)' }}>Borrar ensayo</button>}
    </form>
  )
}

export default function HojaEnsayo({ abierta, onCerrar, ...resto }: Props) {
  return <Hoja titulo="Ensayo" abierta={abierta} onCerrar={onCerrar}><Formulario {...resto} onCerrar={onCerrar} /></Hoja>
}
