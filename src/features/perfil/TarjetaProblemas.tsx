import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Hoja from '../../components/Hoja'
import Icon from '../../components/Icon'
import { useToast } from '../../components/Toast'
import { useAuth } from '../../hooks/authContext'
import { registrarError } from '../../lib/errores'
import { supabase } from '../../lib/supabase'

/** Perfil: cualquiera reporta un problema; el propietario además entra a ver los que hay. */
export default function TarjetaProblemas() {
  const { membresia, rol } = useAuth()
  const toast = useToast()
  const [abierta, setAbierta] = useState(false)
  const [nota, setNota] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [pendientes, setPendientes] = useState<number | null>(null)
  const grupoId = membresia?.grupo_id
  const soyPropietario = rol === 'propietario'

  useEffect(() => {
    if (!soyPropietario || !grupoId) return
    void supabase.from('errores_app').select('id', { count: 'exact', head: true }).eq('grupo_id', grupoId).eq('resuelto', false)
      .then(({ count }) => setPendientes(count ?? 0))
  }, [soyPropietario, grupoId])

  async function enviar() {
    if (nota.trim().length < 5) return
    setEnviando(true)
    const ok = await registrarError(nota.trim().slice(0, 380), { tipo: 'manual' })
    setEnviando(false)
    toast(ok ? 'Gracias, ya quedó reportado' : navigator.onLine ? 'No se pudo enviar. Intenta de nuevo.' : 'Sin conexión: se enviará cuando vuelva el internet')
    if (ok || !navigator.onLine) { setNota(''); setAbierta(false) }
  }

  return (
    <>
      <section className="order p-4" aria-label="Problemas">
        <h2 className="m-0 mb-1 text-[15px] font-extrabold">¿Algo no funciona?</h2>
        <p className="m-0 mb-3 text-[13.5px] leading-snug" style={{ color: 'var(--muted)' }}>Cuéntanos qué pasó y en qué pantalla. Le llega al propietario.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="ghost-link" onClick={() => setAbierta(true)}>Reportar un problema</button>
          {soyPropietario && (
            <Link to="/problemas" className="ghost-link no-underline">
              <Icon name="alerta" size={16} strokeWidth={2.2} />Ver problemas{pendientes ? ` (${pendientes})` : ''}
            </Link>
          )}
        </div>
      </section>

      <Hoja titulo="Reportar un problema" abierta={abierta} onCerrar={() => setAbierta(false)}>
        <h2 className="display m-0 mx-1 text-2xl font-semibold">Reportar un problema</h2>
        <p className="m-0 mx-1 text-[14.5px]" style={{ color: 'var(--muted)' }}>¿Qué estabas haciendo y qué pasó? Con una o dos frases basta.</p>
        <textarea className="letra-editor" style={{ fontFamily: 'inherit', fontSize: 16 }} rows={4} maxLength={380} aria-label="Qué pasó" placeholder="Ej.: En el escenario, al cambiar de canción se quedó la pantalla en blanco." value={nota} onChange={(e) => setNota(e.target.value)} />
        <button type="button" className="cta" disabled={enviando || nota.trim().length < 5} onClick={() => void enviar()}>{enviando ? <span className="spinner" aria-label="Enviando" /> : 'Enviar'}</button>
      </Hoja>
    </>
  )
}
