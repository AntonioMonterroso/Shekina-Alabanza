import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useAuth } from '../../hooks/authContext'
import { cargarCanciones } from './exportarDatos'
import LetraView from './LetraView'
import type { CancionLocal } from '../../lib/offline/almacen'

/** Las letras en una página limpia (blanco y negro) para imprimir o guardar como PDF. */
export default function Imprimir() {
  const { membresia } = useAuth()
  const [todas, setTodas] = useState<CancionLocal[] | null>(null)
  const [acordes, setAcordes] = useState(true)
  const [soloListas, setSoloListas] = useState(false)
  const [porPagina, setPorPagina] = useState(false)

  useEffect(() => {
    if (!membresia) return
    void cargarCanciones(membresia.grupo_id).then((r) => setTodas(r.canciones))
  }, [membresia])

  const lista = useMemo(() => (todas ?? []).filter((c) => !soloListas || c.fase === 'lista'), [todas, soloListas])

  return (
    <div className="imprimir px-5 pt-[54px] pb-8">
      <div className="no-imprimir">
        <header className="flex items-center gap-3.5">
          <Link to="/cancionero/exportar" className="iconbtn" aria-label="Volver"><Icon name="atras" size={20} strokeWidth={2.2} /></Link>
          <div className="flex min-w-0 grow flex-col gap-0.5">
            <h1 className="display m-0 text-[28px] leading-[1.1] font-semibold tracking-[-0.02em]">Imprimir</h1>
            <span className="text-[15px]" style={{ color: 'var(--muted)' }}>{todas === null ? 'Cargando…' : `${lista.length} ${lista.length === 1 ? 'canción' : 'canciones'}`}</span>
          </div>
        </header>
        <div className="mt-4 flex flex-col gap-3 rounded-3xl p-4" style={{ background: 'var(--surface)', border: '1.5px solid var(--line)' }}>
          {([['Mostrar acordes', acordes, setAcordes], ['Solo las que están en fase Lista', soloListas, setSoloListas], ['Una canción por hoja', porPagina, setPorPagina]] as const).map(([nombre, valor, poner]) => (
            <div key={nombre} className="flex items-center justify-between gap-3">
              <span className="text-[15px] font-extrabold">{nombre}</span>
              <button type="button" role="switch" aria-checked={valor} aria-label={nombre} className={'sw' + (valor ? ' on' : '')} onClick={() => poner(!valor)} />
            </div>
          ))}
          <button type="button" className="cta" disabled={lista.length === 0} onClick={() => window.print()}>Imprimir o guardar como PDF</button>
        </div>
      </div>

      <div className="hoja-impresa mt-6">
        {lista.map((c) => (
          <article key={c.id} className={'cancion-impresa' + (porPagina ? ' por-pagina' : '')}>
            <h2 className="display m-0 text-[22px] font-semibold">{c.titulo}</h2>
            <p className="m-0 mb-2 text-[13px] font-bold" style={{ color: 'var(--muted)' }}>{[c.autor, c.tono_original ? `Tono ${c.tono_original}` : null, c.bpm ? `${c.bpm} BPM` : null].filter(Boolean).join(' · ')}</p>
            <div style={{ fontSize: 15 }}><LetraView texto={c.letra_chordpro ?? ''} acordes={acordes} /></div>
          </article>
        ))}
      </div>
    </div>
  )
}
