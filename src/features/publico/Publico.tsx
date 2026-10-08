import { Link, useParams } from 'react-router-dom'

// Marcador del paso 8 (página pública /p/:slug).
export default function Publico() {
  const { slug } = useParams()
  return (
    <main className="pantalla grid place-items-center px-7 text-center">
      <div>
        <h1 className="display m-0 text-[30px] font-semibold">Lo que cantaremos</h1>
        <p className="mt-2" style={{ color: 'var(--muted)' }}>Próximamente para {slug}.</p>
        <Link to="/login" className="mt-4 inline-block font-bold">Volver</Link>
      </div>
    </main>
  )
}
