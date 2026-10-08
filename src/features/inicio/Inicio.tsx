import { useAuth } from '../../hooks/AuthProvider'
import { ROL_LABEL } from '../../lib/tipos'

// Marcador del paso 4 (Inicio + navegación por rol). Por ahora confirma que la sesión y el rol funcionan.
export default function Inicio() {
  const { perfil, membresia, rol, salir } = useAuth()
  return (
    <main className="pantalla px-7 pt-16">
      <div className="mx-auto max-w-[460px]">
        <p className="m-0 text-sm font-bold" style={{ color: 'var(--muted)' }}>{membresia?.grupo.nombre ?? 'Sin grupo'}</p>
        <h1 className="display m-0 mt-1 text-[34px] leading-tight font-semibold">Hola, {perfil?.nombre.split(' ')[0]}</h1>
        {rol ? (
          <p className="mt-2 text-base" style={{ color: 'var(--muted)' }}>Tu rol: <b style={{ color: 'var(--ink)' }}>{ROL_LABEL[rol]}</b></p>
        ) : (
          <p className="mt-2 rounded-2xl p-4 text-base" style={{ background: 'var(--soft)' }}>Tu usuario todavía no está en ningún grupo. Pídele a tu líder que te agregue.</p>
        )}
        <button onClick={salir} className="btn-ghost mt-8" style={{ color: 'var(--ink)' }}>Cerrar sesión</button>
      </div>
    </main>
  )
}
