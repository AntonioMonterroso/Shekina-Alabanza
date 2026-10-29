import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useToast } from '../../components/Toast'
import { useAuth } from '../../hooks/authContext'
import { fechaCorta, hora } from '../../lib/fechas'
import { supabase } from '../../lib/supabase'
import { relativo } from '../../lib/tiempo'

interface Problema {
  id: string; user_id: string | null; tipo: 'automatico' | 'manual'; ruta: string | null; mensaje: string
  detalle: string | null; agente: string | null; version: string | null; resuelto: boolean; creado: string
}

/** Solo el propietario: lo que ha fallado en los teléfonos del equipo. */
export default function Problemas() {
  const { membresia } = useAuth()
  const toast = useToast()
  const grupoId = membresia?.grupo_id
  const [filas, setFilas] = useState<Problema[] | null>(null)
  const [error, setError] = useState(false)
  const [nombres, setNombres] = useState<Record<string, string>>({})
  const [ver, setVer] = useState<'pendientes' | 'resueltos'>('pendientes')
  const [abierta, setAbierta] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!grupoId) return
    const { data, error: e } = await supabase.from('errores_app').select('*').eq('grupo_id', grupoId).order('creado', { ascending: false }).limit(150)
    if (e) return setError(true)
    const l = (data ?? []) as Problema[]
    setFilas(l)
    const ids = [...new Set(l.map((x) => x.user_id).filter(Boolean) as string[])]
    if (ids.length) {
      const { data: ps } = await supabase.from('perfiles').select('id, nombre').in('id', ids)
      setNombres(Object.fromEntries((ps ?? []).map((p) => [p.id as string, p.nombre as string])))
    }
  }, [grupoId])
  useEffect(() => { void cargar() }, [cargar])

  const pendientes = (filas ?? []).filter((f) => !f.resuelto)
  const lista = (filas ?? []).filter((f) => f.resuelto === (ver === 'resueltos'))

  async function marcar(f: Problema, resuelto: boolean) {
    setFilas((l) => (l ?? []).map((x) => (x.id === f.id ? { ...x, resuelto } : x)))
    const { error: e } = await supabase.from('errores_app').update({ resuelto }).eq('id', f.id)
    if (e) { toast('No se pudo cambiar. Intenta de nuevo.'); void cargar() }
  }
  async function borrarResueltos() {
    const { error: e } = await supabase.from('errores_app').delete().eq('grupo_id', grupoId!).eq('resuelto', true)
    toast(e ? 'No se pudo borrar. Intenta de nuevo.' : 'Se borraron los resueltos')
    void cargar()
  }

  return (
    <div className="px-5 pt-[54px] pb-6">
      <header className="flex items-center gap-3.5">
        <Link to="/perfil" className="iconbtn" aria-label="Volver al perfil"><Icon name="atras" size={20} strokeWidth={2.2} /></Link>
        <div className="flex min-w-0 grow flex-col gap-0.5">
          <h1 className="display m-0 text-[28px] leading-[1.1] font-semibold tracking-[-0.02em]">Problemas</h1>
          <span className="text-[15px]" style={{ color: 'var(--muted)' }}>{filas === null ? 'Cargando…' : pendientes.length === 0 ? 'Todo en orden' : `${pendientes.length} por revisar`}</span>
        </div>
      </header>

      <p className="mt-4 mb-0 text-[13.5px] leading-snug" style={{ color: 'var(--muted)' }}>
        Aquí aparece lo que falla en los teléfonos del equipo (la pantalla y el error, sin letras ni datos personales) y lo que ellos reportan a mano. Cuéntaselo a quien arregla la app.
      </p>

      <div className="segmentado mt-4" role="tablist" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <button type="button" role="tab" aria-selected={ver === 'pendientes'} className={ver === 'pendientes' ? 'on' : ''} onClick={() => setVer('pendientes')}>Por revisar{pendientes.length ? ` (${pendientes.length})` : ''}</button>
        <button type="button" role="tab" aria-selected={ver === 'resueltos'} className={ver === 'resueltos' ? 'on' : ''} onClick={() => setVer('resueltos')}>Resueltos</button>
      </div>

      {error && <p className="mt-4 rounded-2xl p-4 text-[15px] font-bold" style={{ background: 'var(--alerta-bg)', color: 'var(--alerta-fg)' }}>No se pudo cargar. Revisa tu conexión.</p>}
      {filas !== null && lista.length === 0 && <p className="mt-8 text-center text-[15px] font-bold" style={{ color: 'var(--muted)' }}>{ver === 'pendientes' ? 'No hay problemas por revisar.' : 'Aún no hay problemas resueltos.'}</p>}

      <ul className="m-0 mt-3 flex list-none flex-col gap-2.5 p-0">
        {lista.map((f) => (
          <li key={f.id} className="tcard" style={{ padding: 12, gap: 8 }}>
            <button type="button" className="songhead" style={{ alignItems: 'flex-start' }} aria-expanded={abierta === f.id} onClick={() => setAbierta(abierta === f.id ? null : f.id)}>
              <span className="flex min-w-0 grow flex-col gap-1">
                <span className="text-[15px] font-extrabold" style={{ overflowWrap: 'anywhere' }}>{f.mensaje}</span>
                <span className="text-[13px]" style={{ color: 'var(--muted)' }}>
                  {f.tipo === 'manual' ? 'Reporte de ' : ''}{(f.user_id && nombres[f.user_id]) || 'alguien'} · {f.ruta ?? '/'} · {relativo(f.creado)}
                </span>
              </span>
              {f.tipo === 'manual' && <span className="ppill" style={{ background: 'var(--c-lila-bg)', color: 'var(--c-lila-fg)' }}>manual</span>}
            </button>
            {abierta === f.id && (
              <div className="detail">
                <p className="m-0 text-[13px]" style={{ color: 'var(--muted)' }}>{fechaCorta(f.creado)} {hora(f.creado)} · versión {f.version ?? '—'}</p>
                {f.agente && <p className="m-0 text-xs" style={{ color: 'var(--muted)', overflowWrap: 'anywhere' }}>{f.agente}</p>}
                {f.detalle && <pre className="m-0 max-h-60 overflow-auto rounded-xl p-2.5 text-[11.5px] leading-snug whitespace-pre-wrap" style={{ background: 'var(--soft)', overflowWrap: 'anywhere' }}>{f.detalle}</pre>}
                <button type="button" className="ghost-link" onClick={() => void marcar(f, !f.resuelto)}>{f.resuelto ? 'Volver a revisar' : 'Marcar como resuelto'}</button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {ver === 'resueltos' && lista.length > 0 && <button type="button" className="undo mt-4 self-center" style={{ color: 'var(--danger)' }} onClick={() => void borrarResueltos()}>Borrar todos los resueltos</button>}
    </div>
  )
}
