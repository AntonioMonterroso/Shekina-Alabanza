import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Hoja from '../../components/Hoja'
import Icon from '../../components/Icon'
import { useToast } from '../../components/Toast'
import { useAuth } from '../../hooks/AuthProvider'
import { TONOS } from '../../lib/chordpro'
import { supabase } from '../../lib/supabase'
import { borrarCancion, crearCancion, guardarCancion, type DatosCancion } from './api'
import LetraView from './LetraView'

const EJEMPLO = `[Verso 1]
[D]Abre las [G]puertas, [D]Señor
[Em]Entra en este [A]lugar

[Coro]
[G]Santo, [D]santo, [A]santo
[Em]Digno es el [A]Cordero`

const vacio = { titulo: '', autor: '', tono: '', bpm: '', minutos: '4', categoria: '', letra: '', audio: '' }

export default function CancionForm() {
  const { id } = useParams()
  const editando = Boolean(id)
  const { membresia, session } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [f, setF] = useState(vacio)
  const [cargando, setCargando] = useState(editando)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [borrar, setBorrar] = useState(false)
  const [ver, setVer] = useState(false)

  useEffect(() => {
    if (!id) return
    supabase.from('canciones').select('*').eq('id', id).maybeSingle().then(({ data }) => {
      if (data) setF({
        titulo: data.titulo ?? '', autor: data.autor ?? '', tono: data.tono_original ?? '', bpm: data.bpm?.toString() ?? '',
        minutos: data.minutos?.toString() ?? '', categoria: data.categoria ?? '', letra: data.letra_chordpro ?? '', audio: data.audio_ref_url ?? '',
      })
      setCargando(false)
    })
  }, [id])

  const set = (k: keyof typeof vacio) => (e: { target: { value: string } }) => { setF((x) => ({ ...x, [k]: e.target.value })); setError('') }

  function validar(): DatosCancion | string {
    const titulo = f.titulo.trim()
    if (!titulo) return 'Escribe el título.'
    const bpm = f.bpm ? Number(f.bpm) : null
    if (bpm !== null && !(Number.isInteger(bpm) && bpm >= 20 && bpm <= 300)) return 'Los BPM van de 20 a 300.'
    const minutos = f.minutos ? Number(f.minutos) : null
    if (minutos !== null && !(Number.isInteger(minutos) && minutos >= 1 && minutos <= 30)) return 'La duración va de 1 a 30 minutos.'
    const audio = f.audio.trim()
    if (audio && !/^https?:\/\//i.test(audio)) return 'El enlace de audio debe empezar con http:// o https://'
    return {
      titulo, autor: f.autor.trim() || null, tono_original: f.tono || null, bpm, minutos,
      categoria: (f.categoria as DatosCancion['categoria']) || null,
      letra_chordpro: f.letra.trim() ? f.letra : null, audio_ref_url: audio || null,
    }
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const d = validar()
    if (typeof d === 'string') return setError(d)
    setGuardando(true)
    if (editando) {
      const ok = await guardarCancion(id!, d)
      setGuardando(false)
      if (!ok) return setError('No se pudo guardar. Intenta de nuevo.')
      toast('Cambios guardados')
      navigate(`/cancionero/${id}`)
    } else {
      const nuevo = await crearCancion(membresia!.grupo_id, session!.user.id, d)
      setGuardando(false)
      if (!nuevo) return setError('No se pudo agregar. Intenta de nuevo.')
      toast('Canción agregada como Nueva')
      navigate(`/cancionero/${nuevo}`)
    }
  }

  async function eliminar() {
    const ok = await borrarCancion(id!)
    setBorrar(false)
    if (!ok) return setError('No se pudo borrar. Si está en un servicio, quítala de ahí primero.')
    toast('Canción borrada')
    navigate('/cancionero')
  }

  if (cargando) return <div className="px-5 pt-[54px]"><div className="esqueleto" style={{ height: 200, background: 'var(--surface)' }} /></div>

  return (
    <div className="px-5 pt-[54px]">
      <header className="flex items-center gap-3.5">
        <Link to={editando ? `/cancionero/${id}` : '/cancionero'} className="iconbtn" aria-label="Cancelar"><Icon name="atras" size={20} strokeWidth={2.2} /></Link>
        <h1 className="display m-0 grow text-[28px] leading-[1.1] font-semibold tracking-[-0.02em]">{editando ? 'Editar canción' : 'Nueva canción'}</h1>
        {editando && <button type="button" className="iconbtn" aria-label="Borrar canción" onClick={() => setBorrar(true)}><Icon name="borrar" size={20} strokeWidth={2} /></button>}
      </header>

      <form onSubmit={enviar} noValidate className="mt-5 flex flex-col gap-3">
        <div className="field"><input id="titulo" type="text" placeholder=" " value={f.titulo} onChange={set('titulo')} maxLength={120} /><label htmlFor="titulo">Título</label></div>
        <div className="field"><input id="autor" type="text" placeholder=" " value={f.autor} onChange={set('autor')} maxLength={120} /><label htmlFor="autor">Autor</label></div>

        <div className="grid grid-cols-2 gap-3">
          <label className="campo-sel"><span>Tono original</span>
            <select value={f.tono} onChange={set('tono')}><option value="">Sin definir</option>{TONOS.map((t) => <option key={t} value={t}>{t}</option>)}</select>
          </label>
          <label className="campo-sel"><span>Tipo</span>
            <select value={f.categoria} onChange={set('categoria')}><option value="">Sin definir</option><option value="alabanza">Alabanza</option><option value="adoracion">Adoración</option></select>
          </label>
          <div className="field"><input id="bpm" type="number" inputMode="numeric" placeholder=" " value={f.bpm} onChange={set('bpm')} /><label htmlFor="bpm">BPM</label></div>
          <div className="field"><input id="min" type="number" inputMode="numeric" placeholder=" " value={f.minutos} onChange={set('minutos')} /><label htmlFor="min">Minutos</label></div>
        </div>

        <div className="field"><input id="audio" type="url" inputMode="url" placeholder=" " value={f.audio} onChange={set('audio')} /><label htmlFor="audio">Enlace de audio de referencia</label></div>

        <div className="flex flex-col gap-2">
          <div className="flex items-end justify-between px-1">
            <label htmlFor="letra" className="text-[15px] font-extrabold">Letra y acordes (ChordPro)</label>
            {!f.letra && <button type="button" className="undo" style={{ height: 32, padding: '0 8px' }} onClick={() => setF((x) => ({ ...x, letra: EJEMPLO }))}>Usar ejemplo</button>}
          </div>
          <textarea id="letra" className="letra-editor" rows={14} spellCheck={false} value={f.letra} onChange={set('letra')} placeholder={'[D]Abre las [G]puertas\n\nUsa [Coro] o [Verso 1] solos en una línea para separar las partes.'} />
          <p className="m-0 px-1 text-[13px]" style={{ color: 'var(--muted)' }}>Escribe el acorde entre corchetes justo antes de la sílaba: <code>[D]Abre las [G]puertas</code>. Una línea vacía separa estrofas.</p>
        </div>

        {f.letra.trim() && (
          <div className="flex flex-col gap-2">
            <button type="button" className="ghost-link" onClick={() => setVer(!ver)} aria-expanded={ver}><Icon name="cancionero" size={18} strokeWidth={2} />{ver ? 'Ocultar vista previa' : 'Ver cómo quedará'}</button>
            {ver && <div className="rounded-[22px] p-4" style={{ background: 'var(--surface)', border: '1.5px solid var(--line)' }}><LetraView texto={f.letra} /></div>}
          </div>
        )}

        <span role="status" className="min-h-5 px-1 text-sm font-semibold" style={{ color: 'var(--danger)' }}>{error}</span>
        <button type="submit" className="cta" disabled={guardando}>{guardando ? <span className="spinner" aria-label="Guardando" /> : editando ? 'Guardar cambios' : 'Agregar al cancionero'}</button>
      </form>

      <Hoja titulo="Borrar canción" abierta={borrar} onCerrar={() => setBorrar(false)}>
        <h2 className="display m-0 mx-1 text-2xl font-semibold">¿Borrar “{f.titulo}”?</h2>
        <p className="m-0 mx-1 text-[15px]" style={{ color: 'var(--muted)' }}>Se pierde la letra, los pendientes y las marcas de “ya me la sé”. No se puede deshacer.</p>
        <div className="flex gap-2.5">
          <button type="button" className="ghost-link grow" onClick={() => setBorrar(false)}>Cancelar</button>
          <button type="button" className="adv grow" style={{ background: 'var(--danger)', color: 'var(--bg)' }} onClick={eliminar}>Borrar</button>
        </div>
      </Hoja>
    </div>
  )
}
