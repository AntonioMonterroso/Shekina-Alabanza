import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import CambiarPassword from '../features/auth/CambiarPassword'
import Login from '../features/auth/Login'
import { Requiere } from '../components/AccesoDenegado'
import Cancionero from '../features/cancionero/Cancionero'
import CancionDetalle from '../features/cancionero/CancionDetalle'
import CancionForm from '../features/cancionero/CancionForm'
import Turnos from '../features/turnos/Turnos'
import Servicios from '../features/servicios/Servicios'
import Inicio from '../features/inicio/Inicio'
import Perfil from '../features/perfil/Perfil'
import Proximamente from '../features/proximamente/Proximamente'
import Publico from '../features/publico/Publico'
import { AuthProvider } from '../hooks/AuthProvider'
import { useAuth } from '../hooks/authContext'
import { supabaseConfigurado } from '../lib/supabase'
import Layout from './Layout'

function Protegida() {
  const { cargando, session, perfil } = useAuth()
  if (cargando) return <div className="pantalla grid place-items-center"><span className="spinner" style={{ borderColor: 'var(--line)', borderTopColor: 'var(--primary)' }} aria-label="Cargando" /></div>
  if (!session) return <Navigate to="/login" replace />
  if (perfil?.debe_cambiar_password) return <CambiarPassword />
  return <Layout />
}

const pronto = (titulo: string, detalle: string) => <Proximamente titulo={titulo} detalle={detalle} />

export default function App() {
  return (
    <AuthProvider>
      {!supabaseConfigurado && (
        <div role="alert" className="fixed inset-x-0 top-0 z-50 bg-[#b3261e] px-4 py-2 text-center text-sm font-bold text-white">
          Falta .env.local con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
        </div>
      )}
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/p/:slug" element={<Publico />} />
          <Route element={<Protegida />}>
            <Route index element={<Inicio />} />
            <Route path="perfil" element={<Perfil />} />
            <Route path="servicios" element={<Requiere permiso="verServicios" titulo="Servicios no es para tu rol" />}>
              <Route index element={<Servicios />} />
            </Route>
            <Route path="cancionero" element={<Requiere permiso="verCancionero" titulo="El cancionero no es para tu rol" />}>
              <Route index element={<Cancionero />} />
              <Route path=":id" element={<CancionDetalle />} />
              <Route element={<Requiere permiso="esLider" titulo="Solo los líderes editan canciones" />}>
                <Route path="nueva" element={<CancionForm />} />
                <Route path=":id/editar" element={<CancionForm />} />
              </Route>
            </Route>
            <Route path="turnos" element={<Requiere permiso="verTurnos" titulo="Turnos no es para tu rol" />}>
              <Route index element={<Turnos />} />
            </Route>
            <Route path="ensayos" element={pronto('Ensayos', 'Asistencia, canciones a ensayar y guías. Es el paso 10 del plan.')} />
            <Route path="equipo" element={pronto('Equipo', 'Agregar integrantes, roles y cambio de contraseñas. Es el paso 11 del plan.')} />
            <Route path="escenario" element={pronto('Modo escenario', 'Letra y acordes en grande, con transposición. Es el paso 9 del plan.')} />
            <Route path="proyeccion" element={pronto('Proyección', 'Control de la pantalla del templo. Llega después de Cancionero y Servicios.')} />
            <Route path="avisos" element={pronto('Avisos', 'Mensajes para todo el equipo.')} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
