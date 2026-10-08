import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/AuthProvider'
import { correoDeUsuario, normalizarUsuario, usuarioValido } from '../../lib/usuario'
import { supabase, supabaseConfigurado } from '../../lib/supabase'

type Fase = 'idle' | 'loading' | 'done'
const SLUG_PUBLICO = (import.meta.env.VITE_SLUG_PUBLICO as string | undefined) ?? 'alabanza'

export default function Login() {
  const { session, cargando } = useAuth()
  const navigate = useNavigate()
  const [usuario, setUsuario] = useState('')
  const [pass, setPass] = useState('')
  const [ver, setVer] = useState(false)
  const [fase, setFase] = useState<Fase>('idle')
  const [error, setError] = useState('')
  const [campoErr, setCampoErr] = useState<'' | 'usuario' | 'pass'>('')
  const [ayuda, setAyuda] = useState(false)
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const luego = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)) }

  // Si ya hay sesión, sigue a la app (salvo mientras se muestra el "¡Bienvenido!")
  if (session && !cargando && fase === 'idle') return <Navigate to="/" replace />

  const marcar = (campo: 'usuario' | 'pass', msg: string) => {
    setError(msg)
    setCampoErr(campo)
    luego(() => setCampoErr(''), 450)
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (fase !== 'idle') return
    const u = normalizarUsuario(usuario)
    if (!usuarioValido(u)) return marcar('usuario', 'Revisa tu usuario.')
    if (!pass) return marcar('pass', 'Escribe tu contraseña.')
    if (!supabaseConfigurado) return setError('Falta configurar Supabase (.env.local).')

    setFase('loading')
    setError('')
    const { error: err } = await supabase.auth.signInWithPassword({ email: correoDeUsuario(u), password: pass })
    if (err) {
      setFase('idle')
      marcar('pass', err.status === 400 || err.status === 401 ? 'Usuario o contraseña incorrectos.' : 'No pudimos entrar. Intenta de nuevo.')
      return
    }
    setFase('done')
    luego(() => navigate('/', { replace: true }), 900)
  }

  return (
    <main className="pantalla" style={{ background: 'var(--bg)' }}>
      <div aria-hidden className="blob" style={{ width: 300, height: 280, right: -110, top: -90, background: 'var(--blob1)' }} />
      <div aria-hidden className="blob b2" style={{ width: 220, height: 210, left: -100, bottom: 120, background: 'var(--blob2)' }} />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-[460px] flex-col px-7 pt-[84px] pb-[34px]">
        <div
          className="rise flex h-[68px] w-[68px] items-center justify-center rounded-[24px] bg-white"
          style={{ boxShadow: '0 8px 22px -14px var(--ink)' }}
        >
          <div className="eq" aria-hidden>
            <span style={{ background: 'var(--leaf)' }} />
            <span style={{ background: 'var(--primary)' }} />
            <span style={{ background: 'var(--leaf)' }} />
            <span style={{ background: 'var(--primary)' }} />
            <span style={{ background: 'var(--leaf)' }} />
          </div>
        </div>

        <Link to={`/p/${SLUG_PUBLICO}`} className="rise btn-ghost absolute right-7 top-[96px]" style={{ animationDelay: '80ms', color: 'var(--ink)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5z" /></svg>
          <span>Ver público</span>
        </Link>

        <div className="mt-9 flex flex-col gap-2.5">
          <h1 className="rise display m-0 text-[38px] leading-[1.08] font-semibold tracking-[-0.02em]" style={{ animationDelay: '120ms' }}>¡Qué gusto verte!</h1>
          <p className="rise m-0 text-[17px]" style={{ animationDelay: '200ms', color: 'var(--muted)' }}>Entra a tu espacio musical.</p>
        </div>

        <form onSubmit={enviar} noValidate className="mt-9 flex flex-col gap-3.5">
          <div className="rise" style={{ animationDelay: '300ms' }}>
            <div className={'field' + (campoErr === 'usuario' ? ' err' : '')}>
              <input
                id="usuario" type="text" inputMode="text" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                placeholder=" " value={usuario} onChange={(e) => { setUsuario(e.target.value); setError('') }}
              />
              <label htmlFor="usuario">Usuario</label>
            </div>
          </div>

          <div className="rise" style={{ animationDelay: '380ms' }}>
            <div className={'field' + (campoErr === 'pass' ? ' err' : '')}>
              <input
                id="pass" type={ver ? 'text' : 'password'} autoComplete="current-password"
                placeholder=" " value={pass} onChange={(e) => { setPass(e.target.value); setError('') }}
              />
              <label htmlFor="pass">Contraseña</label>
              <button type="button" className="eye" aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setVer(!ver)}>
                {ver ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l18 18" /><path d="M10.6 5.1A10 10 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-2.9 3.8M6.3 6.4C3.8 8.1 2.5 12 2.5 12s3.5 7 9.5 7c1.7 0 3.2-.5 4.5-1.3" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" /><circle cx="12" cy="12" r="3" /></svg>
                )}
              </button>
            </div>
          </div>

          <div className="rise flex min-h-[22px] items-center justify-between px-1" style={{ animationDelay: '440ms' }}>
            <span role="status" className="text-sm font-semibold" style={{ color: 'var(--danger)' }}>{error}</span>
            <button type="button" onClick={() => setAyuda(!ayuda)} aria-expanded={ayuda} className="cursor-pointer border-0 bg-transparent p-0 text-sm font-bold" style={{ color: 'var(--primary)', font: 'inherit', fontSize: 14, fontWeight: 700 }}>
              ¿Olvidaste tu contraseña?
            </button>
          </div>
          {ayuda && (
            <p className="m-0 rounded-2xl px-4 py-3 text-sm" style={{ background: 'var(--soft)', color: 'var(--muted)' }}>
              Pídele a tu líder que te dé una nueva desde la sección Equipo.
            </p>
          )}

          <div className="rise mt-2" style={{ animationDelay: '520ms' }}>
            <button type="submit" className="cta" disabled={fase !== 'idle'}>
              {fase === 'idle' && (<>
                <span>Entrar</span>
                <svg className="arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </>)}
              {fase === 'loading' && <span className="spinner" role="status" aria-label="Cargando" />}
              {fase === 'done' && (<>
                <svg className="check" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5l5 5L20 6.5" /></svg>
                <span>¡Bienvenido!</span>
              </>)}
            </button>
          </div>
        </form>

        <p className="rise mt-auto mb-0 pt-8 text-center text-[15px]" style={{ animationDelay: '600ms', color: 'var(--muted)' }}>
          ¿Sin acceso? Tu líder te da tu usuario y contraseña.
        </p>
      </div>
    </main>
  )
}
