import { useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useToast } from '../../components/Toast'
import { useAuth } from '../../hooks/authContext'
import { iniciales } from '../../lib/fechas'
import { permisos } from '../../lib/permisos'
import { ROL_LABEL, type Rol } from '../../lib/tipos'
import HojaIntegrante from './HojaIntegrante'
import HojaNuevo from './HojaNuevo'
import { useEquipoAdmin, type Integrante } from './useEquipoAdmin'

const QUE_VE: Record<Rol, string> = {
  propietario: 'Todo, y nombra a los líderes.',
  lider: 'Arma servicios, turnos y lo público.',
  musico: 'Cancionero, ensayos y sus turnos.',
  voz: 'Letras, tonos y sus turnos.',
  sonido: 'Ve el orden del servicio.',
  multimedia: 'Controla la pantalla del templo.',
  alumno: 'Solo su formación en Escuela.',
  maestro: 'Enseña en la Escuela (sin ser del equipo).',
  tutor: 'Ve el avance de su hijo en la Escuela.',
}
const COLOR: Record<Rol, [string, string]> = {
  propietario: ['var(--primary)', 'var(--on-primary)'],
  lider: ['var(--c-verde-bg)', 'var(--c-verde-fg)'],
  musico: ['var(--c-lila-bg)', 'var(--c-lila-fg)'],
  voz: ['var(--c-rosa-bg)', 'var(--c-rosa-fg)'],
  sonido: ['var(--c-azul-bg)', 'var(--c-azul-fg)'],
  multimedia: ['var(--c-ambar-bg)', 'var(--c-ambar-fg)'],
  alumno: ['var(--soft)', 'var(--muted)'],
  maestro: ['var(--c-verde-bg)', 'var(--c-verde-fg)'],
  tutor: ['var(--soft)', 'var(--muted)'],
}

export default function Equipo() {
  const { membresia, rol, perfil } = useAuth()
  const p = permisos(rol)
  const toast = useToast()
  const e = useEquipoAdmin(membresia?.grupo_id)
  const [abierto, setAbierto] = useState<Integrante | null>(null)
  const [nuevo, setNuevo] = useState(false)
  const [roles, setRoles] = useState(false)
  const soyPropietario = rol === 'propietario'
  const yo = e.equipo.find((m) => m.userId === perfil?.id)

  return (
    <div className="relative">
      <div aria-hidden className="blob" style={{ width: 260, height: 240, right: -120, top: -100, background: 'var(--blob1)' }} />
      <div className="relative flex flex-col gap-3.5 px-5 pt-[54px]">
        <header className="rise flex items-center gap-3">
          <Link to="/" className="iconbtn" aria-label="Volver al inicio"><Icon name="atras" size={20} strokeWidth={2.2} /></Link>
          <div className="flex min-w-0 grow flex-col gap-0.5">
            <h1 className="display m-0 text-[30px] leading-[1.1] font-semibold tracking-[-0.02em]">Equipo</h1>
            <span className="truncate text-sm font-bold" style={{ color: 'var(--muted)' }}>{membresia?.grupo.nombre}{e.equipo.length ? ` · ${e.equipo.length} integrantes` : ''}</span>
          </div>
          {p.esLider && <button type="button" className="iconbtn prim" aria-label="Agregar integrante" onClick={() => setNuevo(true)}><Icon name="mas" size={20} strokeWidth={2.4} /></button>}
        </header>

        <button type="button" className="more self-start" aria-expanded={roles} onClick={() => setRoles(!roles)}>Qué puede hacer cada rol<Icon name="chevron" size={14} strokeWidth={2.4} /></button>
        {roles && (
          <div className="flex flex-col gap-1.5 rounded-2xl p-3" style={{ background: 'var(--surface)', border: '1.5px solid var(--line)' }}>
            {(Object.keys(QUE_VE) as Rol[]).map((r) => (
              <div key={r} className="flex items-center gap-2.5"><span className="ppill w-[92px] text-center" style={{ background: COLOR[r][0], color: COLOR[r][1] }}>{ROL_LABEL[r]}</span><span className="text-sm">{QUE_VE[r]}</span></div>
            ))}
            <div className="flex items-center gap-2.5"><span className="ppill w-[92px] text-center" style={{ background: 'var(--soft)', color: 'var(--muted)' }}>Congregación</span><span className="text-sm">Sin cuenta. Solo la página pública.</span></div>
          </div>
        )}

        {e.cargando ? (
          <div className="esqueleto h-40" />
        ) : e.error ? (
          <p className="m-0 rounded-2xl p-4" style={{ background: 'var(--alerta-bg)', color: 'var(--alerta-fg)' }}>No se pudo cargar el equipo.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {e.equipo.map((m) => {
              const [bg, fg] = COLOR[m.rol]
              const sub = [m.descripcion, m.puestos.length ? `Cubre: ${m.puestos.join(', ')}` : null].filter(Boolean).join(' · ')
              const fila = (
                <>
                  <span className="av shrink-0" style={{ background: bg, color: fg }}>{iniciales(m.nombre)}</span>
                  <span className="flex min-w-0 grow flex-col text-left">
                    <span className="truncate text-base font-extrabold">{m.nombre}{m.id === yo?.id ? ' (tú)' : ''}</span>
                    {sub && <span className="truncate text-[13px]" style={{ color: 'var(--muted)' }}>{sub}</span>}
                  </span>
                  <span className="ppill" style={{ background: bg, color: fg }}>{ROL_LABEL[m.rol]}</span>
                </>
              )
              return (
                <li key={m.id}>
                  {p.esLider
                    ? <button type="button" className="tile w-full" aria-label={`Editar a ${m.nombre}`} onClick={() => setAbierto(m)}>{fila}</button>
                    : <div className="tile" style={{ cursor: 'default' }}>{fila}</div>}
                </li>
              )
            })}
          </ul>
        )}
        {!p.esLider && <p className="m-0 px-1 pb-2 text-sm" style={{ color: 'var(--muted)' }}>Solo los líderes agregan integrantes y cambian roles.</p>}
      </div>

      {p.esLider && (
        <>
          <HojaNuevo abierta={nuevo} onCerrar={() => setNuevo(false)} puedeNombrarLideres={soyPropietario} onCrear={e.crear} />
          <HojaIntegrante integrante={abierto} puestosDisponibles={e.puestos} soyPropietario={soyPropietario} esYo={abierto?.id === yo?.id} onCerrar={() => setAbierto(null)}
            onGuardar={async (id, c) => { const f = await e.guardar(id, c); if (!f) toast('Cambios guardados'); return f }} onQuitar={async (id) => { const f = await e.quitar(id); if (!f) toast('Integrante quitado'); return f }} onPassword={e.cambiarPassword} />
        </>
      )}
    </div>
  )
}
