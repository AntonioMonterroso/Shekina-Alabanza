import { useState, type FormEvent } from 'react'
import { useAuth } from '../../hooks/authContext'
import { supabase } from '../../lib/supabase'

// Se muestra al entrar con una contraseña temporal que dio un líder.
export default function CambiarPassword() {
  const { perfil, recargar, salir } = useAuth()
  const [nueva, setNueva] = useState('')
  const [repite, setRepite] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (nueva.length < 8) return setError('Usa al menos 8 caracteres.')
    if (nueva !== repite) return setError('Las contraseñas no coinciden.')
    setGuardando(true)
    const { error: err } = await supabase.auth.updateUser({ password: nueva })
    if (err) {
      setGuardando(false)
      return setError(err.message.toLowerCase().includes('different') ? 'Elige una contraseña distinta a la temporal.' : 'No se pudo guardar. Intenta de nuevo.')
    }
    await supabase.from('perfiles').update({ debe_cambiar_password: false }).eq('id', perfil!.id)
    await recargar()
  }

  return (
    <main className="pantalla grid place-items-center px-7" style={{ background: 'var(--bg)' }}>
      <form onSubmit={enviar} className="flex w-full max-w-[420px] flex-col gap-3.5">
        <h1 className="display m-0 text-[32px] leading-tight font-semibold">Crea tu contraseña</h1>
        <p className="m-0 text-base" style={{ color: 'var(--muted)' }}>
          Hola {perfil?.nombre.split(' ')[0]}. Entraste con una contraseña temporal; elige la tuya para continuar.
        </p>
        <div className="field mt-3"><input id="n1" type="password" autoComplete="new-password" placeholder=" " value={nueva} onChange={(e) => { setNueva(e.target.value); setError('') }} /><label htmlFor="n1">Contraseña nueva</label></div>
        <div className="field"><input id="n2" type="password" autoComplete="new-password" placeholder=" " value={repite} onChange={(e) => { setRepite(e.target.value); setError('') }} /><label htmlFor="n2">Repítela</label></div>
        <span role="status" className="min-h-[22px] px-1 text-sm font-semibold" style={{ color: 'var(--danger)' }}>{error}</span>
        <button type="submit" className="cta" disabled={guardando}>{guardando ? <span className="spinner" aria-label="Guardando" /> : 'Guardar y entrar'}</button>
        <button type="button" onClick={salir} className="mt-1 cursor-pointer border-0 bg-transparent text-sm font-bold" style={{ color: 'var(--muted)' }}>Salir</button>
      </form>
    </main>
  )
}
