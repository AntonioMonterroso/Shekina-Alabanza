import { useMemo } from 'react'
import Hoja from '../../components/Hoja'
import type { Integrante } from '../../hooks/useEquipo'
import { colorAvatar } from '../../lib/avatar'
import { fechaGT, fechaCorta } from '../../lib/fechas'
import { iniciales } from '../../lib/fechas'
import type { Indisponible, Puesto, ServicioTurnos, Turno } from './useTurnos'

export interface ContextoAsignar { turno: Turno; servicio: ServicioTurnos; puesto: Puesto }

interface Props {
  ctx: ContextoAsignar | null
  equipo: Integrante[]
  indis: Indisponible[]
  turnosServicio: Turno[]
  puestos: Puesto[]
  onCerrar: () => void
  onAsignar: (miembroId: string | null) => Promise<void>
  onQuitar: () => Promise<void>
}

const ESTADO = { confirmado: 'confirmado', pendiente: 'pendiente', no_puede: 'no puede' } as const

function Contenido({ ctx, equipo, indis, turnosServicio, puestos, onCerrar, onAsignar, onQuitar }: Props & { ctx: ContextoAsignar }) {
  const { turno, servicio, puesto } = ctx
  const dia = fechaGT(servicio.fecha)

  const candidatos = useMemo(() => {
    const ocupado = new Map(turnosServicio.filter((t) => t.miembro_id && t.id !== turno.id).map((t) => [t.miembro_id!, puestos.find((p) => p.id === t.puesto_id)?.nombre ?? 'otro puesto']))
    return equipo
      .filter((m) => m.rol !== 'alumno')
      .map((m) => {
        const actual = m.id === turno.miembro_id
        const bloqueado = indis.some((i) => i.miembro_id === m.id && i.fecha === dia)
        const puede = m.puestos.includes(puesto.nombre)
        const otro = ocupado.get(m.id)
        let nota = puede ? `Puede cubrir ${puesto.nombre}` : 'Disponible'
        if (actual) nota = `Asignado ahora · ${ESTADO[turno.estado]}`
        else if (bloqueado) nota = 'Marcó que no puede esta fecha'
        else if (otro) nota = `Ya cubre ${otro} este día`
        return { m, actual, bloqueado, puede, nota, peso: (actual ? 0 : bloqueado ? 3 : puede ? 1 : 2) }
      })
      .sort((a, b) => a.peso - b.peso || a.m.nombre.localeCompare(b.m.nombre, 'es'))
  }, [equipo, indis, turnosServicio, puestos, turno, puesto, dia])

  return (
    <>
      <div className="mx-1 flex flex-col gap-1">
        <h2 className="display m-0 text-2xl font-semibold">{puesto.nombre} · {fechaCorta(servicio.fecha)}</h2>
        <p className="m-0 text-[15px]" style={{ color: 'var(--muted)' }}>Elige quién lo cubre. Le llegará el aviso para confirmar.</p>
      </div>
      <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
        {candidatos.map(({ m, actual, bloqueado, nota }) => (
          <button key={m.id} type="button" className={'pick' + (actual ? ' cur' : '')} onClick={async () => { if (actual) return onCerrar(); await onAsignar(m.id) }}>
            <span className="avp" style={colorAvatar(m.id)}>{iniciales(m.nombre)}</span>
            <span className="flex min-w-0 grow flex-col">
              <span className="truncate text-[15px] font-extrabold">{m.nombre}</span>
              <span className="text-[13px]" style={{ color: bloqueado && !actual ? 'var(--c-rosa-fg)' : 'var(--muted)' }}>{nota}</span>
            </span>
          </button>
        ))}
        {candidatos.length === 0 && <p className="m-0 p-4 text-center text-[15px]" style={{ color: 'var(--muted)' }}>No hay integrantes para asignar todavía.</p>}
      </div>
      <div className="flex gap-2.5">
        {turno.miembro_id && <button type="button" className="ghost-link grow" onClick={() => onAsignar(null)}>Dejar sin asignar</button>}
        <button type="button" className="ghost-link grow" style={{ color: 'var(--danger)' }} onClick={onQuitar}>Quitar puesto</button>
      </div>
    </>
  )
}

export default function HojaAsignar(props: Props) {
  return (
    <Hoja titulo="Asignar turno" abierta={props.ctx !== null} onCerrar={props.onCerrar}>
      {props.ctx && <Contenido {...props} ctx={props.ctx} />}
    </Hoja>
  )
}
