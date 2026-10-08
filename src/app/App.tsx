import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import CambiarPassword from '../features/auth/CambiarPassword'
import Login from '../features/auth/Login'
import Inicio from '../features/inicio/Inicio'
import Publico from '../features/publico/Publico'
import { AuthProvider, useAuth } from '../hooks/AuthProvider'
import { supabaseConfigurado } from '../lib/supabase'

function Protegida() {
  const { cargando, session, perfil } = useAuth()
  if (cargando) return <div className="pantalla grid place-items-center"><span className="spinner" style={{ borderColor: 'var(--line)', borderTopColor: 'var(--primary)' }} aria-label="Cargando" /></div>
  if (!session) return <Navigate to="/login" replace />
  if (perfil?.debe_cambiar_password) return <CambiarPassword />
  return <Inicio />
}

export default function App() {
  return (
    <AuthProvider>
      {!supabaseConfigurado && (
        <div role="alert" className="fixed inset-x-0 top-0 z-50 bg-[#b3261e] px-4 py-2 text-center text-sm font-bold text-white">
          Falta .env.local con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
        </div>
      )}
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/p/:slug" element={<Publico />} />
          <Route path="/" element={<Protegida />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
