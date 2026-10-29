// Sacar el cancionero de la app: archivos ChordPro (en un ZIP), texto plano y una copia completa en JSON.
// Todo se arma en el teléfono o la computadora; no se manda nada a ningún servidor.
import { parse, quitarAcordes } from './chordpro.ts'

export interface CancionExportable {
  titulo: string
  autor: string | null
  tono_original: string | null
  bpm: number | null
  letra_chordpro: string | null
}

// ---------- Nombres de archivo ----------
/** Un título hecho nombre de archivo válido en cualquier sistema ("¿Quién?" → "Quién"). */
export function nombreSeguro(titulo: string): string {
  const n = [...titulo.replace(/[\\/:*?"<>|]/g, '')].filter((ch) => ch.charCodeAt(0) >= 32).join('').replace(/\s+/g, ' ').replace(/^[.\s]+|[.\s]+$/g, '').slice(0, 80)
  return n || 'Sin título'
}

/** Nombres únicos: si dos canciones se llaman igual, la segunda queda "Título (2)". */
export function nombresUnicos(titulos: string[], extension: string): string[] {
  const usados = new Map<string, number>()
  return titulos.map((t) => {
    const base = nombreSeguro(t)
    const clave = base.toLowerCase()
    const n = (usados.get(clave) ?? 0) + 1
    usados.set(clave, n)
    return `${n > 1 ? `${base} (${n})` : base}.${extension}`
  })
}

// ---------- Formatos de una canción ----------
/** Una canción en ChordPro: encabezado con título, autor, tono y tempo, y la letra. Se puede volver a cargar en la app. */
export function aChordPro(c: CancionExportable): string {
  const cab = [`{title: ${c.titulo}}`]
  if (c.autor) cab.push(`{artist: ${c.autor}}`)
  if (c.tono_original) cab.push(`{key: ${c.tono_original}}`)
  if (c.bpm) cab.push(`{tempo: ${c.bpm}}`)
  return `${cab.join('\n')}\n\n${(c.letra_chordpro ?? '').trim()}\n`
}

/** Solo la letra, sin acordes, con las partes escritas como "Coro:". */
export function aTexto(c: CancionExportable): string {
  const encabezado = [c.titulo, [c.autor, c.tono_original ? `Tono ${c.tono_original}` : null].filter(Boolean).join(' · ')].filter(Boolean).join('\n')
  const cuerpo = parse(quitarAcordes(c.letra_chordpro ?? ''))
    .map((s) => [s.etiqueta ? `${s.etiqueta}:` : null, ...s.lineas.map((l) => l.map((g) => g.texto).join('').trimEnd())].filter((x) => x !== null).join('\n'))
    .join('\n\n')
  return `${encabezado}\n\n${cuerpo}\n`
}

/** Todas las letras en un solo texto, separadas por una línea. */
export function todoEnUnTexto(canciones: CancionExportable[]): string {
  return canciones.map(aTexto).join(`\n${'-'.repeat(32)}\n\n`)
}

// ---------- ZIP (sin compresión, sin librerías) ----------
const TABLA_CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(datos: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < datos.length; i++) c = TABLA_CRC[(c ^ datos[i]!) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

export interface ArchivoZip { nombre: string; contenido: string | Uint8Array }

/** Un ZIP válido (los nombres van en UTF-8, así que las tildes y la ñ se ven bien al abrirlo). */
export function crearZip(archivos: ArchivoZip[], fecha = new Date()): Uint8Array {
  const enc = new TextEncoder()
  const hora = (fecha.getHours() << 11) | (fecha.getMinutes() << 5) | (fecha.getSeconds() >> 1)
  const dia = ((Math.max(fecha.getFullYear(), 1980) - 1980) << 9) | ((fecha.getMonth() + 1) << 5) | fecha.getDate()

  const partes: Uint8Array[] = []
  const central: Uint8Array[] = []
  let posicion = 0

  for (const a of archivos) {
    const nombre = enc.encode(a.nombre)
    const datos = typeof a.contenido === 'string' ? enc.encode(a.contenido) : a.contenido
    const crc = crc32(datos)

    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true)
    local.setUint16(6, 0x0800, true) // nombres en UTF-8
    local.setUint16(8, 0, true) // sin compresión
    local.setUint16(10, hora, true)
    local.setUint16(12, dia, true)
    local.setUint32(14, crc, true)
    local.setUint32(18, datos.length, true)
    local.setUint32(22, datos.length, true)
    local.setUint16(26, nombre.length, true)
    local.setUint16(28, 0, true)
    partes.push(new Uint8Array(local.buffer), nombre, datos)

    const c = new DataView(new ArrayBuffer(46))
    c.setUint32(0, 0x02014b50, true)
    c.setUint16(4, 20, true)
    c.setUint16(6, 20, true)
    c.setUint16(8, 0x0800, true)
    c.setUint16(10, 0, true)
    c.setUint16(12, hora, true)
    c.setUint16(14, dia, true)
    c.setUint32(16, crc, true)
    c.setUint32(20, datos.length, true)
    c.setUint32(24, datos.length, true)
    c.setUint16(28, nombre.length, true)
    c.setUint32(42, posicion, true)
    central.push(new Uint8Array(c.buffer), nombre)

    posicion += 30 + nombre.length + datos.length
  }

  const tamCentral = central.reduce((n, p) => n + p.length, 0)
  const fin = new DataView(new ArrayBuffer(22))
  fin.setUint32(0, 0x06054b50, true)
  fin.setUint16(8, archivos.length, true)
  fin.setUint16(10, archivos.length, true)
  fin.setUint32(12, tamCentral, true)
  fin.setUint32(16, posicion, true)

  const todo = [...partes, ...central, new Uint8Array(fin.buffer)]
  const salida = new Uint8Array(todo.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of todo) { salida.set(p, o); o += p.length }
  return salida
}

/** El ZIP del cancionero: un .pro por canción (más un LÉEME corto). */
export function zipDeChordPro(canciones: CancionExportable[], fecha = new Date()): Uint8Array {
  const nombres = nombresUnicos(canciones.map((c) => c.titulo), 'pro')
  const leeme = `Cancionero exportado de Shekina Alabanza el ${fecha.toISOString().slice(0, 10)}.\n${canciones.length} canciones en formato ChordPro (.pro): letra con los acordes entre [corchetes].\nSe pueden volver a cargar en la app (Cancionero → Cargar varias canciones) o abrir en otros programas.\n`
  return crearZip([{ nombre: 'LEEME.txt', contenido: leeme }, ...canciones.map((c, i) => ({ nombre: nombres[i]!, contenido: aChordPro(c) }))], fecha)
}

// ---------- Copia completa ----------
export interface CopiaCompleta {
  version: 1
  generado: string
  grupo: { id: string; nombre: string; slug: string }
  /** tablas que no se pudieron leer (p. ej. sin permiso o sin conexión) */
  incompleto: string[]
  datos: Record<string, unknown[]>
}

export const nombreDeCopia = (tipo: string, ext: string, fecha = new Date()) => `shekina-${tipo}-${fecha.toISOString().slice(0, 10)}.${ext}`
export const jsonDeCopia = (c: CopiaCompleta) => JSON.stringify(c, null, 2)
