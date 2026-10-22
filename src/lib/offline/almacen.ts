// Copia local del cancionero y del próximo servicio, en IndexedDB (más espacio y más fiable que localStorage).
// Sirve para ver y cantar sin internet. Todo lo que se guarda aquí también existe en Supabase: esto es solo una copia.

export interface CancionLocal {
  id: string
  grupo_id: string
  titulo: string
  autor: string | null
  tono_original: string | null
  bpm: number | null
  minutos: number | null
  categoria: 'alabanza' | 'adoracion' | null
  letra_chordpro: string | null
  audio_ref_url: string | null
  fase: 'nueva' | 'aprendiendo' | 'ensayada' | 'lista'
  publica: boolean
  created_at: string
  updated_at: string
}

export interface ItemLocal {
  id: string
  orden: number
  tipo: 'cancion' | 'parte'
  cancion_id: string | null
  momento: string | null
  dirige: string | null
  tono: string | null
  parte_titulo: string | null
  responsable: string | null
  minutos: number | null
}

export interface ServicioLocal {
  id: string
  grupo_id: string
  fecha: string
  tipo: string
  llegada: string | null
  items: ItemLocal[]
}

/** Mi tono para una canción. `pendiente` = se cambió sin conexión y falta subirlo. */
export interface TonoLocal {
  cancion_id: string
  miembro_id: string
  grupo_id: string
  tono: string
  pendiente: boolean
}

export interface AudioLocal {
  /** ruta en el bucket 'guias' */
  path: string
  guia_id: string
  parte: string
  duracion_s: number | null
  grupo_id: string
  cancion_id: string
  blob: Blob
  bytes: number
  guardado: string
}

const NOMBRE = 'shekina-offline'
const VERSION = 1
const TIENDAS = ['kv', 'canciones', 'servicios', 'tonos', 'audios'] as const
type Tienda = (typeof TIENDAS)[number]

let abierta: Promise<IDBDatabase> | null = null

function abrir(): Promise<IDBDatabase> {
  if (abierta) return abierta
  abierta = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('Este navegador no guarda datos sin conexión'))
    const req = indexedDB.open(NOMBRE, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      db.createObjectStore('kv')
      db.createObjectStore('canciones', { keyPath: 'id' }).createIndex('grupo', 'grupo_id')
      db.createObjectStore('servicios', { keyPath: 'id' }).createIndex('grupo', 'grupo_id')
      db.createObjectStore('tonos', { keyPath: ['cancion_id', 'miembro_id'] }).createIndex('grupo', 'grupo_id')
      db.createObjectStore('audios', { keyPath: 'path' }).createIndex('grupo', 'grupo_id')
    }
    req.onsuccess = () => {
      const db = req.result
      db.onversionchange = () => { db.close(); abierta = null }
      resolve(db)
    }
    req.onerror = () => { abierta = null; reject(req.error ?? new Error('No se pudo abrir el almacén')) }
  })
  return abierta
}

