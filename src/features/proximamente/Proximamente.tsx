import { Link } from 'react-router-dom'

export default function Proximamente({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <div className="px-5 pt-16">
      <h1 className="display m-0 text-[32px] leading-tight font-semibold">{titulo}</h1>
      <p className="mt-3 rounded-2xl p-4 text-base" style={{ background: 'var(--soft)', color: 'var(--muted)' }}>{detalle}</p>
      <Link to="/" className="mt-5 inline-block font-extrabold no-underline">← Volver al inicio</Link>
    </div>
  )
}
