import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import { borrarGuia, listarGuias, mmss, PARTES_GUIA, subirGuia, urlDeGuia, MAX_MB, type Guia } from './guias'

interface Props {
  cancionId: string
  /** Solo los líderes suben y borran */
  puedeEditar: boolean
  grupoId?: string
  /** Sin encabezado, para usarlo dentro de otra tarjeta (ensayos) */
  compacto?: boolean
}

function Reproductor({ guia }: { guia: Guia }) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [cargando, setCargando] = useState(false)
  const audio = useRef<HTMLAudioElement>(null)

  async function escuchar() {
    setCargando(true)
    const u = await urlDeGuia(guia.storage_path)
    setCargando(false)
    if (!u) return setError(true)
    setUrl(u)
  }
  useEffect(() => { if (url) void audio.current?.play().catch(() => {}) }, [url])

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2.5">
        <span className="flex min-w-0 grow flex-col"><span className="truncate text-[15px] font-extrabold">{guia.parte}</span>{guia.duracion_s ? <small style={{ color: 'var(--muted)' }}>{mmss(guia.duracion_s)}</small> : null}</span>
        {!url && <button type="button" className="more" onClick={escuchar} disabled={cargando} aria-label={`Escuchar ${guia.parte}`}>{cargando ? <span className="spinner" aria-label="Cargando" /> : <><Icon name="audio" size={18} strokeWidth={2} />Escuchar</>}</button>}
      </div>
      {url && <audio ref={audio} controls preload="metadata" src={url} className="h-10 w-full" aria-label={guia.parte} />}
      {error && <span role="alert" className="text-sm font-bold" style={{ color: 'var(--danger)' }}>No se pudo abrir el audio.</span>}
    </div>
  )
}

export default function Guias({ cancionId, puedeEditar, grupoId, compacto }: Props) {
  const [lista, setLista] = useState<Guia[] | null>(null)
  const [parte, setParte] = useState(PARTES_GUIA[0]!)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState('')
  const [borrando, setBorrando] = useState<string | null>(null)
  const archivo = useRef<HTMLInputElement>(null)

  const cargar = useCallback(async () => setLista(await listarGuias([cancionId])), [cancionId])
  useEffect(() => { void cargar() }, [cargar])

  async function subir() {
    const f = archivo.current?.files?.[0]
    if (!f || !grupoId) return setError('Elige primero el archivo de audio.')
    setSubiendo(true)
    setError('')
    const fallo = await subirGuia(grupoId, cancionId, parte, f)
    setSubiendo(false)
    if (fallo) return setError(fallo)
    if (archivo.current) archivo.current.value = ''
    await cargar()
  }

  async function quitar(g: Guia) {
    setBorrando(g.id)
    const ok = await borrarGuia(g)
    setBorrando(null)
    if (!ok) return setError('No se pudo borrar. Intenta de nuevo.')
    await cargar()
  }

  if (lista === null) return null
  if (lista.length === 0 && !puedeEditar) return null

  return (
    <section aria-label="Guías de audio" className={compacto ? 'flex flex-col gap-2.5' : 'mt-5 flex flex-col gap-2.5 rounded-[22px] p-4'} style={compacto ? undefined : { background: 'var(--surface)', border: '1.5px solid var(--line)' }}>
      {!compacto && <h2 className="m-0 text-[15px] font-extrabold">Guías de audio</h2>}
      {lista.length === 0 && <p className="m-0 text-sm" style={{ color: 'var(--muted)' }}>Todavía no hay guías. Sube una para que el equipo practique en casa.</p>}
      {lista.map((g) => (
        <div key={g.id} className="flex items-start gap-2">
          <div className="min-w-0 grow"><Reproductor guia={g} /></div>
          {puedeEditar && <button type="button" className="undo !h-9 !px-2" aria-label={`Borrar ${g.parte}`} disabled={borrando === g.id} onClick={() => quitar(g)}><Icon name="borrar" size={16} strokeWidth={2} /></button>}
        </div>
      ))}

      {puedeEditar && (
        <div className="mt-1 flex flex-col gap-2 border-t pt-3" style={{ borderColor: 'var(--line)' }}>
          <span className="text-sm font-extrabold">Subir una guía</span>
          <label className="campo-sel"><span>Qué parte es</span>
            <input list="partes-guia" value={parte} onChange={(e) => setParte(e.target.value)} maxLength={40} style={{ border: 0, background: 'transparent', color: 'var(--ink)', font: 'inherit', fontSize: 17, outline: 'none', padding: 0 }} />
          </label>
          <datalist id="partes-guia">{PARTES_GUIA.map((p) => <option key={p} value={p} />)}</datalist>
          <input ref={archivo} type="file" accept="audio/*" aria-label="Archivo de audio" onChange={() => setError('')} className="text-sm" />
          <span className="text-[13px]" style={{ color: 'var(--muted)' }}>Hasta {MAX_MB} MB (mp3, m4a, wav).</span>
          <button type="button" className="cta" disabled={subiendo} onClick={subir}>{subiendo ? <span className="spinner" aria-label="Subiendo" /> : 'Subir guía'}</button>
          {error && <span role="alert" className="text-sm font-bold" style={{ color: 'var(--danger)' }}>{error}</span>}
        </div>
      )}
    </section>
  )
}
