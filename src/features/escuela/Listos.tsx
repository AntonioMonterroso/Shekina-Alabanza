import { useCallback, useEffect, useState } from 'react'
import { useToast } from '../../components/Toast'
import { useAuth } from '../../hooks/authContext'
import { useEquipo } from '../../hooks/useEquipo'
import { relativo } from '../../lib/tiempo'
import { iniciales } from '../../lib/fechas'
import { permisos } from '../../lib/permisos'
import { cargarPuestos, cargarRecomendados, pasarAlEquipo, quitarRecomendacion, type RolEquipo } from './api'
import HojaPasar from './HojaPasar'

/** Alumnos que sus maestros recomendaron para el equipo. Un líder los pasa; la coordinación los ve. */
export default function Listos() {
  const { membresia, rol } = useAuth()
  const esLider = permisos(rol).esLider
  const toast = useToast()
  const [version, setVersion] = useState(0)
  const equipo = useEquipo(membresia?.grupo_id, version)
  const [lista, setLista] = useState<{ miembro_id: string; nota: string | null; fecha: string }[] | null>(null)
  const [puestos, setPuestos] = useState<string[]>([])
  const [pasando, setPasando] = useState<string | null>(null)

  const cargar = useCallback(async () => setLista(await cargarRecomendados()), [])
  useEffect(() => { void cargar() }, [cargar])
  useEffect(() => { if (membresia) void cargarPuestos(membresia.grupo_id).then(setPuestos) }, [membresia])

  // Solo los que todavía son alumnos (los ya pasados dejan de aparecer)
  const visibles = (lista ?? []).filter((x) => equipo.find((m) => m.id === x.miembro_id)?.rol === 'alumno')
  const nombre = (id: string) => equipo.find((m) => m.id === id)?.nombre ?? '—'

  async function pasar(id: string, r: RolEquipo, p: string[]) {
    const fallo = await pasarAlEquipo(id, r, p)
    if (!fallo) { toast(`${nombre(id).split(' ')[0]} ya es parte del equipo`); setVersion((v) => v + 1); await cargar() }
    return fallo
  }
  async function descartar(id: string) {
    if (await quitarRecomendacion(id)) await cargar(); else toast('No se pudo quitar. Intenta de nuevo.')
  }

  if (lista === null) return <div className="esqueleto h-24" />
  if (visibles.length === 0) return <p className="m-0 rounded-2xl p-4 text-base" style={{ background: 'var(--soft)', color: 'var(--muted)' }}>Nadie recomendado por ahora. Cuando un maestro vea a un alumno listo para tocar con el grupo, aparecerá aquí.</p>

  return (
    <>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {visibles.map((x) => (
          <li key={x.miembro_id} className="flex flex-col gap-2 rounded-3xl border-[1.5px] p-3.5" style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}>
            <div className="flex items-center gap-3">
              <span className="av shrink-0" style={{ background: 'var(--c-verde-bg)', color: 'var(--c-verde-fg)' }}>{iniciales(nombre(x.miembro_id))}</span>
              <span className="flex min-w-0 grow flex-col"><span className="truncate text-base font-extrabold">{nombre(x.miembro_id)}</span><span className="text-[13px]" style={{ color: 'var(--muted)' }}>Recomendado {relativo(x.fecha)}</span></span>
            </div>
            {x.nota && <p className="m-0 rounded-xl px-3 py-2 text-[15px]" style={{ background: 'var(--soft)' }}>{x.nota}</p>}
            <div className="flex gap-2">
              {esLider ? <button type="button" className="cbtn yes" onClick={() => setPasando(x.miembro_id)}>Pasar al equipo</button> : <span className="grow text-[13px]" style={{ color: 'var(--muted)' }}>Un líder lo pasa al equipo.</span>}
              <button type="button" className="undo" onClick={() => descartar(x.miembro_id)}>Quitar</button>
            </div>
          </li>
        ))}
      </ul>
      <HojaPasar alumno={pasando ? { id: pasando, nombre: nombre(pasando) } : null} puestos={puestos} onCerrar={() => setPasando(null)} onPasar={pasar} />
    </>
  )
}
