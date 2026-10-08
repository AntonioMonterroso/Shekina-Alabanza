import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'

export interface FilaServicio { servicio_id: string; fecha: string; tipo: string; orden: number; momento: string | null; titulo: string; autor: string | null; tono: string | null }
export interface ServicioPublico { id: string; fecha: string; tipo: string; canciones: FilaServicio[] }
export interface CancionPublica { cancion_id: string; titulo: string; autor: string | null; tono: string | null; categoria: 'alabanza' | 'adoracion' | null; votos: number }

const CLAVE_DEVICE = 'shekina.device'
const CLAVE_VOTOS = 'shekina.votos'

function leer(clave: string): string | null {
  try { return localStorage.getItem(clave) } catch { return null }
}
function guardar(clave: string, valor: string) {
  try { localStorage.setItem(clave, valor) } catch { /* modo privado: se sigue sin guardar */ }
}

/** UUID anónimo por dispositivo; si no hay localStorage, uno por sesión. */
let deviceMemoria: string | null = null
export function deviceId(): string {
  const guardado = leer(CLAVE_DEVICE)
  if (guardado) return guardado
  const nuevo = deviceMemoria ?? crypto.randomUUID()
  deviceMemoria = nuevo
  guardar(CLAVE_DEVICE, nuevo)
  return nuevo
}

function misVotosGuardados(slug: string): Set<string> {
  try { return new Set(JSON.parse(leer(`${CLAVE_VOTOS}.${slug}`) ?? '[]') as string[]) } catch { return new Set() }
}

const bonito = (slug: string) => slug.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')

export function usePublico(slug: string | undefined) {
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(false)
  const [nombre, setNombre] = useState(slug ? bonito(slug) : '')
  const [filas, setFilas] = useState<FilaServicio[]>([])
  const [repertorio, setRepertorio] = useState<CancionPublica[]>([])
  const [mios, setMios] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!slug) return
    let vivo = true
    setMios(misVotosGuardados(slug))
    void (async () => {
      const [s, r, g] = await Promise.all([
        supabase.from('v_publico_servicios').select('servicio_id, fecha, tipo, orden, momento, titulo, autor, tono').eq('slug', slug).order('fecha').order('orden'),
        supabase.from('v_publico_repertorio').select('cancion_id, titulo, autor, tono, categoria, votos').eq('slug', slug).order('titulo'),
        supabase.from('v_publico_grupo').select('nombre').eq('slug', slug).maybeSingle(),
      ])
      if (!vivo) return
      if (s.error || r.error) { setError(true); setCargando(false); return }
      setFilas((s.data ?? []) as FilaServicio[])
      setRepertorio(((r.data ?? []) as CancionPublica[]).map((c) => ({ ...c, votos: Number(c.votos) })))
      // la vista del nombre es opcional (migración 6): si falta se usa el slug
      if (!g.error && g.data?.nombre) setNombre(g.data.nombre as string)
      setCargando(false)
    })()
    return () => { vivo = false }
  }, [slug])

  const servicios = useMemo<ServicioPublico[]>(() => {
    const mapa = new Map<string, ServicioPublico>()
    for (const f of filas) {
      const s = mapa.get(f.servicio_id) ?? { id: f.servicio_id, fecha: f.fecha, tipo: f.tipo, canciones: [] }
      s.canciones.push(f)
      mapa.set(f.servicio_id, s)
    }
    return [...mapa.values()].sort((a, b) => a.fecha.localeCompare(b.fecha))
  }, [filas])

  const alternarVoto = useCallback(async (id: string): Promise<boolean> => {
    if (!slug) return false
    const tenia = mios.has(id)
    const aplicar = (suma: number) => {
      setRepertorio((l) => l.map((c) => (c.cancion_id === id ? { ...c, votos: Math.max(0, c.votos + suma) } : c)))
      setMios((m) => {
        const n = new Set(m)
        if (suma > 0) n.add(id); else n.delete(id)
        guardar(`${CLAVE_VOTOS}.${slug}`, JSON.stringify([...n]))
        return n
      })
    }
    aplicar(tenia ? -1 : 1)
    const { error: e } = tenia
      ? await supabase.rpc('quitar_voto', { p_cancion: id, p_device: deviceId() })
      : await supabase.rpc('votar_cancion', { p_cancion: id, p_device: deviceId() })
    if (e) { aplicar(tenia ? 1 : -1); return false }
    return true
  }, [slug, mios])

  const proponer = useCallback(async (titulo: string, autor: string, contacto: string): Promise<string | null> => {
    if (!slug) return 'Grupo no disponible'
    const { error: e } = await supabase.rpc('enviar_propuesta', { p_slug: slug, p_titulo: titulo, p_autor: autor, p_contacto: contacto, p_device: deviceId() })
    if (!e) return null
    return e.message.includes('varias propuestas') ? 'Ya enviaste varias sugerencias, intenta más tarde.' : 'No se pudo enviar. Intenta de nuevo.'
  }, [slug])

  return { cargando, error, nombre, servicios, repertorio, mios, alternarVoto, proponer }
}
