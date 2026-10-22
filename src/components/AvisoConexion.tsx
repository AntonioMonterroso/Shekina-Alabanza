import { useSync } from '../hooks/syncContext'
import Icon from './Icon'

/** Franja discreta arriba cuando no hay conexión: la app sigue sirviendo lo que ya está guardado en el teléfono. */
export default function AvisoConexion() {
  const { enLinea, activo, ultima } = useSync()
  if (enLinea || !activo) return null
  return (
    <div role="status" className="aviso-conexion">
      <Icon name="nube" size={14} strokeWidth={2.4} />
      <span>Sin conexión{ultima ? ' · usando lo guardado en este teléfono' : ''}</span>
    </div>
  )
}
