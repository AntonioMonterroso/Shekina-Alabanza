import { useState, type FormEvent } from 'react'
import Hoja from '../../components/Hoja'
import type { Integrante } from '../../hooks/useEquipo'
import { aInputLocal, desdeInputLocal } from '../../lib/fechas'
import type { DatosServicio, Servicio } from './useServicios'

const TIPOS = ['Servicio dominical', 'Culto de oración', 'Santa Cena', 'Culto de jóvenes']

/** Próximo domingo a las 10:00 (hora de Guatemala) como valor de datetime-local. */
function proximoDomingo(): string {
  const hoy = aInputLocal(new Date().toISOString()) // YYYY-MM-DDTHH:mm en Guatemala
  const d = new Date(`${hoy.slice(0, 10)}T12:00:00Z`)
  const falta = (7 - d.getUTCDay()) % 7
  const pasada = falta === 0 && hoy.slice(11) >= '10:00'
  d.setUTCDate(d.getUTCDate() + (pasada ? 7 : falta))
  return `${d.toISOString().slice(0, 10)}T10:00`
}

interface Props {
  abierta: boolean
  onCerrar: () => void
  inicial: Servicio | null
  equipo: Integrante[]
  onGuardar: (d: DatosServicio) => Promise<boolean>
  onBorrar?: () => Promise<boolean>
}

function Formulario({ inicial, equipo, onGuardar, onBorrar, onCerrar }: Omit<Props, 'abierta'>) {
  const [tipo, setTipo] = useState(inicial?.tipo ?? TIPOS[0]!)
  const [fecha, setFecha] = useState(inicial ? aInputLocal(inicial.fecha) : proximoDomingo())
  const [dirige, setDirige] = useState(inicial?.dirige ?? '')
  const [llegada, setLlegada] = useState(inicial?.llegada ?? '')
  const [notas, setNotas] = useState(inicial?.notas ?? '')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [confirmar, setConfirmar] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!tipo.trim()) return setError('Escribe el tipo de servicio.')
    if (!fecha) return setError('Elige la fecha y la hora.')
    setGuardando(true)
    const ok = await onGuardar({ tipo: tipo.trim(), fecha: desdeInputLocal(fecha), dirige: dirige || null, llegada: llegada.trim() || null, notas: notas.trim() || null })
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
        <h2 className="display m-0 mx-1 text-2xl font-semibold">¿Borrar este servicio?</h2>
        <p className="m-0 mx-1 text-[15px]" style={{ color: 'var(--muted)' }}>Se pierden el orden del culto y los turnos asignados. No se puede deshacer.</p>
        <div className="flex gap-2.5">
          <button type="button" className="ghost-link grow" onClick={() => setConfirmar(false)}>Cancelar</button>
          <button type="button" className="adv grow" style={{ background: 'var(--danger)', color: 'var(--bg)' }} disabled={guardando} onClick={borrar}>Borrar</button>
        </div>
      </>
    )
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-3">
      <h2 className="display m-0 mx-1 text-2xl font-semibold">{inicial ? 'Editar servicio' : 'Nuevo servicio'}</h2>
      <div className="field"><input id="s-tipo" list="s-tipos" type="text" placeholder=" " value={tipo} onChange={(e) => { setTipo(e.target.value); setError('') }} maxLength={60} /><label htmlFor="s-tipo">Tipo de servicio</label></div>
      <datalist id="s-tipos">{TIPOS.map((t) => <option key={t} value={t} />)}</datalist>
      <label className="campo-sel"><span>Fecha y hora</span><input type="datetime-local" value={fecha} onChange={(e) => { setFecha(e.target.value); setError('') }} style={{ border: 0, background: 'transparent', color: 'var(--ink)', font: 'inherit', fontSize: 17, outline: 'none', padding: 0 }} /></label>
      <label className="campo-sel"><span>Dirige</span>
        <select value={dirige} onChange={(e) => setDirige(e.target.value)}><option value="">Sin asignar</option>{equipo.filter((m) => m.rol !== 'alumno').map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select>
      </label>
      <div className="field"><input id="s-llegada" type="text" placeholder=" " value={llegada} onChange={(e) => setLlegada(e.target.value)} maxLength={20} /><label htmlFor="s-llegada">Llegada del equipo (ej. 8:30 a. m.)</label></div>
      <textarea className="letra-editor" style={{ fontFamily: 'inherit', fontSize: 16 }} rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Notas para el equipo (opcional)" aria-label="Notas" />
      <span role="status" className="min-h-5 px-1 text-sm font-semibold" style={{ color: 'var(--danger)' }}>{error}</span>
      <button type="submit" className="cta" disabled={guardando}>{guardando ? <span className="spinner" aria-label="Guardando" /> : inicial ? 'Guardar cambios' : 'Crear servicio'}</button>
      {onBorrar && <button type="button" className="undo self-center" onClick={() => setConfirmar(true)} style={{ color: 'var(--danger)' }}>Borrar servicio</button>}
    </form>
  )
}

export default function HojaServicio({ abierta, onCerrar, ...resto }: Props) {
  return <Hoja titulo="Servicio" abierta={abierta} onCerrar={onCerrar}><Formulario {...resto} onCerrar={onCerrar} /></Hoja>
}
