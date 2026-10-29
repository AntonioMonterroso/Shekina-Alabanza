import { leerCanciones, type CancionLocal } from '../../lib/offline/almacen'
import { conTiempo } from '../../lib/offline/sincronizar'
import type { CopiaCompleta } from '../../lib/exportar'
import { supabase } from '../../lib/supabase'

/** Todas las canciones del grupo con su letra. Sin conexión (o con señal mala) salen de la copia guardada en el teléfono. */
export async function cargarCanciones(grupoId: string): Promise<{ canciones: CancionLocal[]; desdeCopia: boolean }> {
  const nube = navigator.onLine
    ? await conTiempo(supabase.from('canciones').select('id, grupo_id, titulo, autor, tono_original, bpm, minutos, categoria, letra_chordpro, audio_ref_url, fase, publica, created_at, updated_at').eq('grupo_id', grupoId).order('titulo'), 15_000).catch(() => null)
    : null
  if (nube && !nube.error) return { canciones: (nube.data ?? []) as CancionLocal[], desdeCopia: false }
  return { canciones: (await leerCanciones(grupoId)).sort((a, b) => a.titulo.localeCompare(b.titulo, 'es')), desdeCopia: true }
}

/**
 * La copia completa del grupo: cancionero, servicios, turnos, ensayos, avisos y equipo básico.
 * No incluye la Escuela (es solo del propietario y tiene datos de menores), ni contraseñas, ni los archivos de audio (solo sus datos).
 * Si una tabla no se puede leer, se anota en `incompleto` y se sigue con las demás.
 */
export async function armarCopia(grupo: { id: string; nombre: string; slug: string }): Promise<CopiaCompleta> {
  const incompleto: string[] = []
  const leer = async (tabla: string, consulta: PromiseLike<{ data: unknown[] | null; error: unknown }>): Promise<Record<string, unknown>[]> => {
    try {
      const r = await conTiempo(consulta, 20_000)
      if (r.error) throw r.error
      return (r.data ?? []) as Record<string, unknown>[]
    } catch { incompleto.push(tabla); return [] }
  }
  const g = grupo.id
  const [canciones, servicios, puestos, ensayos, avisos, propuestas, miembros] = await Promise.all([
    leer('canciones', supabase.from('canciones').select('*').eq('grupo_id', g).order('titulo')),
    leer('servicios', supabase.from('servicios').select('*').eq('grupo_id', g).order('fecha')),
    leer('puestos', supabase.from('puestos').select('*').eq('grupo_id', g).order('orden')),
    leer('ensayos', supabase.from('ensayos').select('*').eq('grupo_id', g).order('fecha')),
    leer('avisos', supabase.from('avisos').select('*').eq('grupo_id', g).order('created_at')),
    leer('propuestas', supabase.from('propuestas').select('*').eq('grupo_id', g)),
    leer('equipo', supabase.from('miembros').select('id, user_id, rol, descripcion, puestos, activo').eq('grupo_id', g)),
  ])
  const ids = (l: Record<string, unknown>[]) => new Set(l.map((x) => x.id as string))
  const delGrupo = (l: Record<string, unknown>[], campo: string, vivos: Set<string>) => l.filter((x) => vivos.has(x[campo] as string))
  const cs = ids(canciones), ss = ids(servicios), es = ids(ensayos)

  const [pendientes, tonos, dominio, guias, items, turnos, ensayoCanciones, perfiles] = await Promise.all([
    leer('cancion_pendientes', supabase.from('cancion_pendientes').select('*')),
    leer('cancion_tonos', supabase.from('cancion_tonos').select('*')),
    leer('cancion_dominio', supabase.from('cancion_dominio').select('*')),
    leer('guias', supabase.from('guias').select('id, cancion_id, parte, duracion_s, storage_path')),
    leer('servicio_items', supabase.from('servicio_items').select('*')),
    leer('turnos', supabase.from('turnos').select('*')),
    leer('ensayo_canciones', supabase.from('ensayo_canciones').select('*')),
    leer('perfiles', supabase.from('perfiles').select('id, usuario, nombre')),
  ])

  return {
    version: 1,
    generado: new Date().toISOString(),
    grupo,
    incompleto,
    datos: {
      canciones,
      cancion_pendientes: delGrupo(pendientes, 'cancion_id', cs),
      cancion_tonos: delGrupo(tonos, 'cancion_id', cs),
      cancion_dominio: delGrupo(dominio, 'cancion_id', cs),
      guias: delGrupo(guias, 'cancion_id', cs),
      servicios,
      servicio_items: delGrupo(items, 'servicio_id', ss),
      puestos,
      turnos: delGrupo(turnos, 'servicio_id', ss),
      ensayos,
      ensayo_canciones: delGrupo(ensayoCanciones, 'ensayo_id', es),
      avisos,
      propuestas,
      equipo: miembros.map((m) => ({ ...m, perfil: perfiles.find((p) => p.id === m.user_id) ?? null })),
    },
  }
}

// ---------- Entregar el archivo ----------
/**
 * Pone el archivo en manos del usuario: en el teléfono abre "Compartir / Guardar en Archivos" si se puede,
 * y si no, lo descarga como cualquier archivo.
 */
export async function entregar(nombre: string, blob: Blob): Promise<void> {
  const archivo = new File([blob], nombre, { type: blob.type })
  if (navigator.canShare?.({ files: [archivo] })) {
    try { await navigator.share({ files: [archivo], title: nombre }); return } catch (e) {
      if ((e as DOMException).name === 'AbortError') return // cerró la hoja de compartir: no es un error
      // otro motivo (p. ej. el navegador exige un toque reciente): se descarga
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
