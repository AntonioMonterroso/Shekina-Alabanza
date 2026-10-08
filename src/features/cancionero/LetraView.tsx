import { useMemo } from 'react'
import { parse, transponerAcorde } from '../../lib/chordpro'

interface Props {
  texto: string
  pasos?: number
  bemoles?: boolean
  acordes?: boolean
}

// Letra con acordes encima de cada sílaba. Los acordes se transponen aquí, en el cliente.
export default function LetraView({ texto, pasos = 0, bemoles = false, acordes = true }: Props) {
  const secciones = useMemo(() => parse(texto), [texto])
  if (secciones.length === 0) return <p className="m-0 text-[15px]" style={{ color: 'var(--muted)' }}>Todavía no hay letra.</p>
  return (
    <div className="letra">
      {secciones.map((s, i) => (
        <section key={i} className={'letra-seccion ' + s.tipo}>
          {s.etiqueta && <span className="letra-etiqueta">{s.etiqueta}</span>}
          {s.lineas.map((l, j) => {
            const hayAcordes = acordes && l.some((g) => g.acorde)
            return (
              <div key={j} className="letra-linea">
                {l.map((g, k) => (
                  <span key={k} className="seg">
                    {hayAcordes && <span className="acorde" aria-hidden={!g.acorde}>{g.acorde ? transponerAcorde(g.acorde, pasos, bemoles) : ' '}</span>}
                    <span className="txt">{g.texto || (g.acorde ? ' ' : '')}</span>
                  </span>
                ))}
              </div>
            )
          })}
        </section>
      ))}
    </div>
  )
}
