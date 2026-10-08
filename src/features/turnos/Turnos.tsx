import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Hoja from '../../components/Hoja'
import Icon from '../../components/Icon'
import { useToast } from '../../components/Toast'
import { useAuth } from '../../hooks/AuthProvider'
import { useEquipo } from '../../hooks/useEquipo'
import { primerNombre } from '../../lib/avatar'
import { diaNum, diaSemana, fechaGT, hora, mesCorto, mesLargo } from '../../lib/fechas'
import { permisos } from '../../lib/permisos'
import HojaAsignar, { type ContextoAsignar } from './HojaAsignar'
import HojaFechas from './HojaFechas'
import { useTurnos, type EstadoTurno, type Turno } from './useTurnos'

type Vista = 'mias' | 'todos'

const TEXTO: Record<EstadoTurno, string> = { confirmado: 'Confirmado', pendiente: 'Pendiente', no_puede: 'No puede' }

export default function Turnos() {
  const { membresia, rol } = useAuth()
  const p = permisos(rol)
  const toast = useToast()
  const t = useTurnos(membresia?.grupo_id, membresia?.id)
  const equipo = useEquipo(membresia?.grupo_id)
  const [vista, setVista] = useState<Vista>('mias')
  const [asignando, setAsignando] = useState<{ turnoId: string } | null>(null)
  const [fechas, setFechas] = useState(false)
  const [agregarEn, setAgregarEn] = useState<string | null>(null) // servicioId

  const puestoDe = (id: string) => t.puestos.find((x) => x.id === id)
  const nombreDe = (id: string | null) => (id ? equipo.find((m) => m.id === id)?.nombre ?? '—' : null)
  const orden = (a: Turno, b: Turno) => (puestoDe(a.puesto_id)?.orden ?? 0) - (puestoDe(b.puesto_id)?.orden ?? 0)

  const mias = useMemo(
    () => t.turnos.filter((x) => x.miembro_id === membresia?.id).map((x) => ({ turno: x, servicio: t.servicios.find((s) => s.id === x.servicio_id)! })).filter((x) => x.servicio)
      .sort((a, b) => a.servicio.fecha.localeCompare(b.servicio.fecha)),
    [t.turnos, t.servicios, membresia?.id],
  )

  const contexto: ContextoAsignar | null = useMemo(() => {
    if (!asignando) return null
    const turno = t.turnos.find((x) => x.id === asignando.turnoId)
    const servicio = turno && t.servicios.find((s) => s.id === turno.servicio_id)
    const puesto = turno && t.puestos.find((x) => x.id === turno.puesto_id)
    return turno && servicio && puesto ? { turno, servicio, puesto } : null
  }, [asignando, t.turnos, t.servicios, t.puestos])

  async function responder(id: string, estado: EstadoTurno, ok: string) {
    const r = await t.responder(id, estado)
    toast(r ? ok : 'No se pudo guardar. Intenta de nuevo.')
  }

  const fechasServicio = [...new Set(t.servicios.map((s) => fechaGT(s.fecha)))]
  const misFechas = t.indis.filter((i) => i.miembro_id === membresia?.id).map((i) => i.fecha)
  const servicioAgregar = t.servicios.find((s) => s.id === agregarEn)
  const libres = servicioAgregar ? t.puestos.filter((x) => !t.turnos.some((y) => y.servicio_id === servicioAgregar.id && y.puesto_id === x.id)) : []

  return (
    <div className="relative">
      <div aria-hidden className="blob" style={{ width: 260, height: 240, right: -120, top: -100, background: 'var(--blob1)' }} />
      <div className="relative flex flex-col gap-3.5 px-5 pt-[54px]">
        <header className="rise flex items-center gap-3">
          <Link to="/" className="iconbtn" aria-label="Volver al inicio"><Icon name="atras" size={20} strokeWidth={2.2} /></Link>
          <div className="flex min-w-0 grow flex-col gap-0.5">
            <h1 className="display m-0 text-[30px] leading-[1.1] font-semibold tracking-[-0.02em]">Turnos</h1>
            <span className="truncate text-sm font-bold" style={{ color: 'var(--muted)' }}>{mesLargo()} · {membresia?.grupo.nombre}</span>
          </div>
          <button type="button" className="iconbtn" style={{ width: 'auto', padding: '0 12px', gap: 6, fontSize: 14, fontWeight: 800 }} onClick={() => setFechas(true)}>
            <Icon name="calendarioX" size={18} strokeWidth={2} /><span>No puedo</span>
          </button>
        </header>

        <div className="rise vista-seg" role="tablist" aria-label="Vista" style={{ animationDelay: '80ms' }}>
          <span className={'pill' + (vista === 'todos' ? ' r' : '')} aria-hidden />
          <button type="button" role="tab" aria-selected={vista === 'mias'} className={vista === 'mias' ? 'on' : ''} onClick={() => setVista('mias')}>Mis turnos</button>
          <button type="button" role="tab" aria-selected={vista === 'todos'} className={vista === 'todos' ? 'on' : ''} onClick={() => setVista('todos')}>{p.esLider ? 'Todo el grupo' : 'Mi equipo'}</button>
        </div>

        {t.cargando && [0, 1].map((i) => <div key={i} className="esqueleto" style={{ height: 112, background: 'var(--surface)', opacity: 0.7 }} />)}
        {t.error && <p className="m-0 rounded-2xl p-4 text-[15px] font-bold" style={{ background: 'var(--alerta-bg)', color: 'var(--alerta-fg)' }}>No pudimos cargar los turnos. Revisa tu conexión e intenta de nuevo.</p>}

        {!t.cargando && !t.error && vista === 'mias' && (
          <div className="flex flex-col gap-2.5">
            {mias.length === 0 && (
              <div className="rounded-3xl p-6 text-center" style={{ background: 'var(--card)' }}>
                <p className="m-0 text-[17px] font-extrabold">No tienes turnos próximos</p>
                <p className="mt-1.5 mb-0 text-[15px]" style={{ color: 'var(--muted)' }}>Cuando el líder te asigne uno, aparecerá aquí para que lo confirmes.</p>
              </div>
            )}
            {mias.map(({ turno, servicio }, i) => (
              <div key={turno.id} className="tcard" style={{ animationDelay: `${i * 60}ms` }}>
                <div className="flex items-center gap-3">
                  <span className="fecha-caja">
                    <span className="text-[11px] font-extrabold uppercase" style={{ color: 'var(--primary)' }}>{diaSemana(servicio.fecha)}</span>
                    <span className="mt-[3px] text-xl font-extrabold">{diaNum(servicio.fecha)}</span>
                    <span className="text-[11px] font-extrabold uppercase" style={{ color: 'var(--muted)' }}>{mesCorto(servicio.fecha)}</span>
                  </span>
                  <span className="flex min-w-0 grow flex-col gap-0.5">
                    <span className="text-[17px] font-extrabold">{puestoDe(turno.puesto_id)?.nombre}</span>
                    <span className="text-[13px]" style={{ color: 'var(--muted)' }}>{servicio.tipo} · {servicio.llegada ? `Llegada ${servicio.llegada}` : hora(servicio.fecha)}</span>
                  </span>
                </div>
                {turno.estado === 'pendiente' ? (
                  <div className="flex gap-2">
                    <button type="button" className="cbtn yes" onClick={() => responder(turno.id, 'confirmado', 'Turno confirmado')}><Icon name="check" size={18} strokeWidth={2.4} />Confirmar</button>
                    <button type="button" className="cbtn no" onClick={() => responder(turno.id, 'no_puede', 'Se avisó al líder')}>No puedo</button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="pillst" style={turno.estado === 'confirmado' ? { background: 'var(--soft)', color: 'var(--primary)' } : { background: 'var(--c-rosa-bg)', color: 'var(--c-rosa-fg)' }}>
                      {turno.estado === 'confirmado' ? 'Confirmado' : 'Avisaste que no puedes'}
                    </span>
                    <button type="button" className="linkbtn" onClick={() => responder(turno.id, 'pendiente', 'Turno de nuevo pendiente')}>Cambiar</button>
                  </div>
                )}
              </div>
            ))}
            <p className="mx-1 mt-1.5 mb-0 text-sm leading-[1.45]" style={{ color: 'var(--muted)' }}>Si no puedes, el líder recibe el aviso y busca reemplazo. Marca con tiempo las fechas que no puedes.</p>
          </div>
        )}

        {!t.cargando && !t.error && vista === 'todos' && (
          <div className="flex flex-col gap-2.5">
            <div className="legend px-1">
              <span><i className="st ok" style={{ width: 16, height: 16 }} />Confirmado</span>
              <span><i className="st pend" style={{ width: 16, height: 16 }} />Pendiente</span>
              <span><i className="st no" style={{ width: 16, height: 16 }} />No puede</span>
            </div>
            {t.servicios.length === 0 && (
              <div className="rounded-3xl p-6 text-center" style={{ background: 'var(--card)' }}>
                <p className="m-0 text-[17px] font-extrabold">Todavía no hay servicios programados</p>
                <p className="mt-1.5 mb-0 text-[15px]" style={{ color: 'var(--muted)' }}>{p.esLider ? 'Crea uno en Servicios para asignar turnos.' : 'Cuando el líder programe uno, verás aquí al equipo.'}</p>
                {p.esLider && <Link to="/servicios" className="cta mt-4 no-underline">Ir a Servicios</Link>}
              </div>
            )}
            {t.servicios.map((sv, si) => {
              const turnos = t.turnos.filter((x) => x.servicio_id === sv.id).sort(orden)
              const ok = turnos.filter((x) => x.estado === 'confirmado' && x.miembro_id).length
              const sinAsignar = turnos.filter((x) => !x.miembro_id).length
              const faltaReemplazo = turnos.some((x) => x.estado === 'no_puede' && x.miembro_id)
              return (
                <section key={sv.id} className="tcard" style={{ animationDelay: `${si * 70}ms` }}>
                  <div className="flex items-center gap-3">
                    <span className="fecha-caja">
                      <span className="text-[11px] font-extrabold uppercase" style={{ color: 'var(--primary)' }}>{diaSemana(sv.fecha)}</span>
                      <span className="mt-[3px] text-xl font-extrabold">{diaNum(sv.fecha)}</span>
                      <span className="text-[11px] font-extrabold uppercase" style={{ color: 'var(--muted)' }}>{mesCorto(sv.fecha)}</span>
                    </span>
                    <span className="flex min-w-0 grow flex-col gap-1.5">
                      <span className="flex justify-between gap-2"><span className="truncate text-base font-extrabold">{sv.tipo}</span><span className="text-[13px] font-extrabold" style={{ color: 'var(--muted)' }}>{ok}/{turnos.length}</span></span>
                      <span className="progreso"><i style={{ width: turnos.length ? `${Math.round((ok / turnos.length) * 100)}%` : '0%' }} /></span>
                      {(faltaReemplazo || sinAsignar > 0) && (
                        <span className="text-xs font-extrabold" style={{ color: 'var(--c-rosa-fg)' }}>
                          {[faltaReemplazo ? 'Falta reemplazo' : null, sinAsignar > 0 ? `${sinAsignar} sin asignar` : null].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="slots">
                    {turnos.map((x) => {
                      const quien = nombreDe(x.miembro_id)
                      const vacio = !x.miembro_id
                      const estado = vacio ? 'vacio' : x.estado === 'confirmado' ? 'ok' : x.estado === 'pendiente' ? 'pend' : 'no'
                      const yo = x.miembro_id === membresia?.id
                      return (
                        <button key={x.id} type="button" className={'slot' + (estado === 'no' ? ' no' : '') + (vacio ? ' vacio' : '') + (p.esLider ? '' : ' ro')}
                          aria-label={`${puestoDe(x.puesto_id)?.nombre}: ${quien ?? 'sin asignar'}${vacio ? '' : ', ' + TEXTO[x.estado].toLowerCase()}${p.esLider ? '. Reasignar' : ''}`}
                          onClick={() => { if (p.esLider) setAsignando({ turnoId: x.id }) }}>
                          <span className={'st ' + estado} aria-hidden>
                            {estado === 'ok' && <Icon name="check" size={13} strokeWidth={3.2} />}
                            {estado === 'pend' && <Icon name="reloj" size={13} strokeWidth={3} />}
                            {estado === 'no' && <Icon name="equis" size={12} strokeWidth={3.2} />}
                            {estado === 'vacio' && <Icon name="mas" size={13} strokeWidth={3} />}
                          </span>
                          <span className="flex min-w-0 flex-col">
                            <span className="text-[11px] font-extrabold tracking-[0.04em] uppercase" style={{ color: 'var(--muted)' }}>{puestoDe(x.puesto_id)?.nombre}</span>
                            <span className="truncate text-sm font-extrabold">{vacio ? 'Sin asignar' : yo ? 'Tú' : primerNombre(quien!)}</span>
                          </span>
                        </button>
                      )
                    })}
                    {p.esLider && (
                      <button type="button" className="slot nuevo" onClick={() => setAgregarEn(sv.id)} aria-label={`Agregar puesto al ${sv.tipo}`}>
                        <span className="st" style={{ background: 'var(--soft)', color: 'var(--primary)' }} aria-hidden><Icon name="mas" size={14} strokeWidth={3} /></span>
                        <span className="text-sm font-extrabold" style={{ color: 'var(--primary)' }}>Puesto</span>
                      </button>
                    )}
                  </div>
                  {turnos.length === 0 && !p.esLider && <p className="m-0 text-sm" style={{ color: 'var(--muted)' }}>El líder todavía no asigna este servicio.</p>}
                </section>
              )
            })}
          </div>
        )}
      </div>

      <HojaAsignar
        ctx={contexto}
        equipo={equipo}
        indis={t.indis}
        turnosServicio={contexto ? t.turnos.filter((x) => x.servicio_id === contexto.servicio.id) : []}
        puestos={t.puestos}
        onCerrar={() => setAsignando(null)}
        onAsignar={async (miembroId) => {
          if (!contexto) return
          const ok = await t.asignar(contexto.turno.id, miembroId)
          toast(!ok ? 'No se pudo asignar. Intenta de nuevo.' : miembroId ? `Se le pidió a ${primerNombre(nombreDe(miembroId) ?? '')} cubrir ${contexto.puesto.nombre}` : 'Puesto sin asignar')
          if (ok) setAsignando(null)
        }}
        onQuitar={async () => {
          if (!contexto) return
          const ok = await t.quitarTurno(contexto.turno.id)
          toast(ok ? `Se quitó ${contexto.puesto.nombre}` : 'No se pudo quitar. Intenta de nuevo.')
          if (ok) setAsignando(null)
        }}
      />

      <HojaFechas
        abierta={fechas}
        onCerrar={() => setFechas(false)}
        fechasServicio={fechasServicio}
        guardadas={misFechas}
        onGuardar={async (f) => { const ok = await t.guardarIndisponibilidad(f); if (ok) toast(f.length ? `Guardado: ${f.length} ${f.length === 1 ? 'fecha' : 'fechas'} sin turno` : 'Estás disponible todas las fechas'); return ok }}
      />

      <Hoja titulo="Agregar puesto" abierta={agregarEn !== null} onCerrar={() => setAgregarEn(null)}>
        <div className="mx-1 flex flex-col gap-1">
          <h2 className="display m-0 text-2xl font-semibold">Agregar puesto</h2>
          <p className="m-0 text-[15px]" style={{ color: 'var(--muted)' }}>Elige qué puesto necesita este servicio. Luego asignas a la persona.</p>
        </div>
        <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
          {libres.map((x) => (
            <button key={x.id} type="button" className="pick" onClick={async () => {
              const nuevo = await t.agregarPuesto(servicioAgregar!.id, x.id)
              setAgregarEn(null)
              if (nuevo) setAsignando({ turnoId: nuevo.id }); else toast('No se pudo agregar. Intenta de nuevo.')
            }}>
              <span className="text-[15px] font-extrabold">{x.nombre}</span>
            </button>
          ))}
          {libres.length === 0 && <p className="m-0 p-4 text-center text-[15px]" style={{ color: 'var(--muted)' }}>Ya agregaste todos los puestos disponibles.</p>}
        </div>
      </Hoja>
    </div>
  )
}
