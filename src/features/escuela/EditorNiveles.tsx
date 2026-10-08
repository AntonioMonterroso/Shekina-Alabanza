import { useCallback, useEffect, useState } from 'react'
import Icon from '../../components/Icon'
import { borrarNivel, cargarNiveles, guardarNivel, type Nivel } from './api'

/** Los niveles de un curso: renombrar, agregar al final y quitar. */
export default function EditorNiveles({ cursoId }: { cursoId: string }) {
  const [niveles, setNiveles] = useState<Nivel[] | null>(null)
  const [nuevo, setNuevo] = useState('')
  const [error, setError] = useState('')

  const cargar = useCallback(async () => setNiveles(await cargarNiveles([cursoId])), [cursoId])
  useEffect(() => { void cargar() }, [cargar])

  async function renombrar(n: Nivel, nombre: string) {
    const t = nombre.trim()
    if (!t || t === n.nombre) return
    if (await guardarNivel(cursoId, n.id, n.orden, t)) await cargar(); else setError('No se pudo guardar el nombre.')
  }
  async function agregar() {
    const t = nuevo.trim()
    if (!t) return
    const orden = (niveles ?? []).reduce((m, n) => Math.max(m, n.orden), 0) + 1
    if (await guardarNivel(cursoId, null, orden, t)) { setNuevo(''); setError(''); await cargar() } else setError('No se pudo agregar el nivel.')
  }
  async function quitar(n: Nivel) {
    if (await borrarNivel(n.id)) await cargar(); else setError('No se pudo quitar. Intenta de nuevo.')
  }

  if (niveles === null) return <div className="esqueleto h-16" />
  return (
    <div className="flex flex-col gap-2 rounded-2xl p-3" style={{ background: 'var(--soft)' }}>
      <span className="text-sm font-extrabold">Niveles del curso</span>
      {niveles.length === 0 && <span className="text-sm" style={{ color: 'var(--muted)' }}>Todavía no hay niveles. Agrega el primero (por ejemplo, Fundamentos).</span>}
      {niveles.map((n) => (
        <div key={n.id} className="flex items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-extrabold" style={{ background: 'var(--surface)' }}>{n.orden}</span>
          <input aria-label={`Nombre del nivel ${n.orden}`} defaultValue={n.nombre} maxLength={60} onBlur={(e) => void renombrar(n, e.target.value)} className="h-11 min-w-0 grow rounded-xl border-[1.5px] px-3 text-[15px] outline-none" style={{ borderColor: 'var(--line)', background: 'var(--surface)', color: 'var(--ink)' }} />
          <button type="button" className="undo !h-9 !px-2" aria-label={`Quitar el nivel ${n.nombre}`} onClick={() => quitar(n)}><Icon name="borrar" size={16} strokeWidth={2} /></button>
        </div>
      ))}
      <div className="flex gap-2">
        <input aria-label="Nuevo nivel" placeholder="Nuevo nivel…" value={nuevo} maxLength={60} onChange={(e) => setNuevo(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void agregar() } }} className="h-11 min-w-0 grow rounded-xl border-[1.5px] px-3 text-[15px] outline-none" style={{ borderColor: 'var(--line)', background: 'var(--surface)', color: 'var(--ink)' }} />
        <button type="button" className="iconbtn prim !h-11 !w-11" aria-label="Agregar nivel" disabled={!nuevo.trim()} onClick={agregar}><Icon name="mas" size={18} strokeWidth={2.4} /></button>
      </div>
      {error && <span role="alert" className="text-sm font-bold" style={{ color: 'var(--danger)' }}>{error}</span>}
    </div>
  )
}
