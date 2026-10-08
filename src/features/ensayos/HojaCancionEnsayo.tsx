import { useState, type FormEvent } from 'react'
import Hoja from '../../components/Hoja'
import type { CancionBase, CancionEnsayo } from './useEnsayos'

interface Props {
  abierta: boolean
  onCerrar: () => void
  /** canción que se edita (foco o quitar); null = elegir una para agregar */
  editando: CancionEnsayo | null
  catalogo: CancionBase[]
  yaEstan: Set<string>
  onGuardar: (cancionId: string, foco: string | null) => Promise<boolean>
  onQuitar: (cancionId: string) => Promise<boolean>
}

function Contenido({ editando, catalogo, yaEstan, onGuardar, onQuitar, onCerrar }: Omit<Props, 'abierta'>) {
  const [id, setId] = useState(editando?.cancion_id ?? '')
  const [foco, setFoco] = useState(editando?.foco ?? '')
  const [q, setQ] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const opciones = catalogo.filter((c) => !yaEstan.has(c.id) && (!q.trim() || c.titulo.toLowerCase().includes(q.trim().toLowerCase())))

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!id) return setError('Elige una canción.')
    setGuardando(true)
    const ok = await onGuardar(id, foco.trim() || null)
    setGuardando(false)
    if (!ok) return setError('No se pudo guardar. Intenta de nuevo.')
    onCerrar()
  }

  async function quitar() {
    setGuardando(true)
    const ok = await onQuitar(editando!.cancion_id)
    setGuardando(false)
    if (!ok) return setError('No se pudo quitar. Intenta de nuevo.')
    onCerrar()
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-3">
      <h2 className="display m-0 mx-1 text-2xl font-semibold">{editando ? editando.titulo : 'Canción a ensayar'}</h2>
      {!editando && (
        <>
          <div className="field"><input id="ec-q" type="search" placeholder=" " value={q} onChange={(e) => setQ(e.target.value)} /><label htmlFor="ec-q">Buscar canción</label></div>
          <div className="flex max-h-[30dvh] flex-col gap-1.5 overflow-y-auto" role="listbox" aria-label="Canciones">
            {opciones.length === 0 && <p className="m-0 p-2 text-sm" style={{ color: 'var(--muted)' }}>No hay más canciones para agregar.</p>}
            {opciones.map((c) => (
              <button key={c.id} type="button" role="option" aria-selected={id === c.id} className="more !h-auto min-h-11 justify-start !py-2 text-left" style={id === c.id ? { background: 'var(--primary)', borderColor: 'var(--primary)', color: 'var(--on-primary)' } : undefined} onClick={() => { setId(c.id); setError('') }}>
                <span className="flex flex-col"><span>{c.titulo}</span>{c.autor && <small className="font-semibold opacity-75">{c.autor}</small>}</span>
              </button>
            ))}
          </div>
        </>
      )}
      <div className="field"><input id="ec-foco" type="text" placeholder=" " value={foco} onChange={(e) => setFoco(e.target.value)} maxLength={200} /><label htmlFor="ec-foco">En qué enfocarse (opcional)</label></div>
      <span role="status" className="min-h-5 px-1 text-sm font-semibold" style={{ color: 'var(--danger)' }}>{error}</span>
      <button type="submit" className="cta" disabled={guardando}>{guardando ? <span className="spinner" aria-label="Guardando" /> : editando ? 'Guardar' : 'Agregar al ensayo'}</button>
      {editando && <button type="button" className="undo self-center" style={{ color: 'var(--danger)' }} disabled={guardando} onClick={quitar}>Quitar del ensayo</button>}
    </form>
  )
}

export default function HojaCancionEnsayo({ abierta, onCerrar, ...resto }: Props) {
  return <Hoja titulo="Canción del ensayo" abierta={abierta} onCerrar={onCerrar}><Contenido {...resto} onCerrar={onCerrar} /></Hoja>
}
