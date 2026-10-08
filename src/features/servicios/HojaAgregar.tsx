import { useState, type FormEvent } from 'react'
import Hoja from '../../components/Hoja'
import { relativo } from '../../lib/tiempo'
import type { CancionLista } from './useServicios'

const PARTES = ['Oración pastoral', 'Predicación', 'Ofrenda', 'Anuncios', 'Santa Cena']

interface Props {
  abierta: boolean
  onCerrar: () => void
  catalogo: CancionLista[]
  usadas: Set<string>
  ultimaVez: Record<string, string>
  onCancion: (id: string, titulo: string) => Promise<void>
  onParte: (titulo: string, responsable: string | null, minutos: number | null) => Promise<boolean>
}

function Contenido({ catalogo, usadas, ultimaVez, onCancion, onParte, onCerrar }: Omit<Props, 'abierta'>) {
  const [tab, setTab] = useState<'cancion' | 'parte'>('cancion')
  const [titulo, setTitulo] = useState('')
  const [resp, setResp] = useState('')
  const [min, setMin] = useState('')
  const [error, setError] = useState('')
  const disponibles = catalogo.filter((c) => !usadas.has(c.id))

  async function agregarParte(e: FormEvent) {
    e.preventDefault()
    if (!titulo.trim()) return setError('Escribe qué parte es.')
    const m = min ? Number(min) : null
    if (m !== null && !(Number.isInteger(m) && m >= 1 && m <= 180)) return setError('Los minutos van de 1 a 180.')
    const ok = await onParte(titulo.trim(), resp.trim() || null, m)
    if (!ok) return setError('No se pudo agregar. Intenta de nuevo.')
    onCerrar()
  }

  return (
    <>
      <div className="flex flex-col gap-1 mx-1">
        <h2 className="display m-0 text-2xl font-semibold">Agregar al orden</h2>
        <p className="m-0 text-[15px]" style={{ color: 'var(--muted)' }}>{tab === 'cancion' ? 'Solo aparecen las que el grupo ya tiene en fase Lista.' : 'Predicación, oración, ofrenda… lo que no es una canción.'}</p>
      </div>
      <div className="segmentado" style={{ gridTemplateColumns: '1fr 1fr' }} role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'cancion'} className={tab === 'cancion' ? 'on' : ''} onClick={() => setTab('cancion')}>Canción</button>
        <button type="button" role="tab" aria-selected={tab === 'parte'} className={tab === 'parte' ? 'on' : ''} onClick={() => setTab('parte')}>Otra parte</button>
      </div>

      {tab === 'cancion' ? (
        <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
          {disponibles.map((c) => (
            <button key={c.id} type="button" className="pick" onClick={async () => { await onCancion(c.id, c.titulo); onCerrar() }}>
              <span className="flex min-w-0 grow flex-col gap-px">
                <span className="text-[15px] font-extrabold">{c.titulo}</span>
                <span className="text-[13px]" style={{ color: 'var(--muted)' }}>{[c.autor, ultimaVez[c.id] ? `cantada ${relativo(ultimaVez[c.id]!)}` : 'aún no se ha cantado'].filter(Boolean).join(' · ')}</span>
              </span>
              {c.tono_original && <span className="key">{c.tono_original}</span>}
            </button>
          ))}
          {disponibles.length === 0 && (
            <p className="m-0 p-4 text-center text-[15px]" style={{ color: 'var(--muted)' }}>
              {catalogo.length === 0 ? 'Todavía no hay canciones en fase Lista. Pasa alguna a Lista desde el Cancionero.' : 'Todas las canciones listas ya están en este servicio.'}
            </p>
          )}
        </div>
      ) : (
        <form onSubmit={agregarParte} noValidate className="flex flex-col gap-3">
          <div className="scrollx" style={{ margin: '0 -20px', padding: '2px 20px' }}>
            {PARTES.map((p) => <button key={p} type="button" className="fchip" onClick={() => { setTitulo(p); setError('') }}>{p}</button>)}
          </div>
          <div className="field"><input id="p-t" type="text" placeholder=" " value={titulo} onChange={(e) => { setTitulo(e.target.value); setError('') }} maxLength={80} /><label htmlFor="p-t">Parte</label></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="field"><input id="p-r" type="text" placeholder=" " value={resp} onChange={(e) => setResp(e.target.value)} maxLength={60} /><label htmlFor="p-r">Responsable</label></div>
            <div className="field"><input id="p-m" type="number" inputMode="numeric" placeholder=" " value={min} onChange={(e) => { setMin(e.target.value); setError('') }} /><label htmlFor="p-m">Minutos</label></div>
          </div>
          <span role="status" className="min-h-5 px-1 text-sm font-semibold" style={{ color: 'var(--danger)' }}>{error}</span>
          <button type="submit" className="cta">Agregar parte</button>
        </form>
      )}
    </>
  )
}

export default function HojaAgregar({ abierta, onCerrar, ...resto }: Props) {
  return <Hoja titulo="Agregar al orden" abierta={abierta} onCerrar={onCerrar}><Contenido {...resto} onCerrar={onCerrar} /></Hoja>
}
