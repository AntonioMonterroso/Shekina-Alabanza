import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useToast } from '../../components/Toast'
import { useAuth } from '../../hooks/authContext'
import { fechaCorta, hora } from '../../lib/fechas'
import { supabase } from '../../lib/supabase'

type Estado = 'nueva' | 'aprobada' | 'descartada'
interface Propuesta { id: string; titulo: string; autor: string | null; contacto: string | null; estado: Estado; created_at: string }
interface Voto { id: string; titulo: string; autor: string | null; votos: number }

const TABS: [Estado, string][] = [['nueva', 'Nuevas'], ['aprobada', 'Aprobadas'], ['descartada', 'Descartadas']]

export default function Propuestas() {
  const { membresia } = useAuth()
  const toast = useToast()
  const grupoId = membresia?.grupo_id
  const [tab, setTab] = useState<Estado>('nueva')
  const [lista, setLista] = useState<Propuesta[]>([])
  const [votadas, setVotadas] = useState<Voto[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(false)

  const cargar = useCallback(async () => {
    if (!grupoId) return setCargando(false)
    const [p, v] = await Promise.all([
      supabase.from('propuestas').select('id, titulo, autor, contacto, estado, created_at').eq('grupo_id', grupoId).order('created_at', { ascending: false }).limit(200),
      supabase.from('v_publico_repertorio').select('cancion_id, titulo, autor, votos').eq('slug', membresia!.grupo.slug).gt('votos', 0).order('votos', { ascending: false }).limit(10),
    ])
    if (p.error) setError(true)
    else setLista((p.data ?? []) as Propuesta[])
    setVotadas(((v.data ?? []) as { cancion_id: string; titulo: string; autor: string | null; votos: number }[]).map((x) => ({ id: x.cancion_id, titulo: x.titulo, autor: x.autor, votos: Number(x.votos) })))
    setCargando(false)
  }, [grupoId, membresia])

  useEffect(() => { void cargar() }, [cargar])

  async function marcar(id: string, estado: Estado) {
    const antes = lista
    setLista((l) => l.map((x) => (x.id === id ? { ...x, estado } : x)))
    const { error: e } = await supabase.from('propuestas').update({ estado }).eq('id', id)
    if (e) { setLista(antes); toast('No se pudo guardar. Intenta de nuevo.') }
    else toast(estado === 'aprobada' ? 'Propuesta aprobada' : estado === 'descartada' ? 'Propuesta descartada' : 'Propuesta devuelta a nuevas')
  }

  const visibles = lista.filter((x) => x.estado === tab)
  const nuevas = lista.filter((x) => x.estado === 'nueva').length

  return (
    <div className="relative">
      <div aria-hidden className="blob" style={{ width: 260, height: 240, right: -120, top: -100, background: 'var(--blob1)' }} />
      <div className="relative flex flex-col gap-3.5 px-5 pt-[54px]">
        <header className="rise flex items-center gap-3">
          <Link to="/" className="iconbtn" aria-label="Volver al inicio"><Icon name="atras" size={20} strokeWidth={2.2} /></Link>
          <div className="flex min-w-0 grow flex-col gap-0.5">
            <h1 className="display m-0 text-[30px] leading-[1.1] font-semibold tracking-[-0.02em]">Propuestas</h1>
            <span className="truncate text-sm font-bold" style={{ color: 'var(--muted)' }}>De la congregación · {membresia?.grupo.nombre}</span>
          </div>
        </header>

        <div className="rise svc" role="tablist" aria-label="Estado" style={{ animationDelay: '80ms' }}>
          {TABS.map(([id, texto]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={'schip' + (tab === id ? ' on' : '')} onClick={() => setTab(id)}>
              <small>{texto}</small><b>{lista.filter((x) => x.estado === id).length}</b>
            </button>
          ))}
        </div>

        {cargando ? (
          <div className="esqueleto h-24" />
        ) : error ? (
          <p className="m-0 rounded-2xl p-4" style={{ background: 'var(--alerta-bg)', color: 'var(--alerta-fg)' }}>No se pudieron cargar las propuestas.</p>
        ) : visibles.length === 0 ? (
          <p className="m-0 rounded-2xl p-4 text-base" style={{ background: 'var(--soft)', color: 'var(--muted)' }}>
            {tab === 'nueva' ? 'No hay propuestas nuevas. Cuando alguien sugiera una canción desde la página pública, llegará aquí.' : 'Nada por aquí todavía.'}
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {visibles.map((x) => (
              <li key={x.id} className="rise flex flex-col gap-3 rounded-3xl border-[1.5px] p-4" style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[17px] font-extrabold">{x.titulo}</span>
                  <span className="text-sm" style={{ color: 'var(--muted)' }}>
                    {[x.autor, x.contacto && `de ${x.contacto}`, `${fechaCorta(x.created_at)} · ${hora(x.created_at)}`].filter(Boolean).join(' · ')}
                  </span>
                </div>
                <div className="flex gap-2">
                  {x.estado === 'nueva' ? (
                    <>
                      <button type="button" className="cbtn yes" onClick={() => marcar(x.id, 'aprobada')}><Icon name="check" size={18} strokeWidth={2.4} />Aprobar</button>
                      <button type="button" className="cbtn no" style={{ border: '1.5px solid var(--line)' }} onClick={() => marcar(x.id, 'descartada')}>Descartar</button>
                    </>
                  ) : (
                    <button type="button" className="undo" onClick={() => marcar(x.id, 'nueva')}>Devolver a nuevas</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {votadas.length > 0 && (
          <section aria-label="Más votadas" className="mt-2 flex flex-col gap-2">
            <h2 className="display m-0 px-1 text-xl font-semibold">Más votadas del repertorio</h2>
            <div className="order">
              {votadas.map((v) => (
                <div key={v.id} className="orow">
                  <span className="min-w-0 grow truncate text-[15px] font-extrabold">{v.titulo}</span>
                  <span className="key">{v.votos} {v.votos === 1 ? 'voto' : 'votos'}</span>
                </div>
              ))}
            </div>
          </section>
        )}
        {nuevas > 0 && <span className="sr-only" role="status">{nuevas} propuestas nuevas</span>}
      </div>
    </div>
  )
}
