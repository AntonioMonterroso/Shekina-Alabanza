import { useState } from 'react'
import Hoja from '../../components/Hoja'
import type { RolEquipo } from './api'

const ROLES: [RolEquipo, string][] = [['musico', 'Músico'], ['voz', 'Voz'], ['sonido', 'Sonido'], ['multimedia', 'Multimedia']]

interface Props {
  alumno: { id: string; nombre: string } | null
  puestos: string[]
  onCerrar: () => void
  /** devuelve un mensaje de error o null */
  onPasar: (alumnoId: string, rol: RolEquipo, puestos: string[]) => Promise<string | null>
}

function Contenido({ alumno, puestos, onCerrar, onPasar }: Omit<Props, 'alumno'> & { alumno: { id: string; nombre: string } }) {
  const [rol, setRol] = useState<RolEquipo>('musico')
  const [cubre, setCubre] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function pasar() {
    setGuardando(true)
    const fallo = await onPasar(alumno.id, rol, puestos.filter((p) => cubre.has(p)))
    setGuardando(false)
    if (fallo) return setError(fallo)
    onCerrar()
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="display m-0 mx-1 text-2xl font-semibold">Pasar a {alumno.nombre.split(' ')[0]} al equipo</h2>
      <p className="m-0 mx-1 text-[15px]" style={{ color: 'var(--muted)' }}>Va a poder ver servicios, cancionero, turnos y ensayos como el resto del equipo. Seguirá en sus clases de la Escuela.</p>
      <div className="segmentado" role="radiogroup" aria-label="Rol en el equipo">
        {ROLES.map(([v, t]) => <button key={v} type="button" role="radio" aria-checked={rol === v} className={rol === v ? 'on' : ''} onClick={() => setRol(v)}>{t}</button>)}
      </div>
      {puestos.length > 0 && (
        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-2 px-1 text-sm font-extrabold">Puestos que puede cubrir</legend>
          <div className="flex flex-wrap gap-2">
            {puestos.map((p) => {
              const on = cubre.has(p)
              return <button key={p} type="button" aria-pressed={on} className="more" style={on ? { background: 'var(--primary)', borderColor: 'var(--primary)', color: 'var(--on-primary)' } : undefined} onClick={() => setCubre((s) => { const n = new Set(s); if (on) n.delete(p); else n.add(p); return n })}>{p}</button>
            })}
          </div>
        </fieldset>
      )}
      <span role="status" className="min-h-5 px-1 text-sm font-semibold" style={{ color: 'var(--danger)' }}>{error}</span>
      <button type="button" className="cta" disabled={guardando} onClick={pasar}>{guardando ? <span className="spinner" aria-label="Guardando" /> : 'Pasar al equipo'}</button>
    </div>
  )
}

export default function HojaPasar({ alumno, ...resto }: Props) {
  return (
    <Hoja titulo="Pasar al equipo" abierta={alumno !== null} onCerrar={resto.onCerrar}>
      {alumno && <Contenido key={alumno.id} alumno={alumno} {...resto} />}
    </Hoja>
  )
}