const pedir = <T>(r: IDBRequest<T>) => new Promise<T>((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
const fin = (t: IDBTransaction) => new Promise<void>((res, rej) => { t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error) })

async function tx(tiendas: Tienda[], modo: IDBTransactionMode) {
  const db = await abrir()
  return db.transaction(tiendas, modo)
}

// ---------- kv ----------
export async function kvLeer<T>(clave: string): Promise<T | undefined> {
  try { return await pedir((await tx(['kv'], 'readonly')).objectStore('kv').get(clave)) as T | undefined } catch { return undefined }
}
export async function kvGuardar(clave: string, valor: unknown): Promise<void> {
  const t = await tx(['kv'], 'readwrite')
  t.objectStore('kv').put(valor, clave)
  await fin(t)
}

// ---------- lectura ----------
export async function leerCanciones(grupoId: string): Promise<CancionLocal[]> {
  try { return await pedir((await tx(['canciones'], 'readonly')).objectStore('canciones').index('grupo').getAll(grupoId)) } catch { return [] }
}
export async function leerCancion(id: string): Promise<CancionLocal | undefined> {
  try { return await pedir((await tx(['canciones'], 'readonly')).objectStore('canciones').get(id)) } catch { return undefined }
}
export async function leerServicios(grupoId: string): Promise<ServicioLocal[]> {
  try {
    const l = await pedir((await tx(['servicios'], 'readonly')).objectStore('servicios').index('grupo').getAll(grupoId))
    return l.sort((a, b) => a.fecha.localeCompare(b.fecha))
  } catch { return [] }
}
export async function leerTonos(grupoId: string): Promise<TonoLocal[]> {
  try { return await pedir((await tx(['tonos'], 'readonly')).objectStore('tonos').index('grupo').getAll(grupoId)) } catch { return [] }
}

// ---------- escritura ----------
/** Reemplaza lo guardado de un grupo por lo que acaba de bajar (así desaparece lo que se borró en la nube). */
export async function reemplazarGrupo(grupoId: string, d: { canciones: CancionLocal[]; servicios: ServicioLocal[]; tonos: TonoLocal[] }): Promise<void> {
  const t = await tx(['canciones', 'servicios', 'tonos'], 'readwrite')
  for (const nombre of ['canciones', 'servicios', 'tonos'] as const) {
    const tienda = t.objectStore(nombre)
    // Los tonos con cambios sin subir se conservan: son del usuario y aún no llegaron a la nube
    const claves = await pedir(tienda.index('grupo').getAllKeys(grupoId))
    for (const k of claves) {
      if (nombre === 'tonos') {
        const previo = (await pedir(tienda.get(k))) as TonoLocal | undefined
        if (previo?.pendiente) continue
      }
      tienda.delete(k)
    }
  }
  for (const c of d.canciones) t.objectStore('canciones').put(c)
  for (const s of d.servicios) t.objectStore('servicios').put(s)
  for (const o of d.tonos) {
    const actual = (await pedir(t.objectStore('tonos').get([o.cancion_id, o.miembro_id]))) as TonoLocal | undefined
    if (!actual?.pendiente) t.objectStore('tonos').put(o)
  }
  await fin(t)
}

export async function guardarTono(o: TonoLocal): Promise<void> {
  const t = await tx(['tonos'], 'readwrite')
  t.objectStore('tonos').put(o)
  await fin(t)
}

// ---------- audios ----------
export async function guardarAudio(a: AudioLocal): Promise<void> {
  const t = await tx(['audios'], 'readwrite')
  t.objectStore('audios').put(a)
  await fin(t)
}
export async function leerAudio(path: string): Promise<AudioLocal | undefined> {
  try { return await pedir((await tx(['audios'], 'readonly')).objectStore('audios').get(path)) } catch { return undefined }
}
/** Los audios guardados de unas canciones (para listar las guías sin conexión). */
export async function leerAudiosDeCanciones(cancionIds: string[]): Promise<AudioLocal[]> {
  try {
    const todos = await pedir((await tx(['audios'], 'readonly')).objectStore('audios').getAll())
    const ids = new Set(cancionIds)
    return todos.filter((a) => ids.has(a.cancion_id)).sort((a, b) => a.parte.localeCompare(b.parte, 'es'))
  } catch { return [] }
}
export async function listarAudios(grupoId: string): Promise<AudioLocal[]> {
  try { return await pedir((await tx(['audios'], 'readonly')).objectStore('audios').index('grupo').getAll(grupoId)) } catch { return [] }
}
export async function borrarAudios(paths: string[]): Promise<void> {
  if (paths.length === 0) return
  const t = await tx(['audios'], 'readwrite')
  for (const p of paths) t.objectStore('audios').delete(p)
  await fin(t)
}

/** Cuánto hay guardado de un grupo, para mostrarlo al usuario. */
export async function resumenLocal(grupoId: string) {
  const [c, s, a] = await Promise.all([leerCanciones(grupoId), leerServicios(grupoId), listarAudios(grupoId)])
  return { canciones: c.length, servicios: s.length, audios: a.length, bytesAudios: a.reduce((n, x) => n + x.bytes, 0) }
}

/** Borra todo lo guardado en este dispositivo (al cerrar sesión). */
export async function borrarTodo(): Promise<void> {
  try {
    const t = await tx([...TIENDAS], 'readwrite')
    for (const n of TIENDAS) t.objectStore(n).clear()
    await fin(t)
  } catch { /* nada que borrar */ }
}

/** Para pruebas: cierra y olvida la conexión. */
export function _reiniciar() { abierta = null }
