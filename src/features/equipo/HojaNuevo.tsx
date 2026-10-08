import { useState, type FormEvent } from 'react'
import Hoja from '../../components/Hoja'
import { ROL_LABEL } from '../../lib/tipos'
import { passwordTemporal, sugerirUsuario, type RolAsignable } from './useEquipoAdmin'

export const ROLES: RolAsignable[] = ['musico', 'voz', 'sonido', 'multimedia', 'alumno', 'lider']

interface Props {
  abierta: boolean
  onCerrar: () => void
  puedeNombrarLideres: boolean
  onCrear: (d: { usuario: string; nombre: string; password: string; rol: RolAsignable; descripcion: string }) => Promise<string | null>
}

function Formulario({ puedeNombrarLideres, onCrear, onCerrar }: Omit<Props, 'abierta'>) {
  const [nombre, setNombre] = useState('')
  const [usuario, setUsuario] = useState('')
  const [editoUsuario, setEditoUsuario] = useState(false)
  const [password, setPassword] = useState(passwordTemporal)
  const [rol, setRol] = useState<RolAsignable>('musico')
  const [descripcion, setDescripcion] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [creado, setCreado] = useState<{ usuario: string; password: string } | null>(null)
  const [copiado, setCopiado] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (nombre.trim().length < 2) return setError('Escribe el nombre del integrante.')
    if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) return setError('Usuario: 3 a 30 caracteres (minúsculas, números, . _ -).')
    setGuardando(true)
    const fallo = await onCrear({ usuario, nombre: nombre.trim(), password, rol, descripcion: descripcion.trim() })
    setGuardando(false)
    if (fallo) return setError(fallo)
    setCreado({ usuario, password })
  }

  async function copiar() {
    if (!creado) return
    try { await navigator.clipboard.writeText(`Usuario: ${creado.usuario}\nContraseña temporal: ${creado.password}`); setCopiado(true) } catch { setCopiado(false) }
  }

  if (creado) {
    return (
      <>
        <h2 className="display m-0 mx-1 text-2xl font-semibold">Integrante creado</h2>
        <p className="m-0 mx-1 text-[15px]" style={{ color: 'var(--muted)' }}>Compártele estos datos. Al entrar por primera vez tendrá que elegir su propia contraseña. Esta es la única vez que se muestra.</p>
        <div className="rounded-2xl p-4 text-base" style={{ background: 'var(--soft)' }}>
          <div>Usuario: <b>{creado.usuario}</b></div>
          <div>Contraseña temporal: <b className="select-all">{creado.password}</b></div>
        </div>
        <button type="button" className="cta" onClick={copiar}>{copiado ? 'Copiado' : 'Copiar datos'}</button>
        <button type="button" className="undo self-center" onClick={onCerrar}>Listo</button>
      </>
    )
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-3">
      <h2 className="display m-0 mx-1 text-2xl font-semibold">Nuevo integrante</h2>
      <div className="field"><input id="n-nombre" type="text" placeholder=" " value={nombre} maxLength={80} onChange={(e) => { setNombre(e.target.value); if (!editoUsuario) setUsuario(sugerirUsuario(e.target.value)); setError('') }} /><label htmlFor="n-nombre">Nombre</label></div>
      <div className="field"><input id="n-usuario" type="text" placeholder=" " autoCapitalize="none" autoCorrect="off" value={usuario} maxLength={30} onChange={(e) => { setUsuario(e.target.value.toLowerCase()); setEditoUsuario(true); setError('') }} /><label htmlFor="n-usuario">Usuario para entrar</label></div>
      <div className="field"><input id="n-pass" type="text" placeholder=" " autoCapitalize="none" value={password} maxLength={72} onChange={(e) => { setPassword(e.target.value); setError('') }} /><label htmlFor="n-pass">Contraseña temporal (mín. 8)</label></div>
      <label className="campo-sel"><span>Rol</span>
        <select value={rol} onChange={(e) => setRol(e.target.value as RolAsignable)}>
          {ROLES.filter((r) => r !== 'lider' || puedeNombrarLideres).map((r) => <option key={r} value={r}>{ROL_LABEL[r]}</option>)}
        </select>
      </label>
      <div className="field"><input id="n-desc" type="text" placeholder=" " value={descripcion} maxLength={80} onChange={(e) => setDescripcion(e.target.value)} /><label htmlFor="n-desc">Descripción (ej. Piano y teclados)</label></div>
      <span role="status" className="min-h-5 px-1 text-sm font-semibold" style={{ color: 'var(--danger)' }}>{error}</span>
      <button type="submit" className="cta" disabled={guardando}>{guardando ? <span className="spinner" aria-label="Creando" /> : 'Crear integrante'}</button>
    </form>
  )
}

export default function HojaNuevo({ abierta, onCerrar, ...resto }: Props) {
  return <Hoja titulo="Nuevo integrante" abierta={abierta} onCerrar={onCerrar}><Formulario {...resto} onCerrar={onCerrar} /></Hoja>
}
