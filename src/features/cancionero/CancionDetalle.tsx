import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useAuth } from '../../hooks/authContext'
import { transponerTono, usaBemoles } from '../../lib/chordpro'
import { permisos } from '../../lib/permisos'
import { supabase } from '../../lib/supabase'
import { infoFase } from './fases'
import LetraView from './LetraView'
import type { Cancion } from './useCanciones'

type Completa = Cancion & { minutos: number | null; letra_chordpro: string | null; audio_ref_url: string | null }

const urlSegura = (u: string | null) => (u && /^https?:\/\//i.test(u) ? u : null)

export default function CancionDetalle() {
  const { id } = useParams()
  const { rol } = useAuth()
  const p = permisos(rol)
  const [c, setC] = useState<Completa | null | undefined>(undefined)
  const [pasos, setPasos] = useState(0)
  const [acordes, setAcordes] = useState(rol !== 'voz') // Voz entra con acordes ocultos

  useEffect(() => {
    let vivo = true
    supabase.from('canciones').select('*').eq('id', id!).maybeSingle().then(({ data }) => { if (vivo) setC((data as Completa | null) ?? null) })
    return () => { vivo = false }
  }, [id])

  if (c === undefined) return <div className="px-5 pt-[54px]"><div className="esqueleto" style={{ height: 160, background: 'var(--surface)' }} /></div>
  if (c === null) {
    return (
      <div className="px-5 pt-[54px]">
        <Link to="/cancionero" className="iconbtn" aria-label="Volver al cancionero"><Icon name="atras" size={20} strokeWidth={2.2} /></Link>
        <p className="mt-6 text-base font-bold">No encontramos esta canción.</p>
      </div>
    )
  }

  const tono = c.tono_original
  const tonoActual = tono ? transponerTono(tono, pasos) : null
  const bemoles = tonoActual ? usaBemoles(tonoActual) : false
  const f = infoFase(c.fase)
  const audio = urlSegura(c.audio_ref_url)
  const meta = [c.autor, c.bpm ? `${c.bpm} BPM` : null, c.minutos ? `${c.minutos} min` : null].filter(Boolean).join(' · ')

  return (
    <div className="px-5 pt-[54px]">
      <header className="flex items-center gap-3.5">
        <Link to="/cancionero" className="iconbtn" aria-label="Volver al cancionero"><Icon name="atras" size={20} strokeWidth={2.2} /></Link>
        <div className="flex min-w-0 grow flex-col gap-0.5">
          <h1 className="display m-0 text-[28px] leading-[1.1] font-semibold tracking-[-0.02em]">{c.titulo}</h1>
          {meta && <span className="text-[15px]" style={{ color: 'var(--muted)' }}>{meta}</span>}
        </div>
        {p.esLider && <Link to={`/cancionero/${c.id}/editar`} className="iconbtn" aria-label="Editar canción"><Icon name="editar" size={20} strokeWidth={2} /></Link>}
      </header>

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <span className="ppill" style={{ background: f.bg, color: f.fg }}>{f.nombre}</span>
        {tono ? (
          <div className="tono-control" role="group" aria-label="Tono">
            <button type="button" aria-label="Bajar un semitono" onClick={() => setPasos((x) => x - 1)}><Icon name="menos" size={18} strokeWidth={2.4} /></button>
            <span aria-live="polite"><b>{tonoActual}</b>{pasos !== 0 && <small> (orig. {tono})</small>}</span>
            <button type="button" aria-label="Subir un semitono" onClick={() => setPasos((x) => x + 1)}><Icon name="mas" size={18} strokeWidth={2.4} /></button>
          </div>
        ) : (
          <span className="text-[13px] font-bold" style={{ color: 'var(--muted)' }}>Sin tono definido</span>
        )}
        {pasos !== 0 && tono && <button type="button" className="undo" style={{ height: 36 }} onClick={() => setPasos(0)}>Volver al original</button>}
      </div>

      <div className="mt-3.5 flex items-center gap-3">
        <button type="button" role="switch" aria-checked={acordes} aria-label="Mostrar acordes" className={'sw' + (acordes ? ' on' : '')} onClick={() => setAcordes(!acordes)} />
        <span className="text-[15px] font-extrabold">Acordes</span>
        {audio && <a href={audio} target="_blank" rel="noopener noreferrer" className="ghost-link ml-auto" style={{ flex: 'none' }}><Icon name="audio" size={18} strokeWidth={2} />Audio</a>}
      </div>

      <article className="mt-5 rounded-[22px] p-4" style={{ background: 'var(--surface)', border: '1.5px solid var(--line)' }}>
        <LetraView texto={c.letra_chordpro ?? ''} pasos={pasos} bemoles={bemoles} acordes={acordes} />
      </article>
    </div>
  )
}
