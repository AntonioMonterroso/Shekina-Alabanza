import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import Hoja from '../components/Hoja'
import Icon, { type IconName } from '../components/Icon'
import { ToastProvider } from '../components/Toast'
import { useAuth } from '../hooks/AuthProvider'
import { permisos } from '../lib/permisos'

const Tab = ({ to, icono, texto, end }: { to: string; icono: IconName; texto: string; end?: boolean }) => (
  <NavLink to={to} end={end} className={({ isActive }) => 'tab' + (isActive ? ' on' : '')}>
    <Icon name={icono} /><span>{texto}</span>
  </NavLink>
)

export default function Layout() {
  const { rol } = useAuth()
  const p = permisos(rol)
  const navigate = useNavigate()
  const [crear, setCrear] = useState(false)
  const ir = (ruta: string) => { setCrear(false); navigate(ruta) }

  return (
    <ToastProvider>
      <div className="pantalla app-shell">
        <div className="app-scroll"><Outlet /></div>

        <nav aria-label="Navegación principal" className="rise barra" style={{ animationDelay: '440ms' }}>
          <Tab to="/" end icono="inicio" texto="Inicio" />
          {p.verCancionero && <Tab to="/cancionero" icono="cancionero" texto="Cancionero" />}
          <div className="flex flex-1 justify-center">
            {p.esLider && <button type="button" className="fab" aria-label="Crear" onClick={() => setCrear(true)}><Icon name="mas" size={26} strokeWidth={2.4} /></button>}
            {p.escenarioEnBarra && <NavLink to="/escenario" className="fab" aria-label="Abrir modo escenario"><Icon name="escenario" size={24} strokeWidth={2.2} /></NavLink>}
          </div>
          {p.verTurnos && <Tab to="/turnos" icono="turnos" texto="Turnos" />}
          {p.verEquipo ? <Tab to="/equipo" icono="equipo" texto="Equipo" /> : <Tab to="/perfil" icono="perfil" texto="Perfil" />}
        </nav>

        <Hoja titulo="Crear" abierta={crear} onCerrar={() => setCrear(false)}>
          <h2 className="display m-0 mx-1 text-2xl font-semibold">¿Qué quieres crear?</h2>
          <div className="grid grid-cols-2 gap-2.5">
            <button type="button" className="opt" onClick={() => ir('/servicios')}><span className="chip" style={{ background: '#D5ECE7', color: '#285F57' }}><Icon name="servicios" size={20} strokeWidth={2} /></span>Servicio</button>
            <button type="button" className="opt" onClick={() => ir('/cancionero')}><span className="chip" style={{ background: '#E6DDF5', color: '#533E87' }}><Icon name="cancionero" size={20} strokeWidth={2} /></span>Canción</button>
            <button type="button" className="opt" onClick={() => ir('/ensayos')}><span className="chip" style={{ background: '#FBE6CC', color: '#7A4E14' }}><Icon name="ensayos" size={20} strokeWidth={2} /></span>Ensayo</button>
            <button type="button" className="opt" onClick={() => ir('/avisos')}><span className="chip" style={{ background: '#F7D6CF', color: '#93394B' }}><Icon name="aviso" size={20} strokeWidth={2} /></span>Aviso al equipo</button>
          </div>
        </Hoja>
      </div>
    </ToastProvider>
  )
}
