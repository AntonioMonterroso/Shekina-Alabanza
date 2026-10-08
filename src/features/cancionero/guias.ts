import { supabase } from '../../lib/supabase'

export interface Guia { id: string; cancion_id: string; parte: string; storage_path: string; duracion_s: number | null }

export const MAX_MB = 25
export const PARTES_GUIA = ['Guía completa', 'Voz 1', 'Voz 2', 'Voz 3', 'Piano', 'Guitarra', 'Bajo', 'Batería']

export async function listarGuias(cancionIds: string[]): Promise<Guia[]> {
  if (cancionIds.length === 0) return []
  const { data } = await supabase.from('guias').select('id, cancion_id, parte, storage_path, duracion_s').in('cancion_id', cancionIds).order('parte')
  return (data ?? []) as Guia[]
}

/** Enlace temporal (1 hora) para reproducir un audio del bucket privado. */
export async function urlDeGuia(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('guias').createSignedUrl(path, 3600)
  return error ? null : data.signedUrl
}

/** Duración del audio en segundos, leyéndola del propio archivo (null si el navegador no la entrega). */
function duracionDe(archivo: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(archivo)
    const a = new Audio()
    const fin = (v: number | null) => { URL.revokeObjectURL(url); resolve(v) }
    const t = setTimeout(() => fin(null), 4000)
    a.preload = 'metadata'
    a.onloadedmetadata = () => { clearTimeout(t); fin(Number.isFinite(a.duration) ? Math.round(a.duration) : null) }
    a.onerror = () => { clearTimeout(t); fin(null) }
    a.src = url
  })
}

/** Valida el archivo antes de subirlo. Devuelve un mensaje si no sirve. */
export function validarAudio(archivo: File): string | null {
  if (!archivo.type.startsWith('audio/')) return 'Elige un archivo de audio (mp3, m4a, wav…).'
  if (archivo.size > MAX_MB * 1024 * 1024) return `El audio pesa más de ${MAX_MB} MB. Comprímelo o recórtalo.`
  return null
}

/** Sube el audio a {grupo}/{canción}/{id}.{ext} y crea su registro. Devuelve un mensaje de error o null. */
export async function subirGuia(grupoId: string, cancionId: string, parte: string, archivo: File): Promise<string | null> {
  const mal = validarAudio(archivo)
  if (mal) return mal
  const ext = (archivo.name.split('.').pop() ?? 'mp3').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'mp3'
  const path = `${grupoId}/${cancionId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('guias').upload(path, archivo, { contentType: archivo.type, upsert: false })
  if (error) return 'No se pudo subir el audio. Intenta de nuevo.'
  const duracion_s = await duracionDe(archivo)
  const { error: e2 } = await supabase.from('guias').insert({ cancion_id: cancionId, parte: parte.trim().slice(0, 40) || 'Guía', storage_path: path, duracion_s })
  if (e2) {
    await supabase.storage.from('guias').remove([path]) // no deja archivos huérfanos
    return 'No se pudo guardar la guía. Intenta de nuevo.'
  }
  return null
}

export async function borrarGuia(g: Guia): Promise<boolean> {
  const { error } = await supabase.from('guias').delete().eq('id', g.id)
  if (error) return false
  await supabase.storage.from('guias').remove([g.storage_path])
  return true
}

export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
