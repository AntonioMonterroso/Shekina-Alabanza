import { Component, type ReactNode } from 'react'
import { registrarError } from '../lib/errores'

/** Si una pantalla se rompe, en vez de quedar en blanco se muestra esto y el error se anota para el propietario. */
export default class LimiteErrores extends Component<{ children: ReactNode }, { fallo: boolean }> {
  state = { fallo: false }
  static getDerivedStateFromError() { return { fallo: true } }
  componentDidCatch(error: Error) { void registrarError(error) }
  render() {
    if (!this.state.fallo) return this.props.children
    return (
      <div role="alert" className="pantalla grid place-items-center px-8 text-center">
        <div className="flex max-w-[380px] flex-col items-center gap-3.5">
          <h1 className="display m-0 text-[28px] leading-tight font-semibold">Algo salió mal en esta pantalla</h1>
          <p className="m-0 text-base leading-normal" style={{ color: 'var(--muted)' }}>Ya quedó anotado para que se arregle. Puedes volver al inicio o intentar de nuevo.</p>
          <a href={import.meta.env.BASE_URL} className="cta no-underline" style={{ width: 'auto', padding: '0 24px' }}>Volver al inicio</a>
          <button type="button" className="undo" onClick={() => location.reload()}>Intentar de nuevo</button>
        </div>
      </div>
    )
  }
}
