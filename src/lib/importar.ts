// Cargar varias canciones de una vez a partir de texto pegado.
// Separa las canciones, encuentra título / autor / tono y deja la letra en ChordPro, lista para revisar.
import { esAcorde, etiquetaDeSeccion, quitarAcordes, TONOS } from './chordpro.ts'
import { deAcordesArriba, esLineaDeAcordes } from './escritura.ts'

export const MAX_CANCIONES = 200
export const MAX_CARACTERES = 400_000

export interface Borrador {
  titulo: string
  autor: string | null
  tono: string | null
  /** el tono se adivinó por el primer acorde (conviene confirmarlo) */
  tonoEstimado: boolean
  /** pulsos por minuto, si venía escrito ({tempo: 72} o "BPM: 72") */
  bpm: number | null
  /** letra en ChordPro */
  letra: string
  conAcordes: boolean
}

/** Para comparar títulos: sin tildes, mayúsculas ni signos ("¡Cuán grande es Él!" = "cuan grande es el"). */
export const normalizarTitulo = (t: string) =>
  t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()

// ---------- 1) Separar las canciones ----------
const SEPARADOR = /^\s*(?:[-*_=~]{3,}|\{\s*(?:new_song|ns)\s*\})\s*$/i

/**
 * Si hay separadores explícitos (--- , *** , === o {new_song}) se usan.
 * Si no, una canción termina donde hay dos o más líneas en blanco seguidas.
 */
export function separarBloques(texto: string): string[] {
  const lineas = texto.replace(/\r/g, '').replace(/ /g, ' ').replace(/\t/g, '    ').split('\n')
  const explicito = lineas.some((l) => SEPARADOR.test(l))
  const bloques: string[][] = [[]]
  let vacias = 0
  for (const l of lineas) {
    const actual = bloques[bloques.length - 1]!
    if (explicito) {
      if (SEPARADOR.test(l)) bloques.push([])
      else actual.push(l)
      continue
    }
    if (l.trim() === '') { vacias++; actual.push(l); continue }
    if (vacias >= 2 && actual.some((x) => x.trim())) bloques.push([l])
    else actual.push(l)
    vacias = 0
  }
  return bloques.map((b) => b.join('\n').trim()).filter(Boolean)
}

// ---------- 2) Leer cada canción ----------
const EQUIVALENTE_TONO: Record<string, string> = {
  Gb: 'F#', 'D#': 'Eb', 'G#': 'Ab', 'A#': 'Bb', Cb: 'B', Fb: 'E', 'E#': 'F', 'B#': 'C',
  Ebm: 'D#m', Abm: 'G#m', Gbm: 'F#m', Dbm: 'C#m', 'A#m': 'Bbm', Cbm: 'Bm', Fbm: 'Em',
}

