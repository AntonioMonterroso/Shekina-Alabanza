import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import CambiarPassword from '../features/auth/CambiarPassword'
import Login from '../features/auth/Login'
import { Requiere } from '../components/AccesoDenegado'
import Inicio from '../features/inicio/Inicio'
import Perfil from '../features/perfil/Perfil'
import { AuthProvider } from '../hooks/AuthProvider'
import { SyncProvider } from '../hooks/SyncProvider'
import { useAuth } from '../hooks/authContext'
import { supabaseConfigurado } from '../lib/supabase'
import Layout from './Layout'

// Cada pantalla se baja al entrar en ella (la primera carga pesa menos). Todo queda guardado al instalar la app,
// así que también abren sin internet.
const Avisos = lazy(() => import('../features/avisos/Avisos'))
const Cancionero = lazy(() => import('../features/cancionero/Cancionero'))
const CancionDetalle = lazy(() => import('../features/cancionero/CancionDetalle'))
const CancionForm = lazy(() => import('../features/cancionero/CancionForm'))
const Turnos = lazy(() => import('../features/turnos/Turnos'))
const Servicios = lazy(() => import('../features/servicios/Servicios'))
const Propuestas = lazy(() => import('../features/propuestas/Propuestas'))
const Ensayos = lazy(() => import('../features/ensayos/Ensayos'))
const Clase = lazy(() => import('../features/escuela/Clase'))
const Practicar = lazy(() => import('../features/escuela/Practicar'))
const Escuela = lazy(() => import('../features/escuela/Escuela'))
const Equipo = lazy(() => import('../features/equipo/Equipo'))
const Escenario = lazy(() => import('../features/escenario/Escenario'))
const Pantalla = lazy(() => import('../features/proyeccion/Pantalla'))
const Proyeccion = lazy(() => import('../features/proyeccion/Proyeccion'))
const Publico = lazy(() => import('../features/publico/Publico'))

const Cargando = () => <div className="pantalla grid place-items-center"><span className="spinner" role="status" style={{ borderColor: 'var(--line)', borderTopColor: 'var(--primary)' }} aria-label="Cargando" /></div>

function Protegida({ conBarra = true }: { conBarra?: boolean }) {
  const { cargando, session, perfil } = useAuth()
  if (cargando) return <div className="pantalla grid place-items-center"><span className="spinner" style={{ borderColor: 'var(--line)', borderTopColor: 'var(--primary)' }} aria-label="Cargando" /></div>
  if (!session) return <Navigate to="/login" replace />
  if (perfil?.debe_cambiar_password) return <CambiarPassword />
  return conBarra ? <Layout /> : <Outlet />
}

export default function App() {
  return (
    <AuthProvider>
      {!supabaseConfigurado && (
        <div role="alert" className="fixed inset-x-0 top-0 z-50 bg-[#b3261e] px-4 py-2 text-center text-sm font-bold text-white">
          Falta .env.local con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
        </div>
      )}
      <SyncProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Suspense fallback={<Cargando />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/p/:slug" element={<Publico />} />
          {/* Modo escenario: pantalla completa, sin barra inferior */}
          <Route element={<Protegida conBarra={false} />}>
            <Route path="escuela/practicar/:id" element={<Practicar />} />
            <Route path="proyeccion/pantalla" element={<Requiere permiso="verProyeccion" titulo="La proyección no es para tu rol" />}>
              <Route index element={<Pantalla />} />
            </Route>
            <Route path="escenario" element={<Requiere permiso="verEscenario" titulo="El modo escenario no es para tu rol" />}>
              <Route index element={<Escenario />} />
            </Route>
          </Route>
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
            <Route path="escuela" element={<Escuela />} />
            <Route path="escuela/clase/:id" element={<Clase />} />
            <Route path="propuestas" element={<Requiere permiso="esLider" titulo="Solo los líderes ven las propuestas" />}>
              <Route index element={<Propuestas />} />
            </Route>
            <Route path="ensayos" element={<Requiere permiso="verEnsayos" titulo="Ensayos no es para tu rol" />}>
              <Route index element={<Ensayos />} />
            </Route>
            <Route path="equipo" element={<Requiere permiso="verEquipo" titulo="Equipo no es para tu rol" />}>
              <Route index element={<Equipo />} />
            </Route>
            <Route path="proyeccion" element={<Requiere permiso="verProyeccion" titulo="La proyección no es para tu rol" />}>
              <Route index element={<Proyeccion />} />
            </Route>
            <Route path="avisos" element={<Avisos />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
      </SyncProvider>
    </AuthProvider>
  )
}
