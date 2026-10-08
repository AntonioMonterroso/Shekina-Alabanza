import { useState, type FormEvent } from 'react'
import Icon from '../../components/Icon'
import { useToast } from '../../components/Toast'
import { useAuth } from '../../hooks/authContext'
import { supabase } from '../../lib/supabase'
import { ROL_LABEL, TEMAS, type Modo } from '../../lib/tipos'

const MODOS: { id: Modo; nombre: string }[] = [
  { id: 'claro', nombre: 'Claro' },
  { id: 'oscuro', nombre: 'Oscuro' },
  { id: 'auto', nombre: 'Automático' },
]

export default function Perfil() {
  const { perfil, membresia, rol, cambiarTema, cambiarModo, salir } = useAuth()
  const toast = useToast()
  const [nueva, setNueva] = useState('')
  const [repite, setRepite] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function cambiarPassword(e: FormEvent) {
    e.preventDefault()
    if (nueva.length < 8) return setError('Usa al menos 8 caracteres.')
    if (nueva !== repite) return setError('Las contraseñas no coinciden.')
    setGuardando(true)
    const { error: err } = await supabase.auth.updateUser({ password: nueva })
    setGuardando(false)
    if (err) return setError('No se pudo cambiar. Intenta de nuevo.')
    setNueva(''); setRepite(''); setError('')
    toast('Contraseña actualizada')
  }

  return (
    <div className="flex flex-col gap-5 px-5 pt-[52px]">
      <header className="px-1">
        <p className="m-0 text-sm font-extrabold" style={{ color: 'var(--muted)' }}>{membresia?.grupo.nombre}{rol ? ` · ${ROL_LABEL[rol]}` : ''}</p>
        <h1 className="display m-0 text-[30px] leading-[1.1] font-semibold tracking-[-0.02em]">{perfil?.nombre}</h1>
        <p className="m-0 mt-1 text-sm" style={{ color: 'var(--muted)' }}>Usuario: {perfil?.usuario}</p>
      </header>

      <section className="order p-4" aria-label="Apariencia">
        <h2 className="m-0 mb-3 text-[15px] font-extrabold">Modo</h2>
        <div className="segmentado" role="radiogroup" aria-label="Modo claro u oscuro">
          {MODOS.map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={perfil?.modo === m.id} className={perfil?.modo === m.id ? 'on' : ''} onClick={() => cambiarModo(m.id)}>{m.nombre}</button>
          ))}
        </div>
        <h2 className="m-0 mt-5 mb-3 text-[15px] font-extrabold">Color</h2>
        <div className="grid grid-cols-3 gap-2.5" role="radiogroup" aria-label="Tema de color">
          {TEMAS.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={perfil?.tema === t.id} className={'tema-op' + (perfil?.tema === t.id ? ' on' : '')} onClick={() => cambiarTema(t.id)}>
              <span className="tema-muestra" style={{ background: t.color }} aria-hidden>{perfil?.tema === t.id && <Icon name="check" size={16} strokeWidth={3} />}</span>
              <span className="text-[13px] font-extrabold">{t.nombre}</span>
            </button>
          ))}
        </div>
      </section>

      <form onSubmit={cambiarPassword} className="order p-4" aria-label="Cambiar contraseña" noValidate>
        <h2 className="m-0 mb-3 text-[15px] font-extrabold">Cambiar contraseña</h2>
        <div className="flex flex-col gap-3">
          <div className="field"><input id="pn1" type="password" autoComplete="new-password" placeholder=" " value={nueva} onChange={(e) => { setNueva(e.target.value); setError('') }} /><label htmlFor="pn1">Contraseña nueva</label></div>
          <div className="field"><input id="pn2" type="password" autoComplete="new-password" placeholder=" " value={repite} onChange={(e) => { setRepite(e.target.value); setError('') }} /><label htmlFor="pn2">Repítela</label></div>
          <span role="status" className="min-h-5 px-1 text-sm font-semibold" style={{ color: 'var(--danger)' }}>{error}</span>
          <button type="submit" className="cta" disabled={guardando || !nueva}>{guardando ? <span className="spinner" aria-label="Guardando" /> : 'Guardar contraseña'}</button>
        </div>
      </form>

      <button type="button" onClick={salir} className="btn-ghost self-start" style={{ color: 'var(--ink)' }}>Cerrar sesión</button>
    </div>
  )
}
