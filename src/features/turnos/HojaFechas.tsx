import { useState } from 'react'
import Hoja from '../../components/Hoja'
import { diaSemanaCap, diaNum, hoyGT, mediodiaGT, mesCorto } from '../../lib/fechas'

interface Props {
  abierta: boolean
  onCerrar: () => void
  /** fechas (YYYY-MM-DD) de los próximos servicios */
  fechasServicio: string[]
  /** mis fechas ya guardadas */
  guardadas: string[]
  onGuardar: (fechas: string[]) => Promise<boolean>
}

function Contenido({ fechasServicio, guardadas, onGuardar, onCerrar }: Omit<Props, 'abierta'>) {
  const [sel, setSel] = useState<Set<string>>(new Set(guardadas))
  const [extra, setExtra] = useState<string[]>([])
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const todas = [...new Set([...fechasServicio, ...guardadas, ...extra])].sort()

  const alternar = (f: string) => setSel((s) => { const n = new Set(s); if (n.has(f)) n.delete(f); else n.add(f); return n })

  async function guardar() {
    setGuardando(true)
    const ok = await onGuardar([...sel])
    setGuardando(false)
    if (!ok) return setError('No se pudo guardar. Intenta de nuevo.')
    onCerrar()
  }

  return (
    <>
      <div className="mx-1 flex flex-col gap-1">
        <h2 className="display m-0 text-2xl font-semibold">¿Qué fechas no puedes?</h2>
        <p className="m-0 text-[15px]" style={{ color: 'var(--muted)' }}>El líder no te asignará esos días y verá tu aviso al reasignar.</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {todas.map((f) => {
          const d = mediodiaGT(f)
          const on = sel.has(f)
          return <button key={f} type="button" aria-pressed={on} className={'dchip' + (on ? ' on' : '')} onClick={() => { alternar(f); setError('') }}><small>{diaSemanaCap(d)}</small><b>{diaNum(d)} {mesCorto(d)}</b></button>
        })}
      </div>
      {todas.length === 0 && <p className="m-0 text-[15px]" style={{ color: 'var(--muted)' }}>Todavía no hay servicios próximos. Puedes agregar una fecha a mano.</p>}
      <label className="campo-sel"><span>Agregar otra fecha</span>
        <input type="date" min={hoyGT()} value="" onChange={(e) => { const v = e.target.value; if (!v) return; setExtra((x) => [...x, v]); setSel((s) => new Set(s).add(v)) }} style={{ border: 0, background: 'transparent', color: 'var(--ink)', font: 'inherit', fontSize: 17, outline: 'none', padding: 0 }} />
      </label>
      <span role="status" className="min-h-5 px-1 text-sm font-semibold" style={{ color: 'var(--danger)' }}>{error}</span>
      <button type="button" className="cta" disabled={guardando} onClick={guardar}>{guardando ? <span className="spinner" aria-label="Guardando" /> : 'Guardar'}</button>
    </>
  )
}

export default function HojaFechas({ abierta, onCerrar, ...resto }: Props) {
  return <Hoja titulo="Fechas que no puedo" abierta={abierta} onCerrar={onCerrar}><Contenido {...resto} onCerrar={onCerrar} /></Hoja>
}
