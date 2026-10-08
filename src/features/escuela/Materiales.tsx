import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import { agregarEnlace, borrarMaterial, cargarMateriales, estiloColor, MAX_MB_MATERIAL, subirMaterial, urlsDeMateriales, type Curso, type Material } from './api'

interface Props {
  cursos: Curso[]
  /** Quien enseña o coordina puede agregar y quitar */
  puedeEditar: boolean
  grupoId?: string
  miembroId?: string
}

/** Material de apoyo de los cursos: enlaces y archivos (PDF, imágenes, audio, video). */
export default function Materiales({ cursos, puedeEditar, grupoId, miembroId }: Props) {
  const [lista, setLista] = useState<Material[] | null>(null)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [modo, setModo] = useState<'enlace' | 'archivo'>('enlace')
  const [curso, setCurso] = useState(cursos[0]?.id ?? '')
  const [titulo, setTitulo] = useState('')
  const [enlace, setEnlace] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const archivo = useRef<HTMLInputElement>(null)
  const idsCursos = cursos.map((c) => c.id).join(',')

  const cargar = useCallback(async () => {
    const m = await cargarMateriales(idsCursos ? idsCursos.split(',') : [])
    setLista(m)
    setUrls(await urlsDeMateriales(m.flatMap((x) => (x.storage_path ? [x.storage_path] : []))))
  }, [idsCursos])
  useEffect(() => { void cargar() }, [cargar])
  useEffect(() => { if (!curso && cursos[0]) setCurso(cursos[0].id) }, [curso, cursos])

  async function agregar() {
    if (!titulo.trim()) return setError('Ponle un título al material.')
    if (!grupoId || !miembroId || !curso) return
    setGuardando(true)
    setError('')
    let fallo: string | null = null
    if (modo === 'enlace') {
      if (!/^https?:\/\//i.test(enlace.trim())) fallo = 'El enlace debe empezar con http:// o https://'
      else if (!(await agregarEnlace(grupoId, curso, titulo.trim(), enlace.trim(), miembroId))) fallo = 'No se pudo guardar. Intenta de nuevo.'
    } else {
      const f = archivo.current?.files?.[0]
      fallo = f ? await subirMaterial(grupoId, curso, titulo.trim(), f, miembroId) : 'Elige el archivo.'
    }
    setGuardando(false)
    if (fallo) return setError(fallo)
    setTitulo(''); setEnlace('')
    if (archivo.current) archivo.current.value = ''
    await cargar()
  }

  async function quitar(m: Material) {
    if (await borrarMaterial(m)) await cargar(); else setError('No se pudo borrar. Intenta de nuevo.')
  }

  if (lista === null) return null
  if (lista.length === 0 && !puedeEditar) return null

  return (
    <section aria-label="Materiales" className="flex flex-col gap-2">
      <h2 className="display m-0 px-1 text-xl font-semibold">Materiales</h2>
      {lista.length === 0 && <p className="m-0 rounded-2xl p-4 text-[15px]" style={{ background: 'var(--soft)', color: 'var(--muted)' }}>Todavía no hay materiales. Agrega partituras, videos o ejercicios.</p>}
      {lista.map((m) => {
        const c = cursos.find((x) => x.id === m.curso_id)
        const href = m.url ?? (m.storage_path ? urls[m.storage_path] : undefined)
        return (
          <div key={m.id} className="flex items-center gap-2 rounded-2xl p-2.5" style={{ background: 'var(--surface)', border: '1.5px solid var(--line)' }}>
            <a href={href} target="_blank" rel="noopener noreferrer" aria-disabled={!href} className="flex min-w-0 grow items-center gap-3 no-underline" style={{ color: 'var(--ink)', opacity: href ? 1 : 0.5 }}>
              <span className="chip !h-11 !w-11" style={c ? estiloColor(c.color) : undefined} aria-hidden><Icon name={m.url ? 'mundo' : 'cancionero'} size={20} strokeWidth={2} /></span>
              <span className="flex min-w-0 flex-col"><span className="truncate text-[15px] font-extrabold">{m.titulo}</span><small style={{ color: 'var(--muted)' }}>{m.url ? 'Enlace' : 'Archivo'}{cursos.length > 1 && c ? ` · ${c.nombre}` : ''}</small></span>
            </a>
            {puedeEditar && <button type="button" className="undo !h-9 !px-2" aria-label={`Borrar ${m.titulo}`} onClick={() => quitar(m)}><Icon name="borrar" size={16} strokeWidth={2} /></button>}
          </div>
        )
      })}

      {puedeEditar && (
        <div className="flex flex-col gap-2 rounded-2xl p-3" style={{ background: 'var(--soft)' }}>
          <span className="text-sm font-extrabold">Agregar material</span>
          <div className="segmentado" role="radiogroup" aria-label="Tipo de material">
            {([['enlace', 'Enlace'], ['archivo', 'Archivo']] as const).map(([v, t]) => <button key={v} type="button" role="radio" aria-checked={modo === v} className={modo === v ? 'on' : ''} onClick={() => { setModo(v); setError('') }}>{t}</button>)}
          </div>
          {cursos.length > 1 && <label className="campo-sel"><span>Curso</span><select value={curso} onChange={(e) => setCurso(e.target.value)}>{cursos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>}
          <div className="field"><input id="m-titulo" type="text" placeholder=" " value={titulo} maxLength={120} onChange={(e) => { setTitulo(e.target.value); setError('') }} /><label htmlFor="m-titulo">Título</label></div>
          {modo === 'enlace'
            ? <div className="field"><input id="m-url" type="url" inputMode="url" placeholder=" " value={enlace} onChange={(e) => { setEnlace(e.target.value); setError('') }} /><label htmlFor="m-url">Enlace (YouTube, Drive…)</label></div>
            : <><input ref={archivo} type="file" accept="application/pdf,image/*,audio/*,video/mp4" aria-label="Archivo" className="text-sm" onChange={() => setError('')} /><span className="text-[13px]" style={{ color: 'var(--muted)' }}>PDF, imagen, audio o video mp4, hasta {MAX_MB_MATERIAL} MB.</span></>}
          <button type="button" className="cta" disabled={guardando} onClick={agregar}>{guardando ? <span className="spinner" aria-label="Guardando" /> : 'Agregar'}</button>
          {error && <span role="alert" className="text-sm font-bold" style={{ color: 'var(--danger)' }}>{error}</span>}
        </div>
      )}
    </section>
  )
}
