import { useState } from 'react'
import { Link } from 'react-router-dom'
import Hoja from '../../components/Hoja'
import Icon, { type IconName } from '../../components/Icon'
import { useToast } from '../../components/Toast'
import { useAuth } from '../../hooks/authContext'
import { diaNum, diaSemana, iniciales, mesCorto, hora, saludo } from '../../lib/fechas'
import { permisos } from '../../lib/permisos'
import { ROL_LABEL } from '../../lib/tipos'
import { useInicio } from './useInicio'

const CHIPS: Record<string, [string, string]> = {
  servicios: ['var(--c-verde-bg)', 'var(--c-verde-fg)'],
  cancionero: ['var(--c-lila-bg)', 'var(--c-lila-fg)'],
  turnos: ['var(--c-rosa-bg)', 'var(--c-rosa-fg)'],
  ensayos: ['var(--c-ambar-bg)', 'var(--c-ambar-fg)'],
}

function Mosaico({ ruta, icono, titulo, sub, retraso }: { ruta: string; icono: IconName; titulo: string; sub: string; retraso: number }) {
  const [bg, fg] = CHIPS[icono] ?? CHIPS.servicios!
  return (
    <Link to={ruta} className="rise tile" style={{ animationDelay: `${retraso}ms` }}>
      <span className="chip" style={{ background: bg, color: fg }}><Icon name={icono} /></span>
      <span className="flex min-w-0 flex-col"><span className="text-base font-extrabold">{titulo}</span><span className="text-[13px]" style={{ color: 'var(--muted)' }}>{sub}</span></span>
    </Link>
  )
}

