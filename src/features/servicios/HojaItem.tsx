import { useState, type FormEvent } from 'react'
import Hoja from '../../components/Hoja'
import type { Integrante } from '../../hooks/useEquipo'
import { TONOS } from '../../lib/chordpro'
import type { DatosItem, Item } from './useServicios'

const MOMENTOS = ['Bienvenida', 'Alabanza', 'Adoración', 'Ofrenda', 'Santa Cena', 'Cierre']

interface Props {
  item: Item | null
  onCerrar: () => void
  equipo: Integrante[]
  onGuardar: (id: string, patch: DatosItem) => Promise<boolean>
}

function Formulario({ item, equipo, onGuardar, onCerrar }: { item: Item } & Omit<Props, 'item'>) {
  const esCancion = item.tipo === 'cancion'
  const [momento, setMomento] = useState(item.momento ?? '')
  const [dirige, setDirige] = useState(item.dirige ?? '')
  const [tono, setTono] = useState(item.tono ?? '')
  const [titulo, setTitulo] = useState(item.parte_titulo ?? '')
  const [resp, setResp] = useState(item.responsable ?? '')
  const [min, setMin] = useState(item.minutos?.toString() ?? '')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const m = min ? Number(min) : null
    if (m !== null && !(Number.isInteger(m) && m >= 1 && m <= 180)) return setError('Los minutos van de 1 a 180.')
    if (!esCancion && !titulo.trim()) return setError('Escribe qué parte es.')
    setGuardando(true)
    const patch: DatosItem = esCancion
      ? { momento: momento.trim() || null, dirige: dirige || null, tono: tono || null, minutos: m }
      : { momento: momento.trim() || null, dirige: dirige || null, parte_titulo: titulo.trim(), responsable: resp.trim() || null, minutos: m }
    const ok = await onGuardar(item.id, patch)
    setGuardando(false)
    if (!ok) return setError('No se pudo guardar. Intenta de nuevo.')
    onCerrar()
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-3">
      <h2 className="display m-0 mx-1 text-2xl font-semibold">{item.titulo}</h2>
      {!esCancion && <div className="field"><input id="i-t" type="text" placeholder=" " value={titulo} onChange={(e) => { setTitulo(e.target.value); setError('') }} maxLength={80} /><label htmlFor="i-t">Parte</label></div>}
      <div className="scrollx" style={{ margin: '0 -20px', padding: '2px 20px' }}>
        {MOMENTOS.map((m) => <button key={m} type="button" className={'fchip' + (momento === m ? ' on' : '')} onClick={() => setMomento(momento === m ? '' : m)}>{m}</button>)}
      </div>
      <div className="field"><input id="i-m" type="text" placeholder=" " value={momento} onChange={(e) => setMomento(e.target.value)} maxLength={40} /><label htmlFor="i-m">Momento del culto</label></div>
      <label className="campo-sel"><span>Dirige</span>
        <select value={dirige} onChange={(e) => setDirige(e.target.value)}><option value="">Sin asignar</option>{equipo.filter((m) => m.rol !== 'alumno').map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        {esCancion ? (
          <label className="campo-sel"><span>Tono hoy</span>
            <select value={tono} onChange={(e) => setTono(e.target.value)}><option value="">El original</option>{TONOS.map((t) => <option key={t} value={t}>{t}</option>)}</select>
          </label>
        ) : (
          <div className="field"><input id="i-r" type="text" placeholder=" " value={resp} onChange={(e) => setResp(e.target.value)} maxLength={60} /><label htmlFor="i-r">Responsable</label></div>
        )}
        <div className="field"><input id="i-min" type="number" inputMode="numeric" placeholder=" " value={min} onChange={(e) => { setMin(e.target.value); setError('') }} /><label htmlFor="i-min">Minutos</label></div>
      </div>
      <span role="status" className="min-h-5 px-1 text-sm font-semibold" style={{ color: 'var(--danger)' }}>{error}</span>
      <button type="submit" className="cta" disabled={guardando}>{guardando ? <span className="spinner" aria-label="Guardando" /> : 'Guardar'}</button>
    </form>
  )
}

export default function HojaItem({ item, onCerrar, ...resto }: Props) {
  return (
    <Hoja titulo="Editar punto del culto" abierta={item !== null} onCerrar={onCerrar}>
      {item && <Formulario key={item.id} item={item} onCerrar={onCerrar} {...resto} />}
    </Hoja>
  )
}
