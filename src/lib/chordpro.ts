// ChordPro: "[D]Abre las [G]puertas". Todo corre en el cliente. Salida en notación americana (C D E…).

export interface Segmento { acorde: string | null; texto: string }
export type Linea = Segmento[]
export type TipoSeccion = 'verso' | 'coro' | 'puente' | 'otro'
export interface Seccion { etiqueta: string | null; tipo: TipoSeccion; lineas: Linea[] }

// Gramática de acordes: raíz, calidad, extensiones y bajo (G/B). Lo que no encaje es una etiqueta ([Coro]) o texto.
export const RE_ACORDE = /^[A-G][#b]?(?:maj|min|dim|aug|sus|add|m|M)?\d*(?:(?:sus|add|b|#)?\d+)*(?:\/[A-G][#b]?)?$/
const RE_ACORDE_EN_TEXTO = /\[([A-G][#b]?(?:maj|min|dim|aug|sus|add|m|M)?\d*(?:(?:sus|add|b|#)?\d+)*(?:\/[A-G][#b]?)?)\]/g

export const esAcorde = (s: string) => RE_ACORDE.test(s)

const RE_SECCION = /^[[(]?\s*(intro|verso|estrofa|pre-?\s?coro|precoro|coro|estribillo|puente|interludio|instrumental|final|outro)\s*(\d+)?\s*[\])]?\s*:?\s*$/i

/** "CORO:" → "Coro", "verso 2" → "Verso 2", "[Pre-coro]" → "Pre-coro". Null si la línea no es el nombre de una parte. */
export function etiquetaDeSeccion(linea: string): string | null {
  const m = linea.trim().match(RE_SECCION)
  if (!m) return null
  const nombre = m[1]!.toLowerCase().replace(/\s/g, '').replace(/^pre-?coro$/, 'pre-coro').replace(/^precoro$/, 'pre-coro')
  return nombre.charAt(0).toUpperCase() + nombre.slice(1) + (m[2] ? ` ${m[2]}` : '')
}

// ---------- Lectura ----------
export function parseLinea(texto: string): Linea {
  const out: Linea = []
  let texto_ = ''
  let acorde: string | null = null
  let ultimo = 0
  const re = new RegExp(RE_ACORDE_EN_TEXTO.source, 'g')
  for (const m of texto.matchAll(re)) {
    const antes = texto.slice(ultimo, m.index)
    if (acorde !== null || antes || texto_) out.push({ acorde, texto: texto_ + antes })
    texto_ = ''
    acorde = m[1]!
    ultimo = m.index! + m[0].length
  }
  const resto = texto.slice(ultimo)
  if (acorde !== null || resto || out.length === 0) out.push({ acorde, texto: resto })
  return out
}

const tipoDeEtiqueta = (e: string): TipoSeccion => {
  const x = e.toLowerCase()
  if (/coro|estribillo|chorus/.test(x)) return 'coro'
  if (/puente|bridge/.test(x)) return 'puente'
  if (/verso|estrofa|verse/.test(x)) return 'verso'
  return 'otro'
}

const DIRECTIVAS_ABRIR: Record<string, [TipoSeccion, string]> = {
  start_of_chorus: ['coro', 'Coro'], soc: ['coro', 'Coro'],
  start_of_verse: ['verso', 'Verso'], sov: ['verso', 'Verso'],
  start_of_bridge: ['puente', 'Puente'], sob: ['puente', 'Puente'],
}
const DIRECTIVAS_CERRAR = new Set(['end_of_chorus', 'eoc', 'end_of_verse', 'eov', 'end_of_bridge', 'eob'])

export function parse(texto: string): Seccion[] {
  const secciones: Seccion[] = []
  let actual: Seccion | null = null
  const abrir = (etiqueta: string | null, tipo: TipoSeccion) => {
    actual = { etiqueta, tipo, lineas: [] }
    secciones.push(actual)
  }

  for (const cruda of texto.replace(/\r/g, '').split('\n')) {
    const linea = cruda.trimEnd()
    const t = linea.trim()

    if (t === '') { actual = null; continue }

    const dir = t.match(/^\{\s*([a-z_]+)\s*(?::\s*(.*?))?\s*\}$/i)
    if (dir) {
      const nombre = dir[1]!.toLowerCase()
      const valor = dir[2]?.trim()
      if (DIRECTIVAS_ABRIR[nombre]) {
        const [tipo, etiqueta] = DIRECTIVAS_ABRIR[nombre]
        abrir(valor || etiqueta, tipo)
      } else if (DIRECTIVAS_CERRAR.has(nombre)) {
        actual = null
      } else if ((nombre === 'comment' || nombre === 'c' || nombre === 'comment_italic' || nombre === 'ci') && valor) {
        abrir(valor, tipoDeEtiqueta(valor))
      } // title, key, tempo, etc.: metadatos, no se muestran en la letra
      continue
    }

    const parte = etiquetaDeSeccion(t)
    if (parte) {
      abrir(parte, tipoDeEtiqueta(parte))
      continue
    }

    const etiqueta = t.match(/^\[([^\]]+)\]$/)
    if (etiqueta && !esAcorde(etiqueta[1]!)) {
      abrir(etiqueta[1]!, tipoDeEtiqueta(etiqueta[1]!))
      continue
    }

    if (!actual) abrir(null, 'verso')
    actual!.lineas.push(parseLinea(linea))
  }
  return secciones
}

/** Letra sin acordes (etiquetas de sección intactas). */
export const quitarAcordes = (texto: string) => texto.replace(RE_ACORDE_EN_TEXTO, '')

// ---------- Transposición ----------
const SOSTENIDOS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const BEMOLES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
const INDICE: Record<string, number> = {}
SOSTENIDOS.forEach((n, i) => { INDICE[n] = i })
BEMOLES.forEach((n, i) => { INDICE[n] = i })
// Equivalencias raras que algunos cancioneros usan
INDICE['E#'] = 5; INDICE['B#'] = 0; INDICE['Fb'] = 4; INDICE['Cb'] = 11

// En los empates (Gb/F#, Ebm/D#m) se prefieren los sostenidos.
const TONOS_CON_BEMOLES = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm'])
/** Tonos que se escriben mejor con bemoles (F, Bb, Eb… y sus menores). */
export const usaBemoles = (tono: string) => TONOS_CON_BEMOLES.has(tono.trim())

const nota = (n: string, pasos: number, bemoles: boolean) => {
  const i = INDICE[n]
  if (i === undefined) return n
  return (bemoles ? BEMOLES : SOSTENIDOS)[(((i + pasos) % 12) + 12) % 12]!
}

export function transponerAcorde(acorde: string, pasos: number, bemoles = false): string {
  if (!pasos) return acorde
  const m = acorde.match(/^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/)
  if (!m) return acorde
  const bajo = m[3] ? '/' + nota(m[3], pasos, bemoles) : ''
  return nota(m[1]!, pasos, bemoles) + m[2] + bajo
}

/** Tono transpuesto ("D" +3 → "F"; "F#m" +2 → "G#m"; "Bb" +2 → "C"). */
export function transponerTono(tono: string, pasos: number): string {
  if (!tono) return tono
  const conSostenidos = transponerAcorde(tono, pasos, false)
  const conBemoles = transponerAcorde(tono, pasos, true)
  return usaBemoles(conBemoles) ? conBemoles : conSostenidos
}

/** Semitonos (0–11) para ir de un tono a otro. */
export function distancia(de: string, a: string): number {
  const rd = de.match(/^[A-G][#b]?/)?.[0]
  const ra = a.match(/^[A-G][#b]?/)?.[0]
  if (!rd || !ra || INDICE[rd] === undefined || INDICE[ra] === undefined) return 0
  return (((INDICE[ra]! - INDICE[rd]!) % 12) + 12) % 12
}

export const TONOS = [
  'C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B',
  'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm',
]
