import { useSync } from '../hooks/syncContext'
import { fechaCorta, hora } from '../lib/fechas'
import { relativo } from '../lib/tiempo'
import Icon from './Icon'

/** Dice, en una línea, si el cancionero ya está guardado en este teléfono para usarlo sin internet. */
export default function EstadoCopia({ sinConexion }: { sinConexion?: boolean }) {
  const s = useSync()
  if (!s.activo) return null

  if (s.sincronizando) {
    return <p role="status" className="estado-copia"><span className="spinner" style={{ width: 12, height: 12, borderWidth: 2, borderColor: 'var(--line)', borderTopColor: 'var(--primary)' }} aria-hidden />Actualizando el cancionero…</p>
  }
  if (!s.enLinea || sinConexion) {
    return (
      <p role="status" className="estado-copia aviso">
        <Icon name="nube" size={14} strokeWidth={2.4} />
        {s.ultima ? `Sin conexión · viendo la copia guardada el ${fechaCorta(s.ultima)} ${hora(s.ultima)}` : 'Sin conexión · este teléfono aún no tiene una copia'}
      </p>
    )
  }
  if (!s.ultima) return <p className="estado-copia"><Icon name="nube" size={14} strokeWidth={2.4} />Aún no guardado en este teléfono<button type="button" className="enlace" onClick={() => void s.sincronizarAhora()}>Descargar</button></p>
  return (
    <p className="estado-copia">
      <Icon name="check" size={14} strokeWidth={2.8} style={{ color: 'var(--primary)' }} />
      Guardado en este teléfono · {relativo(s.ultima)}
      <button type="button" className="enlace" onClick={() => void s.sincronizarAhora()}>Actualizar</button>
    </p>
  )
}