export default function Inicio() {
  const { perfil, membresia, membresias, rol, elegirGrupo } = useAuth()
  const p = permisos(rol)
  const toast = useToast()
  const d = useInicio(membresia?.grupo_id, membresia?.id, p.esLider, p.verServicios)
  const [grupos, setGrupos] = useState(false)

  const primerNombre = perfil?.nombre.split(' ')[0] ?? ''
  const otros = d.equipo.filter((e) => e.id !== membresia?.id)

  async function responder(estado: 'confirmado' | 'no_puede') {
    const ok = await d.responder(estado)
    toast(!ok ? 'No se pudo guardar. Intenta de nuevo.' : estado === 'confirmado' ? 'Turno confirmado' : 'Se avisó al líder para buscar reemplazo')
  }

  if (!membresia) {
    return (
      <div className="px-5 pt-14">
        <h1 className="display m-0 text-[30px] leading-tight font-semibold">{saludo()}, {primerNombre}</h1>
        <p className="mt-4 rounded-2xl p-4 text-base" style={{ background: 'var(--soft)' }}>Tu usuario todavía no está en ningún grupo. Pídele a tu líder que te agregue.</p>
      </div>
    )
  }

  return (
    <div className="relative">
      <div aria-hidden className="blob" style={{ width: 280, height: 260, right: -120, top: -110, background: 'var(--blob1)' }} />
      <div className="relative flex flex-col gap-3.5 px-5 pt-[52px]">
        <header className="rise flex items-center justify-between px-1">
          <div className="flex min-w-0 flex-col gap-0.5">
            <button type="button" className="grp" aria-label="Cambiar de grupo" onClick={() => setGrupos(true)}>
              <span className="dotc" aria-hidden />
              <span className="truncate">{membresia.grupo.nombre} · {ROL_LABEL[rol!]}</span>
              <Icon name="chevron" size={14} strokeWidth={2.4} />
            </button>
            <h1 className="display m-0 text-[30px] leading-[1.1] font-semibold tracking-[-0.02em]">{saludo()}, {primerNombre}</h1>
          </div>
          <Link to={p.verEquipo ? '/equipo' : '/perfil'} aria-label={p.verEquipo ? 'Equipo y roles' : 'Tu perfil'} className="avatares">
            <span className="av" style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}>{iniciales(perfil?.nombre ?? 'TÚ')}</span>
            {otros[0] && <span className="av" style={{ background: 'var(--c-lila-bg)', color: 'var(--c-lila-fg)', marginLeft: -10 }}>{iniciales(otros[0].nombre)}</span>}
            {otros.length > 1 && <span className="av" style={{ background: 'var(--soft)', color: 'var(--ink)', marginLeft: -10, fontSize: 12 }}>+{otros.length - 1}</span>}
          </Link>
        </header>

        {p.verServicios && (
          <section className="rise turn" aria-label="Tu turno" style={{ animationDelay: '90ms' }}>
            {d.cargando ? (
              <div className="flex items-center gap-3.5"><span className="esqueleto h-[58px] w-[54px]" /><span className="esqueleto h-12 flex-1" /></div>
            ) : !d.servicio ? (
              <div><span className="eyebrow">Próximo servicio</span><p className="m-0 mt-1 text-[17px] font-extrabold">Todavía no hay servicios programados</p></div>
            ) : (
              <>
                <div className="flex items-center gap-3.5">
                  <span className="fechita">
                    <span className="text-[11px] font-extrabold uppercase" style={{ color: 'var(--primary)' }}>{diaSemana(d.servicio.fecha)}</span>
                    <span className="mt-[3px] text-[22px] font-extrabold">{diaNum(d.servicio.fecha)}</span>
                    <span className="text-[11px] font-extrabold uppercase" style={{ color: 'var(--muted)' }}>{mesCorto(d.servicio.fecha)}</span>
                  </span>
                  <span className="flex min-w-0 flex-col gap-[3px]">
                    <span className="eyebrow">{d.miTurno ? 'Tu turno' : 'Próximo servicio'}</span>
                    <span className="text-[19px] font-extrabold">{d.miTurno ? `${d.miTurno.puesto} · ${d.servicio.tipo}` : d.servicio.tipo}</span>
                    <span className="text-sm" style={{ color: 'var(--muted)' }}>
                      {d.miTurno ? (d.servicio.llegada ? `Llegada ${d.servicio.llegada}` : hora(d.servicio.fecha)) : `${hora(d.servicio.fecha)} · Sin turno para ti`}
                    </span>
                  </span>
                </div>
                {d.miTurno && (
                  <div className="flex gap-2">
                    {d.miTurno.estado === 'pendiente' ? (
                      <>
                        <button type="button" className="cbtn yes" onClick={() => responder('confirmado')}><Icon name="check" size={18} strokeWidth={2.4} />Confirmar</button>
                        <button type="button" className="cbtn no" onClick={() => responder('no_puede')}>No puedo</button>
                      </>
                    ) : (
                      <>
                        <span className="confirmed" role="status"><Icon name="check" size={18} strokeWidth={2.6} />{d.miTurno.estado === 'confirmado' ? 'Confirmado' : 'Avisaste que no puedes'}</span>
                        <button type="button" className="undo" onClick={() => responder(d.miTurno!.estado === 'confirmado' ? 'no_puede' : 'confirmado')}>Cambiar</button>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {p.esAlumno && (
          <section className="rise turn" aria-label="Tu próxima clase" style={{ animationDelay: '90ms' }}>
            <span className="eyebrow">Tu próxima clase</span>
            <p className="m-0 text-[17px] font-extrabold">Aún no hay clases programadas</p>
            <p className="m-0 text-sm" style={{ color: 'var(--muted)' }}>Cuando tu maestro agende una, aparecerá aquí con tu práctica de la semana.</p>
          </section>
        )}

        {p.esLider && d.sinCubrir > 0 && (
          <Link to="/turnos" className="rise alerta" style={{ animationDelay: '130ms' }}>
            <Icon name="alerta" size={18} strokeWidth={2.2} />
            <span className="grow">{d.sinCubrir === 1 ? '1 puesto sin cubrir este mes' : `${d.sinCubrir} puestos sin cubrir este mes`}</span>
            <Icon name="derecha" size={16} strokeWidth={2.4} />
          </Link>
        )}

        {p.verOrdenDelServicio && d.servicio && (
          <section className="rise order" aria-label="Orden del servicio" style={{ animationDelay: '160ms' }}>
            <div className="flex items-center justify-between px-2.5 pt-2 pb-1">
              <span className="text-[15px] font-extrabold">Orden del servicio</span>
              {d.orden.length > 3 && <Link to="/servicios" className="flex min-h-7 items-center text-sm font-extrabold no-underline">Ver las {d.orden.length}</Link>}
            </div>
            {d.orden.length === 0 ? (
              <p className="m-0 px-2.5 py-3 text-sm" style={{ color: 'var(--muted)' }}>El líder todavía no arma el orden de este servicio.</p>
            ) : d.orden.slice(0, 3).map((o) => (
              <div key={o.n} className="orow">
                <span className="onum">{o.n}</span>
                <span className="flex min-w-0 grow flex-col">
                  <span className="truncate text-[15px] font-extrabold">{o.titulo}</span>
                  {o.detalle && <span className="text-[13px]" style={{ color: 'var(--muted)' }}>{o.detalle}</span>}
                </span>
                {o.tono && <span className="key">{o.tono}</span>}
              </div>
            ))}
          </section>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          {p.verServicios && <Mosaico ruta="/servicios" icono="servicios" titulo="Servicios" sub="Orden de culto" retraso={220} />}
          {p.verCancionero && <Mosaico ruta="/cancionero" icono="cancionero" titulo="Cancionero" sub="Letras y acordes" retraso={260} />}
          {p.verTurnos && <Mosaico ruta="/turnos" icono="turnos" titulo="Turnos" sub="Quién toca cuándo" retraso={300} />}
          {p.verEnsayos && <Mosaico ruta="/ensayos" icono="ensayos" titulo="Ensayos" sub="Asistencia y repaso" retraso={340} />}
        </div>

        <nav className="rise scrollx" aria-label="Más módulos" style={{ animationDelay: '380ms' }}>
          {p.verEscenario && <Link to="/escenario" className="more"><Icon name="escenario" size={18} strokeWidth={2} />Modo escenario</Link>}
          {p.verProyeccion && <Link to="/proyeccion" className="more"><Icon name="proyeccion" size={18} strokeWidth={2} />Proyección</Link>}
          <Link to="/perfil" className="more"><Icon name="perfil" size={18} strokeWidth={2} />Mi perfil</Link>
          <a href={`/p/${membresia.grupo.slug}`} className="more"><Icon name="mundo" size={18} strokeWidth={2} />Página pública</a>
        </nav>
      </div>

      <Hoja titulo="Grupos de alabanza" abierta={grupos} onCerrar={() => setGrupos(false)}>
        <div className="mx-1 mb-1 flex flex-col gap-1">
          <h2 className="display m-0 text-2xl font-semibold">Grupos de alabanza</h2>
          <p className="m-0 text-[15px]" style={{ color: 'var(--muted)' }}>Cada grupo tiene su propio equipo, cancionero y turnos.</p>
        </div>
        {membresias.map((m) => {
          const activo = m.grupo_id === membresia.grupo_id
          return (
            <button key={m.id} type="button" className={'gopt' + (activo ? ' on' : '')} aria-pressed={activo} onClick={() => { elegirGrupo(m.grupo_id); setGrupos(false) }}>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[15px] font-extrabold" style={{ background: activo ? 'var(--primary)' : 'var(--soft)', color: activo ? 'var(--on-primary)' : 'var(--ink)' }}>{iniciales(m.grupo.nombre)}</span>
              <span className="flex min-w-0 grow flex-col"><span className="text-base font-extrabold">{m.grupo.nombre}</span><span className="text-[13px]" style={{ color: 'var(--muted)' }}>{ROL_LABEL[m.rol]}{activo ? ` · ${d.equipo.length} integrantes` : ''}</span></span>
              {activo && <Icon name="check" size={20} strokeWidth={2.6} style={{ color: 'var(--primary)' }} />}
            </button>
          )
        })}
      </Hoja>
    </div>
  )
}
