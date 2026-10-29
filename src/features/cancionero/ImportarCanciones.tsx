import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useToast } from '../../components/Toast'
import { useAuth } from '../../hooks/authContext'
import { TONOS } from '../../lib/chordpro'
import { estados, MAX_CANCIONES, MAX_CARACTERES, separarCanciones, type Borrador, type Estado } from '../../lib/importar'
import { leerCanciones } from '../../lib/offline/almacen'
import { supabase } from '../../lib/supabase'
import { crearCanciones } from './api'
import LetraView from './LetraView'

interface Fila extends Borrador { id: number; marcada: boolean; abierta: boolean }

const EJEMPLO = `Cuán grande es Él - Carl Boberg
Tono: G

G        C        G
Señor mi Dios, al contemplar los cielos
       D
El firmamento y las estrellas mil


Santo, santo, santo
D        G       D
Santo, santo, santo
Em        A
Dios omnipotente`

const AVISO: Record<Exclude<Estado, 'ok'>, string> = {
  existe: 'Ya está en el cancionero: se salta',
  repetida: 'Viene repetida en este texto: se salta',
  'sin-titulo': 'Falta el título',
}

export default function ImportarCanciones() {
  const { membresia, session } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [paso, setPaso] = useState<'pegar' | 'revisar' | 'listo'>('pegar')
  const [texto, setTexto] = useState('')
  const [filas, setFilas] = useState<Fila[]>([])
  const [existentes, setExistentes] = useState<string[]>([])
  const [error, setError] = useState('')
  const [revisando, setRevisando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [resultado, setResultado] = useState<{ creadas: number; saltadas: string[]; error: string | null } | null>(null)
  const grupoId = membresia?.grupo_id
  const sinRed = typeof navigator !== 'undefined' && !navigator.onLine

  const est = useMemo(() => estados(filas.map((f) => f.titulo), existentes), [filas, existentes])
  const aGuardar = filas.filter((f, i) => f.marcada && est[i] === 'ok')
  const saltadas = filas.filter((f, i) => !(f.marcada && est[i] === 'ok'))

  async function titulosDelCancionero(): Promise<string[]> {
    if (!grupoId) return []
    const { data, error: e } = await supabase.from('canciones').select('titulo').eq('grupo_id', grupoId)
    if (!e && data) return data.map((c) => c.titulo as string)
    return (await leerCanciones(grupoId)).map((c) => c.titulo) // sin conexión: lo guardado en el teléfono
  }

  async function revisar() {
    setError('')
    if (!texto.trim()) return setError('Pega primero la letra de una o más canciones.')
    if (texto.length > MAX_CARACTERES) return setError('Es demasiado texto de una vez. Divídelo en partes más pequeñas.')
    const borradores = separarCanciones(texto)
    if (borradores.length === 0) return setError('No encontré ninguna canción en ese texto. Pega la letra completa (no solo los títulos).')
    if (borradores.length > MAX_CANCIONES) return setError(`Encontré ${borradores.length} canciones; el máximo por vez es ${MAX_CANCIONES}.`)
    setRevisando(true)
    setExistentes(await titulosDelCancionero())
    setFilas(borradores.map((b, i) => ({ ...b, id: i, marcada: true, abierta: false })))
    setRevisando(false)
    setPaso('revisar')
  }

  const cambiar = (id: number, p: Partial<Fila>) => setFilas((fs) => fs.map((f) => (f.id === id ? { ...f, ...p } : f)))
  const unirConAnterior = (i: number) => setFilas((fs) => {
    const ant = fs[i - 1], cur = fs[i]
    if (!ant || !cur) return fs
    return [...fs.slice(0, i - 1), { ...ant, letra: `${ant.letra}\n\n${cur.letra}`, conAcordes: ant.conAcordes || cur.conAcordes }, ...fs.slice(i + 1)]
  })

  async function guardar() {
    if (!grupoId || !session || aGuardar.length === 0) return
    setGuardando(true)
    const r = await crearCanciones(grupoId, session.user.id, aGuardar.map((f) => ({
      titulo: f.titulo.trim(), autor: f.autor, tono_original: f.tono, bpm: f.bpm, minutos: 4, categoria: null, letra_chordpro: f.letra || null, audio_ref_url: null,
    })))
    setGuardando(false)
    setResultado({ creadas: r.creadas, saltadas: saltadas.map((f) => f.titulo.trim() || '(sin título)'), error: r.error })
    if (r.error) { setExistentes(await titulosDelCancionero()); setError(r.error) }
    if (r.creadas > 0 && !r.error) { setPaso('listo'); toast(`${r.creadas} ${r.creadas === 1 ? 'canción agregada' : 'canciones agregadas'}`) }
  }

  return (
    <div className="px-5 pt-[54px] pb-6">
      <header className="flex items-center gap-3.5">
        <Link to="/cancionero" className="iconbtn" aria-label="Volver al cancionero"><Icon name="atras" size={20} strokeWidth={2.2} /></Link>
        <div className="flex min-w-0 grow flex-col gap-0.5">
          <h1 className="display m-0 text-[28px] leading-[1.1] font-semibold tracking-[-0.02em]">Cargar varias</h1>
          <span className="text-[15px]" style={{ color: 'var(--muted)' }}>{paso === 'pegar' ? 'Pega las letras y yo las separo' : paso === 'revisar' ? 'Revisa antes de guardar' : 'Listo'}</span>
        </div>
      </header>

      {paso === 'pegar' && (
        <div className="mt-5 flex flex-col gap-3">
          <p className="m-0 text-[14.5px] leading-snug" style={{ color: 'var(--muted)' }}>
            Pega una o varias canciones. Sirven las que tienen <b>acordes encima de la letra</b> (como en la mayoría de páginas), con acordes <b>[entre corchetes]</b>, o <b>solo la letra</b>.
            Separa cada canción con <b>dos líneas en blanco</b> o con una línea que diga <b>---</b>. Si la primera línea es el título (o “Título - Autor”) y hay una línea “Tono: G”, las uso.
          </p>
          <textarea className="letra-editor" rows={14} spellCheck={false} aria-label="Canciones para cargar" value={texto} placeholder="Pega aquí…" onChange={(e) => { setTexto(e.target.value); setError('') }} />
          <div className="flex items-center justify-between px-1 text-[13px]" style={{ color: 'var(--muted)' }}>
            <span>{texto.trim() ? `${texto.length.toLocaleString('es-GT')} caracteres` : ''}</span>
            {!texto.trim() && <button type="button" className="undo" style={{ height: 32, padding: '0 8px' }} onClick={() => setTexto(EJEMPLO)}>Ver un ejemplo</button>}
          </div>
          <span role="status" className="min-h-5 px-1 text-sm font-semibold" style={{ color: 'var(--danger)' }}>{error}</span>
          <button type="button" className="cta" disabled={revisando} onClick={() => void revisar()}>
            {revisando ? <span className="spinner" aria-label="Revisando" /> : <>Revisar canciones<Icon name="derecha" size={18} strokeWidth={2.2} /></>}
          </button>
        </div>
      )}

      {paso === 'revisar' && (
        <div className="mt-4 flex flex-col gap-3">
          <p className="m-0 text-[14.5px] leading-snug" style={{ color: 'var(--muted)' }}>
            Encontré <b>{filas.length}</b> {filas.length === 1 ? 'canción' : 'canciones'}. Corrige el título o el tono si hace falta y desmarca las que no quieras. Entran como <b>Nuevas</b>.
          </p>
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {filas.map((f, i) => {
              const e = est[i]!
              const bloqueada = e !== 'ok'
              return (
                <li key={f.id} className="tcard" style={{ opacity: bloqueada ? 0.78 : 1, gap: 10, padding: 12 }}>
                  <div className="flex items-start gap-2.5">
                    <button type="button" role="checkbox" aria-checked={f.marcada && !bloqueada} aria-label={`Guardar ${f.titulo || 'canción ' + (i + 1)}`} disabled={bloqueada}
                      className={'pendiente' + (f.marcada && !bloqueada ? ' on' : '')} style={{ minHeight: 44, width: 44, padding: 0, justifyContent: 'center', background: 'transparent' }} onClick={() => cambiar(f.id, { marcada: !f.marcada })}>
                      <span className="pbox"><Icon name="check" size={14} strokeWidth={3} /></span>
                    </button>
                    <div className="flex min-w-0 grow flex-col gap-2">
                      <div className={'field' + (e === 'sin-titulo' ? ' err' : '')} style={{ height: 54 }}>
                        <input id={`t-${f.id}`} type="text" placeholder=" " value={f.titulo} maxLength={120} onChange={(ev) => cambiar(f.id, { titulo: ev.target.value })} style={{ paddingTop: 20, fontSize: 16 }} />
                        <label htmlFor={`t-${f.id}`} style={{ top: 17 }}>Título</label>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="flex items-center gap-1.5 text-[13px] font-extrabold">Tono
                          <select value={f.tono ?? ''} onChange={(ev) => cambiar(f.id, { tono: ev.target.value || null, tonoEstimado: false })} className="rounded-lg border px-2 py-1" style={{ background: 'var(--surface)', color: 'var(--ink)', borderColor: 'var(--line)', font: 'inherit', fontSize: 14 }}>
                            <option value="">—</option>{TONOS.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </label>
                        {f.tonoEstimado && <span className="ppill" style={{ background: 'var(--c-ambar-bg)', color: 'var(--c-ambar-fg)' }}>tono estimado</span>}
                        <span className="ppill" style={f.conAcordes ? { background: 'var(--c-lila-bg)', color: 'var(--c-lila-fg)' } : { background: 'var(--soft)', color: 'var(--muted)' }}>{f.conAcordes ? 'con acordes' : 'sin acordes'}</span>
                        {f.autor && <span className="text-[13px]" style={{ color: 'var(--muted)' }}>{f.autor}</span>}
                      </div>
                      {e !== 'ok' && <span role="status" className="text-[13px] font-extrabold" style={{ color: e === 'sin-titulo' ? 'var(--danger)' : 'var(--c-ambar-fg)' }}>{AVISO[e]}</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="more" aria-expanded={f.abierta} onClick={() => cambiar(f.id, { abierta: !f.abierta })}>{f.abierta ? 'Ocultar letra' : 'Ver letra'}</button>
                    {i > 0 && <button type="button" className="more" onClick={() => unirConAnterior(i)}>Unir con la anterior</button>}
                  </div>
                  {f.abierta && <div className="rounded-2xl p-3" style={{ background: 'var(--soft)', maxHeight: 280, overflowY: 'auto', fontSize: 15 }}><LetraView texto={f.letra} /></div>}
                </li>
              )
            })}
          </ul>

          <div className="sticky bottom-[96px] z-10 flex flex-col gap-2 rounded-3xl p-3" style={{ background: 'var(--surface)', border: '1.5px solid var(--line)', boxShadow: '0 14px 30px -18px var(--ink)' }}>
            <span role="status" className="px-1 text-[13.5px] font-bold" style={{ color: error ? 'var(--danger)' : 'var(--muted)' }}>
              {error || `${aGuardar.length} para guardar${saltadas.length ? ` · ${saltadas.length} se saltan` : ''}${sinRed ? ' · Sin conexión: necesitas internet para guardar' : ''}`}
            </span>
            <div className="flex gap-2">
              <button type="button" className="ghost-link" onClick={() => { setPaso('pegar'); setError('') }}>Editar texto</button>
              <button type="button" className="cta grow" style={{ height: 48 }} disabled={guardando || aGuardar.length === 0 || sinRed} onClick={() => void guardar()}>
                {guardando ? <span className="spinner" aria-label="Guardando" /> : aGuardar.length === 1 ? 'Guardar 1 canción' : `Guardar ${aGuardar.length} canciones`}
              </button>
            </div>
          </div>
        </div>
      )}

      {paso === 'listo' && resultado && (
        <div className="mt-6 flex flex-col gap-4">
          <div className="rounded-3xl p-5" style={{ background: 'var(--card)' }}>
            <h2 className="display m-0 text-2xl font-semibold">{resultado.creadas} {resultado.creadas === 1 ? 'canción agregada' : 'canciones agregadas'}</h2>
            <p className="m-0 mt-1.5 text-[15px]" style={{ color: 'var(--muted)' }}>Quedaron en fase <b>Nueva</b>. Cuando el equipo las aprenda, las pasas a Lista.</p>
          </div>
          {resultado.saltadas.length > 0 && (
            <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1.5px solid var(--line)' }}>
              <h3 className="m-0 mb-1.5 text-[15px] font-extrabold">Se saltaron {resultado.saltadas.length}</h3>
              <ul className="m-0 pl-5 text-[14px]" style={{ color: 'var(--muted)' }}>{resultado.saltadas.slice(0, 30).map((t, i) => <li key={i}>{t}</li>)}</ul>
            </div>
          )}
          <button type="button" className="cta" onClick={() => navigate('/cancionero')}>Ver el cancionero</button>
          <button type="button" className="undo self-center" onClick={() => { setTexto(''); setFilas([]); setResultado(null); setPaso('pegar') }}>Cargar más</button>
        </div>
      )}
    </div>
  )
}
