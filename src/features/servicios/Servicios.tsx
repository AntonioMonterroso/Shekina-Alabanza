import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useToast } from '../../components/Toast'
import { useAuth } from '../../hooks/authContext'
import { useEquipo } from '../../hooks/useEquipo'
import { diaNum, diaSemanaCap, fechaLarga, hora, mesCorto } from '../../lib/fechas'
import { permisos } from '../../lib/permisos'
import HojaAgregar from './HojaAgregar'
import HojaItem from './HojaItem'
import HojaServicio from './HojaServicio'
import { useServicios, type Item } from './useServicios'

export default function Servicios() {
  const { membresia, rol } = useAuth()
  const p = permisos(rol)
  const toast = useToast()
  const s = useServicios(membresia?.grupo_id)
  const equipo = useEquipo(membresia?.grupo_id)
  const [editando, setEditando] = useState(false)
  const [hojaServicio, setHojaServicio] = useState<'nuevo' | 'editar' | null>(null)
  const [agregar, setAgregar] = useState(false)
  const [itemEditado, setItemEditado] = useState<Item | null>(null)

  const nombreDe = (id: string | null) => (id ? equipo.find((m) => m.id === id)?.nombre ?? null : null)
  const minutos = useMemo(() => s.items.reduce((m, i) => m + i.minutosEfectivos, 0), [s.items])
  const usadas = useMemo(() => new Set(s.items.map((i) => i.cancion_id).filter(Boolean) as string[]), [s.items])
  const a = s.actual

  async function publicar() {
    if (!a) return
    const v = await s.togglePublicado(a.id)
    toast(v === null ? 'No se pudo cambiar. Intenta de nuevo.' : v ? 'Publicado para la congregación' : 'Servicio oculto del público')
  }

  function abrirAgregar() {
    void s.cargarCatalogo()
    setAgregar(true)
  }

  return (
    <div className="relative">
      <div aria-hidden className="blob" style={{ width: 260, height: 240, right: -120, top: -100, background: 'var(--blob1)' }} />
      <div className="relative flex flex-col gap-3.5 px-5 pt-[54px]">
        <header className="rise flex items-center gap-3">
          <Link to="/" className="iconbtn" aria-label="Volver al inicio"><Icon name="atras" size={20} strokeWidth={2.2} /></Link>
          <div className="flex min-w-0 grow flex-col gap-0.5">
            <h1 className="display m-0 text-[30px] leading-[1.1] font-semibold tracking-[-0.02em]">Servicios</h1>
            <span className="truncate text-sm font-bold" style={{ color: 'var(--muted)' }}>{membresia?.grupo.nombre}</span>
          </div>
          {p.esLider && a && (
            <button type="button" className={'iconbtn' + (editando ? ' prim' : '')} aria-pressed={editando} aria-label={editando ? 'Terminar de editar' : 'Editar orden'} onClick={() => { if (editando) toast('Orden guardado'); setEditando(!editando) }}>
              <Icon name={editando ? 'check' : 'editar'} size={20} strokeWidth={editando ? 2.6 : 2} />
            </button>
          )}
        </header>

        <div className="rise svc" role="tablist" aria-label="Elegir servicio" style={{ animationDelay: '80ms' }}>
          {s.servicios.map((x) => (
            <button key={x.id} type="button" role="tab" aria-selected={x.id === s.seleccion} className={'schip' + (x.id === s.seleccion ? ' on' : '')} onClick={() => { s.setSeleccion(x.id); setEditando(false) }}>
              <small>{diaSemanaCap(x.fecha)}</small><b>{diaNum(x.fecha)} {mesCorto(x.fecha)}</b>
            </button>
          ))}
          {p.esLider && (
            <button type="button" className="schip nuevo" onClick={() => setHojaServicio('nuevo')} aria-label="Crear servicio">
              <Icon name="mas" size={18} strokeWidth={2.4} /><b>Nuevo</b>
            </button>
          )}
        </div>

        {s.cargando && <div className="esqueleto" style={{ height: 150, background: 'var(--card)' }} />}
        {s.error && <p className="m-0 rounded-2xl p-4 text-[15px] font-bold" style={{ background: 'var(--alerta-bg)', color: 'var(--alerta-fg)' }}>No pudimos cargar los servicios. Revisa tu conexión e intenta de nuevo.</p>}

        {!s.cargando && !s.error && !a && (
          <div className="rounded-3xl p-6 text-center" style={{ background: 'var(--card)' }}>
            <p className="m-0 text-[17px] font-extrabold">Todavía no hay servicios programados</p>
            <p className="mt-1.5 mb-0 text-[15px]" style={{ color: 'var(--muted)' }}>{p.esLider ? 'Crea el primero con el botón Nuevo.' : 'Cuando el líder programe uno, aparecerá aquí.'}</p>
            {p.esLider && <button type="button" className="cta mt-4" onClick={() => setHojaServicio('nuevo')}>Crear servicio</button>}
          </div>
        )}

        {a && (
          <>
            <section className="rise head" style={{ animationDelay: '140ms' }}>
              <div className="flex items-start justify-between gap-2.5">
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="eyebrow">{a.tipo}</span>
                  <span className="text-[19px] font-extrabold">{fechaLarga(a.fecha)}</span>
                  <span className="text-sm" style={{ color: 'var(--muted)' }}>
                    {[hora(a.fecha), nombreDe(a.dirige) ? `Dirige ${nombreDe(a.dirige)}` : null, minutos ? `≈ ${minutos} min` : null].filter(Boolean).join(' · ')}
                  </span>
                  {a.llegada && <span className="text-sm" style={{ color: 'var(--muted)' }}>Llegada del equipo: {a.llegada}</span>}
                  {a.notas && <span className="mt-1 text-sm">{a.notas}</span>}
                </span>
                {p.esLider && <button type="button" className="iconbtn" style={{ width: 40, height: 40, borderRadius: 14 }} aria-label="Editar datos del servicio" onClick={() => setHojaServicio('editar')}><Icon name="editar" size={18} strokeWidth={2} /></button>}
              </div>
              <div className="pubrow">
                <Icon name="mundo" size={18} strokeWidth={2} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <span className="grow text-sm font-extrabold">{a.publicado ? 'Visible en la página pública' : 'Oculto del público'}</span>
                {p.esLider && <button type="button" role="switch" aria-checked={a.publicado} aria-label="Mostrar en la página pública" className={'sw' + (a.publicado ? ' on' : '')} onClick={publicar} />}
              </div>
            </section>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[15px] font-extrabold">Orden del culto</span>
                {p.verTurnos && <Link to="/turnos" className="flex min-h-8 items-center gap-1 text-sm font-extrabold no-underline">Ver equipo <Icon name="derecha" size={14} strokeWidth={2.4} /></Link>}
              </div>

              {s.cargandoItems && s.items.length === 0 && [0, 1, 2].map((i) => <div key={i} className="esqueleto" style={{ height: 62, background: 'var(--surface)', opacity: 0.7 }} />)}
              {!s.cargandoItems && s.items.length === 0 && (
                <p className="m-0 rounded-2xl p-4 text-center text-[15px]" style={{ background: 'var(--surface)', border: '1.5px dashed var(--line)', color: 'var(--muted)' }}>
                  {p.esLider ? 'El orden está vacío. Agrega canciones y partes del culto.' : 'El líder todavía no arma el orden de este servicio.'}
                </p>
              )}

              {s.items.map((it, i) => {
                const esCancion = it.tipo === 'cancion'
                const quien = esCancion ? nombreDe(it.dirige) : it.responsable
                const sub = esCancion
                  ? [it.momento, quien ? `Dirige ${quien}` : null].filter(Boolean).join(' · ')
                  : [it.momento ?? it.responsable, it.minutosEfectivos ? `${it.minutosEfectivos} min` : null].filter(Boolean).join(' · ')
                const aviso = esCancion && it.repetida !== null
                return (
                  <div key={it.id} className={'item' + (esCancion ? '' : ' part')}>
                    <span className="n">{i + 1}</span>
                    <span className="flex min-w-0 grow flex-col gap-px">
                      <span className="truncate text-[15px] font-extrabold">{it.titulo}</span>
                      {sub && <span className="truncate text-[13px]" style={{ color: 'var(--muted)' }}>{sub}</span>}
                      {aviso && (
                        <span className="warn"><Icon name="reloj" size={13} strokeWidth={2.4} />Se cantó hace {it.repetida} {it.repetida === 1 ? 'día' : 'días'}</span>
                      )}
                    </span>
                    {!editando && esCancion && it.tonoMostrado && <span className="key">{it.tonoMostrado}</span>}
                    {editando && (
                      <>
                        <button type="button" className="mv" aria-label={`Editar ${it.titulo}`} onClick={() => setItemEditado(it)}><Icon name="editar" size={16} strokeWidth={2.2} /></button>
                        <button type="button" className="mv" aria-label={`Subir ${it.titulo}`} disabled={i === 0} onClick={() => s.mover(it.id, -1)}><Icon name="arriba" size={16} strokeWidth={2.4} /></button>
                        <button type="button" className="mv" aria-label={`Bajar ${it.titulo}`} disabled={i === s.items.length - 1} onClick={() => s.mover(it.id, 1)}><Icon name="chevron" size={16} strokeWidth={2.4} /></button>
                        <button type="button" className="mv del" aria-label={`Quitar ${it.titulo}`} onClick={async () => { const ok = await s.quitarItem(it.id); toast(ok ? `Se quitó ${it.titulo}` : 'No se pudo quitar. Intenta de nuevo.') }}><Icon name="equis" size={16} strokeWidth={2.4} /></button>
                      </>
                    )}
                  </div>
                )
              })}

              {p.esLider && (
                <button type="button" className="add" onClick={abrirAgregar}>
                  <Icon name="mas" size={18} strokeWidth={2.4} />Agregar al orden
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <HojaServicio
        abierta={hojaServicio !== null}
        onCerrar={() => setHojaServicio(null)}
        inicial={hojaServicio === 'editar' ? a : null}
        equipo={equipo}
        onGuardar={async (d) => {
          const nuevo = hojaServicio === 'nuevo'
          const ok = nuevo ? (await s.crearServicio(d)) !== null : await s.actualizarServicio(a!.id, d)
          if (ok) toast(nuevo ? 'Servicio creado' : 'Cambios guardados')
          return ok
        }}
        onBorrar={hojaServicio === 'editar' ? async () => { const ok = await s.borrarServicio(a!.id); if (ok) toast('Servicio borrado'); return ok } : undefined}
      />
      <HojaAgregar
        abierta={agregar}
        onCerrar={() => setAgregar(false)}
        catalogo={s.catalogo}
        usadas={usadas}
        ultimaVez={s.ultimaVez}
        onCancion={async (id, titulo) => { const ok = await s.agregarCancion(id); toast(ok ? `${titulo} agregada` : 'No se pudo agregar. Intenta de nuevo.') }}
        onParte={async (t, r, m) => { const ok = await s.agregarParte(t, r, m); if (ok) toast(`${t} agregada`); return ok }}
      />
      <HojaItem item={itemEditado} onCerrar={() => setItemEditado(null)} equipo={equipo} onGuardar={async (id, patch) => { const ok = await s.editarItem(id, patch); if (ok) toast('Cambios guardados'); return ok }} />
    </div>
  )
}
