import { useEffect, useState } from 'react'
import Icon from '../../components/Icon'
import { useToast } from '../../components/Toast'
import { useAuth } from '../../hooks/authContext'
import { useSync } from '../../hooks/syncContext'
import { fechaCorta, hora } from '../../lib/fechas'
import { resumenLocal } from '../../lib/offline/almacen'
import { relativo } from '../../lib/tiempo'

const mb = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`)

/** Perfil → Sin internet: qué hay guardado en este teléfono y cómo actualizarlo. */
export default function TarjetaOffline() {
  const { membresia } = useAuth()
  const s = useSync()
  const toast = useToast()
  const [r, setR] = useState<Awaited<ReturnType<typeof resumenLocal>> | null>(null)
  const [uso, setUso] = useState<number | null>(null)
  const [confirmar, setConfirmar] = useState(false)
  const grupoId = membresia?.grupo_id

  useEffect(() => {
    if (!grupoId) return
    let vivo = true
    void resumenLocal(grupoId).then((x) => { if (vivo) setR(x) })
    void navigator.storage?.estimate?.().then((e) => { if (vivo && e.usage != null) setUso(e.usage) }).catch(() => {})
    return () => { vivo = false }
  }, [grupoId, s.version, s.progresoAudios])

  if (!s.activo) return null

  async function actualizar() {
    const ok = await s.sincronizarAhora()
    toast(ok ? 'Cancionero actualizado en este teléfono' : s.enLinea ? 'No se pudo actualizar. Intenta de nuevo.' : 'Sin conexión: se actualizará cuando vuelva el internet')
  }

  const p = s.progresoAudios
  return (
    <section className="order p-4" aria-label="Uso sin internet">
      <h2 className="m-0 mb-1 flex items-center gap-2 text-[15px] font-extrabold"><Icon name="nube" size={18} strokeWidth={2.2} />Sin internet</h2>
      <p className="m-0 mb-3 text-[13.5px] leading-snug" style={{ color: 'var(--muted)' }}>
        El cancionero y el próximo servicio se guardan en este teléfono para verlos y cantarlos aunque no haya señal. Se actualizan solos cuando abres la app con internet.
      </p>

      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
        {[['Canciones', r?.canciones ?? 0], ['Servicios', r?.servicios ?? 0], ['Audios', r?.audios ?? 0]].map(([nombre, n]) => (
          <div key={nombre} className="rounded-2xl py-2.5" style={{ background: 'var(--soft)' }}>
            <div className="display text-2xl font-semibold">{n}</div>
            <div className="text-xs font-bold" style={{ color: 'var(--muted)' }}>{nombre}</div>
          </div>
        ))}
      </div>

      <p className="m-0 mb-3 text-[13.5px] font-bold" style={{ color: s.fallo ? 'var(--c-rosa-fg)' : 'var(--muted)' }}>
        {s.ultima ? `Última descarga: ${fechaCorta(s.ultima)} ${hora(s.ultima)} (${relativo(s.ultima)})` : 'Aún no se ha descargado nada.'}
        {s.fallo ? ' · La última actualización falló.' : ''}
        {uso != null ? ` · Ocupa ${mb(uso)}` : ''}
      </p>

      <button type="button" className="cta" onClick={actualizar} disabled={s.sincronizando}>
        {s.sincronizando ? <span className="spinner" aria-label="Descargando" /> : <><Icon name="descarga" size={18} strokeWidth={2.2} />Descargar ahora</>}
      </button>

      <div className="mt-4 flex items-center gap-3">
        <span className="flex grow flex-col"><span className="text-[15px] font-extrabold">Guardar también los audios guía</span><span className="text-[13px]" style={{ color: 'var(--muted)' }}>Pesan más (hasta 25 MB cada uno). Mejor con wifi.</span></span>
        <button type="button" role="switch" aria-checked={s.audios} aria-label="Guardar los audios guía" className={'sw' + (s.audios ? ' on' : '')} onClick={() => void s.fijarAudios(!s.audios)} />
      </div>
      {s.audios && p && <p role="status" className="m-0 mt-2 text-[13px] font-bold" style={{ color: 'var(--muted)' }}>Descargando audios… {p.hechas}{p.total ? ` de ${p.total}` : ''}</p>}
      {s.audios && !p && r && r.audios > 0 && <p className="m-0 mt-2 text-[13px]" style={{ color: 'var(--muted)' }}>{r.audios} {r.audios === 1 ? 'audio guardado' : 'audios guardados'} ({mb(r.bytesAudios)}).</p>}

      {!confirmar ? (
        <button type="button" className="undo mt-2" style={{ color: 'var(--danger)', padding: 0 }} onClick={() => setConfirmar(true)}>Borrar lo guardado en este teléfono</button>
      ) : (
        <div className="mt-3 flex flex-col gap-2 rounded-2xl p-3" style={{ background: 'var(--alerta-bg)', color: 'var(--alerta-fg)' }}>
          <span className="text-[13.5px] font-bold">Se borra la copia de este teléfono (no lo de la nube). Sin internet no podrás ver el cancionero hasta volver a descargarlo.</span>
          <div className="flex gap-2">
            <button type="button" className="ghost-link grow" onClick={() => setConfirmar(false)}>Cancelar</button>
            <button type="button" className="adv grow" style={{ background: 'var(--danger)', color: 'var(--bg)', height: 46 }} onClick={async () => { await s.borrarDescarga(); setConfirmar(false); toast('Se borró la copia de este teléfono') }}>Borrar</button>
          </div>
        </div>
      )}
    </section>
  )
}
