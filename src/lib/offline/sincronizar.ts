import { supabase } from '../supabase'
import {
  borrarAudios, guardarAudio, guardarTono, kvGuardar, kvLeer, leerAudio, leerTonos, listarAudios, reemplazarGrupo,
  type CancionLocal, type ItemLocal, type ServicioLocal, type TonoLocal,
} from './almacen'

const claveUltima = (g: string) => `ultimaSync:${g}`
const claveAudios = (g: string) => `audiosActivo:${g}`

export const ultimaSincronizacion = (g: string) => kvLeer<string>(claveUltima(g))
export const audiosActivos = async (g: string) => (await kvLeer<boolean>(claveAudios(g))) === true
export const fijarAudiosActivos = (g: string, v: boolean) => kvGuardar(claveAudios(g), v)

/** Corta una consulta que se queda colgada (señal mala): mejor fallar y usar la copia. */
export function conTiempo<T>(p: PromiseLike<T>, ms = 20_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('La conexión tardó demasiado')), ms)
    Promise.resolve(p).then((v) => { clearTimeout(t); resolve(v) }, (e) => { clearTimeout(t); reject(e) })
  })
}

export interface Resumen { canciones: number; servicios: number; cuando: string }

interface Opciones {
  grupoId: string
  miMiembroId: string | undefined
  /** roles con acceso al cancionero (músico, voz, líder). Los demás no bajan letras. */
  conCancionero: boolean
}

/** Sube los tonos que se cambiaron sin conexión. Los que fallan se quedan pendientes para la próxima vez. */
async function subirTonosPendientes(grupoId: string) {
  const pendientes = (await leerTonos(grupoId)).filter((t) => t.pendiente)
  for (const t of pendientes) {
    const { error } = await supabase.from('cancion_tonos').upsert({ cancion_id: t.cancion_id, miembro_id: t.miembro_id, tono: t.tono }, { onConflict: 'cancion_id,miembro_id' })
    if (!error) await guardarTono({ ...t, pendiente: false })
  }
}

/**
 * Baja el cancionero y los próximos servicios y los deja en el dispositivo.
 * Si algo falla se lanza el error y lo que ya estaba guardado queda intacto.
 */
export async function sincronizar(o: Opciones): Promise<Resumen> {
  const { grupoId, miMiembroId, conCancionero } = o
  await subirTonosPendientes(grupoId).catch(() => {})

  // Desde ayer: el culto del domingo sigue a la mano el lunes por la mañana
  const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString()

  const [c, s] = await conTiempo(Promise.all([
    conCancionero
      ? supabase.from('canciones').select('id, grupo_id, titulo, autor, tono_original, bpm, minutos, categoria, letra_chordpro, audio_ref_url, fase, publica, created_at, updated_at').eq('grupo_id', grupoId).order('titulo')
      : Promise.resolve({ data: [] as unknown[], error: null }),
    supabase.from('servicios').select('id, grupo_id, fecha, tipo, llegada').eq('grupo_id', grupoId).gte('fecha', desde).order('fecha').limit(12),
  ]))
  if (c.error) throw c.error
  if (s.error) throw s.error

  const servicios = (s.data ?? []) as Omit<ServicioLocal, 'items'>[]
  const ids = servicios.map((x) => x.id)
  const [it, to] = await conTiempo(Promise.all([
    ids.length
      ? supabase.from('servicio_items').select('id, servicio_id, orden, tipo, cancion_id, momento, dirige, tono, parte_titulo, responsable, minutos').in('servicio_id', ids).order('orden')
      : Promise.resolve({ data: [] as unknown[], error: null }),
    conCancionero && miMiembroId
      ? supabase.from('cancion_tonos').select('cancion_id, miembro_id, tono').eq('miembro_id', miMiembroId)
      : Promise.resolve({ data: [] as unknown[], error: null }),
  ]))
  if (it.error) throw it.error
  if (to.error) throw to.error

  const porServicio = new Map<string, ItemLocal[]>()
  for (const x of (it.data ?? []) as (ItemLocal & { servicio_id: string })[]) {
    const { servicio_id, ...item } = x
    porServicio.set(servicio_id, [...(porServicio.get(servicio_id) ?? []), item])
  }
  const cancionIds = new Set(((c.data ?? []) as CancionLocal[]).map((x) => x.id))
  const tonos: TonoLocal[] = ((to.data ?? []) as { cancion_id: string; miembro_id: string; tono: string }[])
    .filter((t) => cancionIds.has(t.cancion_id))
    .map((t) => ({ ...t, grupo_id: grupoId, pendiente: false }))

  await reemplazarGrupo(grupoId, {
    canciones: (c.data ?? []) as CancionLocal[],
    servicios: servicios.map((x) => ({ ...x, items: porServicio.get(x.id) ?? [] })),
    tonos,
  })

  const cuando = new Date().toISOString()
  await kvGuardar(claveUltima(grupoId), cuando)
  return { canciones: cancionIds.size, servicios: servicios.length, cuando }
}

// ---------- Audios guía (opcional: pesan más) ----------
export const MAX_AUDIO_MB = 25

export interface ResumenAudios { descargados: number; total: number; bytes: number; fallaron: number }

/**
 * Baja las guías de audio de las canciones del grupo que aún no están en el dispositivo y borra las que ya no existen.
 * `onProgreso` avisa cuántas van para poder mostrar una barra.
 */
export async function descargarAudios(grupoId: string, onProgreso?: (hechas: number, total: number) => void): Promise<ResumenAudios> {
  const { data: cs, error: e1 } = await conTiempo(supabase.from('canciones').select('id').eq('grupo_id', grupoId))
  if (e1) throw e1
  const ids = (cs ?? []).map((c) => c.id as string)
  const { data: gs, error: e2 } = ids.length
    ? await conTiempo(supabase.from('guias').select('id, cancion_id, parte, duracion_s, storage_path').in('cancion_id', ids))
    : { data: [], error: null }
  if (e2) throw e2

  const guias = (gs ?? []) as { id: string; cancion_id: string; parte: string; duracion_s: number | null; storage_path: string }[]
  const vigentes = new Set(guias.map((g) => g.storage_path))
  const locales = await listarAudios(grupoId)
  await borrarAudios(locales.filter((a) => !vigentes.has(a.path)).map((a) => a.path))

  const faltan = guias.filter((g) => !locales.some((a) => a.path === g.storage_path))
  let hechas = 0, fallaron = 0, bytes = locales.filter((a) => vigentes.has(a.path)).reduce((n, a) => n + a.bytes, 0)
  onProgreso?.(0, faltan.length)
  for (const g of faltan) {
    try {
      if (await leerAudio(g.storage_path)) { hechas++; continue }
      const { data: firmado, error } = await supabase.storage.from('guias').createSignedUrl(g.storage_path, 600)
      if (error || !firmado) throw error ?? new Error('sin enlace')
      const r = await conTiempo(fetch(firmado.signedUrl), 60_000)
      if (!r.ok) throw new Error(String(r.status))
      const blob = await r.blob()
      if (blob.size > MAX_AUDIO_MB * 1024 * 1024) throw new Error('muy pesado')
      await guardarAudio({ path: g.storage_path, guia_id: g.id, parte: g.parte, duracion_s: g.duracion_s, grupo_id: grupoId, cancion_id: g.cancion_id, blob, bytes: blob.size, guardado: new Date().toISOString() })
      bytes += blob.size
      hechas++
    } catch { fallaron++ }
    onProgreso?.(hechas + fallaron, faltan.length)
  }
  return { descargados: hechas, total: guias.length, bytes, fallaron }
}
