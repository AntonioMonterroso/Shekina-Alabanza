import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useToast } from '../../components/Toast'
import { useAuth } from '../../hooks/authContext'
import { useEquipo } from '../../hooks/useEquipo'
import { fechaCorta, hora, iniciales } from '../../lib/fechas'
import { permisos } from '../../lib/permisos'
import { supabase } from '../../lib/supabase'

interface Aviso { id: string; autor: string | null; texto: string; created_at: string }

export default function Avisos() {
  const { membresia, rol } = useAuth()
  const p = permisos(rol)
  const toast = useToast()
  const equipo = useEquipo(membresia?.grupo_id)
  const [lista, setLista] = useState<Aviso[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(false)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const grupoId = membresia?.grupo_id

  const cargar = useCallback(async () => {
    if (!grupoId) return setCargando(false)
    const { data, error } = await supabase.from('avisos').select('id, autor, texto, created_at').eq('grupo_id', grupoId).order('created_at', { ascending: false }).limit(50)
    if (error) setError(true)
    else { setLista((data ?? []) as Aviso[]); setError(false) }
    setCargando(false)
  }, [grupoId])

  useEffect(() => { void cargar() }, [cargar])

  async function publicar(e: FormEvent) {
    e.preventDefault()
    const t = texto.trim()
    if (!t || !grupoId) return
    setEnviando(true)
    const { error } = await supabase.from('avisos').insert({ grupo_id: grupoId, autor: membresia!.id, texto: t })
    setEnviando(false)
    if (error) return toast('No se pudo publicar. Intenta de nuevo.')
    setTexto('')
    toast('Aviso publicado')
    await cargar()
  }

  async function borrar(id: string) {
    const previa = lista
    setLista((l) => l.filter((a) => a.id !== id))
    const { error } = await supabase.from('avisos').delete().eq('id', id)
    if (error) { setLista(previa); toast('No se pudo borrar. Intenta de nuevo.') }
  }

  const quien = (id: string | null) => equipo.find((m) => m.id === id)?.nombre ?? 'Un líder'

  return (
    <div className="relative">
      <div aria-hidden className="blob" style={{ width: 260, height: 240, right: -120, top: -100, background: 'var(--blob1)' }} />
      <div className="relative flex flex-col gap-3.5 px-5 pt-[54px]">
        <header className="rise flex items-center gap-3">
          <Link to="/" className="iconbtn" aria-label="Volver al inicio"><Icon name="atras" size={20} strokeWidth={2.2} /></Link>
          <div className="flex min-w-0 grow flex-col gap-0.5">
            <h1 className="display m-0 text-[30px] leading-[1.1] font-semibold tracking-[-0.02em]">Avisos</h1>
            <span className="truncate text-sm font-bold" style={{ color: 'var(--muted)' }}>Para todo el equipo · {membresia?.grupo.nombre}</span>
          </div>
        </header>

        {p.esLider && (
          <form onSubmit={publicar} className="rise flex flex-col gap-2.5" style={{ animationDelay: '60ms' }}>
            <label htmlFor="aviso" className="sr-only">Nuevo aviso</label>
            <textarea id="aviso" className="letra-editor" style={{ fontFamily: 'inherit', fontSize: 16 }} rows={3} maxLength={1000} placeholder="Escribe un aviso para el equipo…" value={texto} onChange={(e) => setTexto(e.target.value)} />
            <button type="submit" className="cta" disabled={enviando || !texto.trim()}>{enviando ? <span className="spinner" aria-label="Publicando" /> : 'Publicar aviso'}</button>
          </form>
        )}

        {cargando ? (
          <div className="esqueleto h-24" />
        ) : error ? (
          <p className="m-0 rounded-2xl p-4" style={{ background: 'var(--alerta-bg)', color: 'var(--alerta-fg)' }}>No se pudieron cargar los avisos.</p>
        ) : lista.length === 0 ? (
          <p className="m-0 rounded-2xl p-4 text-base" style={{ background: 'var(--soft)', color: 'var(--muted)' }}>Todavía no hay avisos.{p.esLider ? ' Escribe el primero arriba.' : ''}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {lista.map((a) => (
              <li key={a.id} className="flex items-start gap-3 rounded-3xl border-[1.5px] p-4" style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}>
                <span className="av shrink-0" style={{ background: 'var(--c-rosa-bg)', color: 'var(--c-rosa-fg)' }}>{iniciales(quien(a.autor))}</span>
                <span className="flex min-w-0 grow flex-col gap-1">
                  <span className="text-sm font-extrabold">{quien(a.autor)} <span className="font-semibold" style={{ color: 'var(--muted)' }}>· {fechaCorta(a.created_at)} · {hora(a.created_at)}</span></span>
                  <span className="text-base leading-normal break-words whitespace-pre-wrap">{a.texto}</span>
                </span>
                {p.esLider && <button type="button" className="undo !h-9 !px-2" aria-label="Borrar aviso" onClick={() => borrar(a.id)}><Icon name="borrar" size={16} strokeWidth={2} /></button>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
