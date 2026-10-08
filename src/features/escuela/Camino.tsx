import Icon from '../../components/Icon'
import { estadoNiveles } from '../../lib/camino'
import { estiloColor, type Curso, type Hito, type Nivel } from './api'

/** El sendero de un curso: cada nivel es una estación; las completadas se llenan y la actual lleva un aro. */
export default function Camino({ curso, niveles, hitos }: { curso: Curso; niveles: Nivel[]; hitos: Hito[] }) {
  const propios = niveles.filter((n) => n.curso_id === curso.id).sort((a, b) => a.orden - b.orden)
  if (propios.length === 0) return null
  const hechos = new Set(hitos.map((h) => h.nivel_id))
  const estado = estadoNiveles(propios, hechos)
  const completos = propios.filter((n) => estado.get(n.id) === 'hecho').length

  return (
    <section aria-label={`Camino en ${curso.nombre}`} className="flex flex-col gap-2.5 rounded-3xl p-4" style={{ background: 'var(--surface)', border: '1.5px solid var(--line)' }}>
      <div className="flex items-center justify-between gap-2">
        <span className="ppill" style={estiloColor(curso.color)}>{curso.nombre}</span>
        <span className="text-[13px] font-extrabold" style={{ color: 'var(--muted)' }}>{completos} de {propios.length}{completos === propios.length ? ' · ¡completo!' : ''}</span>
      </div>
      <ol className="m-0 flex list-none items-start p-0">
        {propios.map((n, i) => {
          const e = estado.get(n.id)!
          return (
            <li key={n.id} className="flex min-w-0 flex-1 flex-col items-center gap-1.5" aria-label={`${n.nombre}: ${e === 'hecho' ? 'completado' : e === 'actual' ? 'en curso' : 'pendiente'}`}>
              <span className="flex w-full items-center">
                <span className="h-[3px] grow rounded" style={{ background: i === 0 ? 'transparent' : e === 'pendiente' ? 'var(--line)' : 'var(--primary)' }} />
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[13px] font-extrabold"
                  style={e === 'hecho' ? { background: 'var(--primary)', color: 'var(--on-primary)' } : e === 'actual' ? { background: 'var(--surface)', color: 'var(--primary)', outline: '3px solid var(--primary)', outlineOffset: 1 } : { background: 'var(--soft)', color: 'var(--muted)' }}>
                  {e === 'hecho' ? <Icon name="check" size={16} strokeWidth={3} /> : n.orden}
                </span>
                <span className="h-[3px] grow rounded" style={{ background: i === propios.length - 1 ? 'transparent' : e === 'hecho' ? 'var(--primary)' : 'var(--line)' }} />
              </span>
              <span className="w-full truncate text-center text-[12px] font-bold" style={{ color: e === 'pendiente' ? 'var(--muted)' : 'var(--ink)' }}>{n.nombre}</span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