/** Lleva un tono ("Gb", "ebm") a uno de la lista de la app; null si no se reconoce. */
export function tonoValido(t: string | null | undefined): string | null {
  const m = t?.trim().match(/^([A-Ga-g])([#b]?)(m|min|menor)?$/)
  if (!m) return null
  const base = m[1]!.toUpperCase() + m[2] + (m[3] ? 'm' : '')
  const tono = EQUIVALENTE_TONO[base] ?? base
  return TONOS.includes(tono) ? tono : null
}

const RE_PRIMER_ACORDE = /\[([A-G][#b]?)(m(?!aj)|min)?[^\]]*\]/

/** El tono más probable: el primer acorde de la canción. */
export function tonoDelPrimerAcorde(chordpro: string): string | null {
  const m = chordpro.match(RE_PRIMER_ACORDE)
  return m ? tonoValido(m[1]! + (m[2] ? 'm' : '')) : null
}

const RE_TONO = /^(?:tono|tonalidad|key|clave)\s*(?:original|de la canción)?\s*[:=]\s*([A-Ga-g][#b]?(?:m|min|menor)?)\b/i
const RE_AUTOR = /^(?:autor|autora|artista|artist|compositor|compositora|letra y música|música|por|by)\s*[:=]\s*(.+)$/i
const RE_RUIDO = /^(?:capo|cejilla|traste|compás|compas|duración|duracion)\s*[:=]?\s*\d*\s*$/i
const RE_BPM = /^(?:bpm|tempo)\s*[:=]\s*(\d{2,3})\s*(?:bpm)?\s*$/i

/** Directivas de ChordPro que sí dan forma a la letra; el resto ({tempo}, {capo}, {year}…) son datos y no van en la letra. */
const ESTRUCTURA = /^(?:c|comment|ci|comment_italic|cb|comment_box|start_of_\w+|end_of_\w+|so[cvb]|eo[cvb]|chorus|verse)$/

const limpiarTitulo = (t: string) => t.replace(/^[\s*#_~\-–—]+|[\s*#_~\-–—:]+$/g, '').replace(/^\d{1,3}\s*[.)\-–]\s+/, '').replace(/^["“'«]+|["”'»]+$/g, '').trim()

/** ¿Esta línea parece un título (y no parte de la letra)? */
function pareceTitulo(l: string): boolean {
  const t = l.trim()
  if (!t || t.length > 80) return false
  if (esLineaDeAcordes(t) || etiquetaDeSeccion(t)) return false
  if (t.startsWith('[') || /\[[A-G][^\]]*\]/.test(t)) return false // ChordPro
  if (/[.;,]$/.test(t) && t.split(/\s+/).length > 6) return false
  return true
}

function bpmValido(v: string | undefined): number | null {
  const n = Number(v)
  return Number.isInteger(n) && n >= 20 && n <= 300 ? n : null
}

/** Convierte un bloque de texto (una canción) en un borrador. */
export function leerBloque(bloque: string): Borrador {
  let titulo = ''
  let autor: string | null = null
  let tonoDicho: string | null = null
  let bpm: number | null = null
  const cuerpo: string[] = []

  for (const crudo of bloque.split('\n')) {
    const l = crudo.trim()
    const d = l.match(/^\{\s*([a-z_]+)\s*:\s*(.*?)\s*\}$/i)
    if (d) {
      const k = d[1]!.toLowerCase(), v = d[2]!
      if (k === 'title' || k === 't') titulo = v
      else if (['subtitle', 'st', 'artist', 'composer', 'lyricist', 'author'].includes(k)) autor = autor ?? (v || null)
      else if (k === 'key') tonoDicho = v
      else if (k === 'tempo' || k === 'bpm') bpm = bpmValido(v)
      else if (ESTRUCTURA.test(k)) cuerpo.push(crudo) // {comment: …}, {start_of_chorus}… los entiende el lector de letras
      // lo demás son datos de la canción: no van en la letra
      continue
    }
    const tono = l.match(RE_TONO)
    if (tono) { tonoDicho = tonoDicho ?? tono[1]!; continue }
    const aut = l.match(RE_AUTOR)
    if (aut && !esLineaDeAcordes(l)) { autor = autor ?? aut[1]!.trim(); continue }
    const pulso = l.match(RE_BPM)
    if (pulso) { bpm = bpm ?? bpmValido(pulso[1]!); continue }
    if (RE_RUIDO.test(l)) continue
    cuerpo.push(crudo)
  }

  // El título: la primera línea, si lo parece
  if (!titulo) {
    const i = cuerpo.findIndex((x) => x.trim() !== '')
    if (i >= 0 && pareceTitulo(cuerpo[i]!) && cuerpo.slice(i + 1).some((x) => x.trim())) {
      let t = cuerpo[i]!.trim()
      cuerpo.splice(i, 1)
      // "Título - Autor", "Título (Autor)"
      const partido = t.match(/^(.+?)\s+[-–—]\s+(.+)$/) ?? t.match(/^(.+?)\s*\(([^()]{3,40})\)$/)
      if (partido) { t = partido[1]!; autor = autor ?? partido[2]!.trim() }
      titulo = limpiarTitulo(t)
    }
  }

  const letra = deAcordesArriba(cuerpo.join('\n'))
  const conAcordes = quitarAcordes(letra) !== letra
  const dicho = tonoValido(tonoDicho)
  const estimado = !dicho && conAcordes ? tonoDelPrimerAcorde(letra) : null
  return { titulo: limpiarTitulo(titulo), autor: autor ? autor.slice(0, 120) : null, tono: dicho ?? estimado, tonoEstimado: !dicho && estimado !== null, bpm, letra, conAcordes }
}

/** Todo el proceso: texto pegado → borradores (sin las "canciones" sin letra). */
export function separarCanciones(texto: string): Borrador[] {
  return separarBloques(texto).map(leerBloque).filter((b) => b.letra.replace(/\s/g, '').length >= 8)
}

// ---------- 3) Duplicadas ----------
export type Estado = 'ok' | 'existe' | 'repetida' | 'sin-titulo'

/** Para cada fila: ¿se puede guardar? ("existe" = ya está en el cancionero; "repetida" = ya viene antes en este mismo texto). */
export function estados(titulos: string[], existentes: string[]): Estado[] {
  const ya = new Set(existentes.map(normalizarTitulo))
  const vistos = new Set<string>()
  return titulos.map((t) => {
    const n = normalizarTitulo(t)
    if (!n) return 'sin-titulo'
    if (ya.has(n)) return 'existe'
    if (vistos.has(n)) return 'repetida'
    vistos.add(n)
    return 'ok'
  })
}

export { esAcorde }
