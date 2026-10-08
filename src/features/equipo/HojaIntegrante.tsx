import { useState } from 'react'
import Hoja from '../../components/Hoja'
import { ROL_LABEL } from '../../lib/tipos'
import { ROLES } from './HojaNuevo'
import { passwordTemporal, type Integrante, type RolAsignable } from './useEquipoAdmin'

interface Props {
  integrante: Integrante | null
  puestosDisponibles: string[]
  soyPropietario: boolean
  esYo: boolean
  onCerrar: () => void
  onGuardar: (id: string, c: { rol?: RolAsignable; descripcion?: string | null; puestos?: string[] }) => Promise<string | null>
  onQuitar: (id: string) => Promise<string | null>
  onPassword: (id: string, password: string) => Promise<string | null>
}

function Contenido({ m, puestosDisponibles, soyPropietario, esYo, onCerrar, onGuardar, onQuitar, onPassword }: Omit<Props, 'integrante'> & { m: Integrante }) {
  const esProp = m.rol === 'propietario'
  // El propietario no cambia de rol ni de contraseña desde aquí; un líder solo lo toca el propietario
  const intocable = esProp || (m.rol === 'lider' && !soyPropietario)
  const [rol, setRol] = useState<Exclude<typeof m.rol, 'propietario'> | 'propietario'>(m.rol)
  const [descripcion, setDescripcion] = useState(m.descripcion ?? '')
  const [puestos, setPuestos] = useState(new Set(m.puestos))
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [modo, setModo] = useState<'editar' | 'password' | 'quitar'>('editar')
  const [password, setPassword] = useState(passwordTemporal)
  const [listo, setListo] = useState<string | null>(null)

  async function guardar() {
    setGuardando(true)
    const fallo = await onGuardar(m.id, { ...(intocable ? {} : { rol: rol as RolAsignable }), descripcion: descripcion.trim() || null, puestos: puestosDisponibles.filter((p) => puestos.has(p)).concat(m.puestos.filter((p) => !puestosDisponibles.includes(p) && puestos.has(p))) })
    setGuardando(false)
    if (fallo) return setError(fallo)
    onCerrar()
  }

  async function cambiarPassword() {
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.')
    setGuardando(true)
    const fallo = await onPassword(m.id, password)
    setGuardando(false)
    if (fallo) return setError(fallo)
    setListo(password)
  }

  async function quitar() {
    setGuardando(true)
    const fallo = await onQuitar(m.id)
    setGuardando(false)
    if (fallo) { setModo('editar'); return setError(fallo) }
    onCerrar()
  }

  if (modo === 'quitar') {
    return (
      <>
        <h2 className="display m-0 mx-1 text-2xl font-semibold">¿Quitar a {m.nombre}?</h2>
        <p className="m-0 mx-1 text-[15px]" style={{ color: 'var(--muted)' }}>Ya no podrá entrar a este grupo. Su historial de turnos y notas se conserva.</p>
        <div className="flex gap-2.5">
          <button type="button" className="ghost-link grow" onClick={() => setModo('editar')}>Cancelar</button>
          <button type="button" className="adv grow" style={{ background: 'var(--danger)', color: 'var(--bg)' }} disabled={guardando} onClick={quitar}>Quitar</button>
        </div>
      </>
    )
  }

  if (modo === 'password') {
    return listo ? (
      <>
        <h2 className="display m-0 mx-1 text-2xl font-semibold">Contraseña cambiada</h2>
        <p className="m-0 mx-1 text-[15px]" style={{ color: 'var(--muted)' }}>Compártela con {m.nombre}. Al entrar tendrá que elegir una propia. Solo se muestra ahora.</p>
        <div className="rounded-2xl p-4 text-base" style={{ background: 'var(--soft)' }}>Usuario: <b>{m.usuario}</b><br />Contraseña temporal: <b className="select-all">{listo}</b></div>
        <button type="button" className="cta" onClick={onCerrar}>Listo</button>
      </>
    ) : (
      <>
        <h2 className="display m-0 mx-1 text-2xl font-semibold">Nueva contraseña</h2>
        <div className="field"><input id="i-pass" type="text" placeholder=" " autoCapitalize="none" value={password} maxLength={72} onChange={(e) => { setPassword(e.target.value); setError('') }} /><label htmlFor="i-pass">Contraseña temporal (mín. 8)</label></div>
        <button type="button" className="undo self-start" onClick={() => setPassword(passwordTemporal())}>Generar otra</button>
        <span role="status" className="min-h-5 px-1 text-sm font-semibold" style={{ color: 'var(--danger)' }}>{error}</span>
        <button type="button" className="cta" disabled={guardando} onClick={cambiarPassword}>{guardando ? <span className="spinner" aria-label="Guardando" /> : 'Cambiar contraseña'}</button>
        <button type="button" className="undo self-center" onClick={() => { setModo('editar'); setError('') }}>Volver</button>
      </>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="display m-0 mx-1 text-2xl font-semibold">{m.nombre}</h2>
      <p className="m-0 mx-1 -mt-2 text-sm font-bold" style={{ color: 'var(--muted)' }}>@{m.usuario}</p>
      {intocable ? (
        <p className="m-0 mx-1 text-[15px]" style={{ color: 'var(--muted)' }}>{esProp ? 'El propietario no cambia de rol.' : 'Solo el propietario cambia el rol de un líder.'}</p>
      ) : (
        <label className="campo-sel"><span>Rol</span>
          <select value={rol} onChange={(e) => setRol(e.target.value as typeof rol)}>
            {ROLES.filter((r) => r !== 'lider' || soyPropietario || m.rol === 'lider').map((r) => <option key={r} value={r}>{ROL_LABEL[r]}</option>)}
          </select>
        </label>
      )}
      <div className="field"><input id="i-desc" type="text" placeholder=" " value={descripcion} maxLength={80} onChange={(e) => setDescripcion(e.target.value)} /><label htmlFor="i-desc">Descripción</label></div>
      {puestosDisponibles.length > 0 && (
        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-2 px-1 text-sm font-extrabold">Puestos que puede cubrir</legend>
          <div className="flex flex-wrap gap-2">
            {puestosDisponibles.map((p) => {
              const on = puestos.has(p)
              return (
                <button key={p} type="button" aria-pressed={on} className="more" style={on ? { background: 'var(--primary)', borderColor: 'var(--primary)', color: 'var(--on-primary)' } : undefined}
                  onClick={() => setPuestos((s) => { const n = new Set(s); if (on) n.delete(p); else n.add(p); return n })}>{p}</button>
              )
            })}
          </div>
        </fieldset>
      )}
      <span role="status" className="min-h-5 px-1 text-sm font-semibold" style={{ color: 'var(--danger)' }}>{error}</span>
      <button type="button" className="cta" disabled={guardando} onClick={guardar}>{guardando ? <span className="spinner" aria-label="Guardando" /> : 'Guardar cambios'}</button>
      {!intocable && (
        <div className="flex justify-center gap-4">
          <button type="button" className="undo" onClick={() => { setModo('password'); setError('') }}>Cambiar contraseña</button>
          {!esYo && <button type="button" className="undo" style={{ color: 'var(--danger)' }} onClick={() => setModo('quitar')}>Quitar del grupo</button>}
        </div>
      )}
    </div>
  )
}

export default function HojaIntegrante({ integrante, onCerrar, ...resto }: Props) {
  return (
    <Hoja titulo="Integrante" abierta={integrante !== null} onCerrar={onCerrar}>
      {integrante && <Contenido key={integrante.id} m={integrante} onCerrar={onCerrar} {...resto} />}
    </Hoja>
  )
}
