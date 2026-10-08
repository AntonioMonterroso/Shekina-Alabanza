import { Link, Outlet } from 'react-router-dom'
import Icon from './Icon'
import { useAuth } from '../hooks/authContext'
import { permisos } from '../lib/permisos'
import { ROL_LABEL } from '../lib/tipos'

export function AccesoDenegado({ titulo }: { titulo: string }) {
  const { rol } = useAuth()
  return (
    <div role="alert" className="flex min-h-[70dvh] flex-col items-center justify-center gap-3.5 px-10 text-center">
      <span className="grid h-[72px] w-[72px] place-items-center rounded-[24px]" style={{ background: 'var(--soft)', color: 'var(--primary)' }}><Icon name="candado" size={30} strokeWidth={2} /></span>
      <h2 className="display m-0 text-[26px] font-semibold">{titulo}</h2>
      <p className="m-0 text-base leading-normal" style={{ color: 'var(--muted)' }}>Como {rol ? ROL_LABEL[rol] : 'integrante'}, ves solo lo que te corresponde. Si necesitas acceso, pídeselo a un líder.</p>
      <Link to="/" className="mt-1.5 flex h-[50px] items-center rounded-2xl px-[22px] text-[15px] font-extrabold no-underline" style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}>Volver al inicio</Link>
    </div>
  )
}

/** Envuelve rutas: deja pasar solo a quien cumple el permiso (la seguridad real sigue siendo RLS). */
export function Requiere({ permiso, titulo }: { permiso: 'verCancionero' | 'verServicios' | 'verTurnos' | 'esLider'; titulo: string }) {
  const { rol } = useAuth()
  return permisos(rol)[permiso] ? <Outlet /> : <AccesoDenegado titulo={titulo} />
}
