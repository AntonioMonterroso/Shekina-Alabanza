import { useEffect, type ReactNode } from 'react'

// Hoja inferior (bottom sheet) con fondo que cierra, Escape y foco al abrir.
export default function Hoja({ titulo, abierta, onCerrar, children }: { titulo: string; abierta: boolean; onCerrar: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!abierta) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [abierta, onCerrar])
  if (!abierta) return null
  return (
    <>
      <div className="scrim" onClick={onCerrar} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={titulo}>
        <span aria-hidden className="grip" />
        {children}
      </div>
    </>
  )
}
