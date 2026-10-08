import { useCallback, useEffect, useState, type FormEvent } from 'react'
import Icon from '../../components/Icon'
import { fechaCorta, iniciales } from '../../lib/fechas'
import { borrarComentario, cargarComentarios, crearComentario, type Comentario } from './api'

interface Props {
  alumnoId: string
  /** Si se indica, solo los comentarios de esa clase */
  claseId?: string
  /** Quien puede escribir (maestro o coordinación) debe indicar su clase y su miembro */
  escribir?: { claseId: string; autorId: string; puedeBorrarTodos: boolean }
  nombreDe: (id: string | null) => string
  vacio?: string
  /** Encabezado cuando hay comentarios (para mostrarlos en la pantalla del alumno) */
  titulo?: string
}

/** Mensajes del maestro para un alumno. El alumno y su tutor los leen; solo quien enseña los escribe. */
export default function Comentarios({ alumnoId, claseId, escribir, nombreDe, vacio, titulo }: Props) {
  const [lista, setLista] = useState<Comentario[] | null>(null)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => setLista(await cargarComentarios(alumnoId, claseId)), [alumnoId, claseId])
  useEffect(() => { void cargar() }, [cargar])

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const t = texto.trim()
    if (!t || !escribir) return
    setEnviando(true)
    setError('')
    const ok = await crearComentario(escribir.claseId, alumnoId, escribir.autorId, t)
    setEnviando(false)
    if (!ok) return setError('No se pudo enviar. Intenta de nuevo.')
    setTexto('')
    await cargar()
  }

  async function quitar(id: string) {
    if (await borrarComentario(id)) await cargar(); else setError('No se pudo borrar.')
  }

  if (lista === null) return null
  if (lista.length === 0 && !escribir && !vacio) return null

  return (
    <section aria-label="Comentarios del maestro" className="flex flex-col gap-2">
      {titulo && lista.length > 0 && <h2 className="display m-0 px-1 pt-1 text-xl font-semibold">{titulo}</h2>}
      {lista.length === 0 && <p className="m-0 text-sm" style={{ color: 'var(--muted)' }}>{vacio ?? 'Todavía no hay comentarios.'}</p>}
      {lista.map((c) => (
        <div key={c.id} className="flex items-start gap-2.5 rounded-2xl p-3" style={{ background: 'var(--surface)', border: '1.5px solid var(--line)' }}>
          <span className="av shrink-0" style={{ background: 'var(--c-verde-bg)', color: 'var(--c-verde-fg)' }}>{iniciales(nombreDe(c.autor_id))}</span>
          <span className="flex min-w-0 grow flex-col">
            <span className="text-[13px] font-extrabold">{nombreDe(c.autor_id)} <span className="font-semibold" style={{ color: 'var(--muted)' }}>· {fechaCorta(c.created_at)}</span></span>
            <span className="text-[15px] break-words whitespace-pre-wrap">{c.texto}</span>
          </span>
          {escribir && (escribir.puedeBorrarTodos || c.autor_id === escribir.autorId) && <button type="button" className="undo !h-9 !px-2" aria-label="Borrar comentario" onClick={() => quitar(c.id)}><Icon name="borrar" size={16} strokeWidth={2} /></button>}
        </div>
      ))}
      {escribir && (
        <form onSubmit={enviar} className="flex gap-2">
          <label htmlFor="coment" className="sr-only">Escribe un comentario</label>
          <input id="coment" type="text" autoComplete="off" maxLength={1000} placeholder="Escribe un comentario para el alumno…" value={texto} onChange={(e) => setTexto(e.target.value)} className="h-[52px] min-w-0 grow rounded-2xl border-[1.5px] px-4 text-base outline-none focus:shadow-[0_0_0_5px_var(--ring)]" style={{ borderColor: 'var(--line)', background: 'var(--surface)', color: 'var(--ink)' }} />
          <button type="submit" className="iconbtn prim !h-[52px] !w-[52px]" aria-label="Enviar comentario" disabled={enviando || !texto.trim()}><Icon name="derecha" size={20} strokeWidth={2.4} /></button>
        </form>
      )}
      {error && <span role="alert" className="text-sm font-bold" style={{ color: 'var(--danger)' }}>{error}</span>}
    </section>
  )
}
