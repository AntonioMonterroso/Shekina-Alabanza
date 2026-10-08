// Diapositivas para la pantalla del templo: se arman en el cliente a partir de la letra sin acordes.
import { parse, quitarAcordes } from './chordpro.ts'

export interface Diapositiva { etiqueta: string | null; lineas: string[] }

/** Cuántas líneas caben en una diapositiva legible desde el fondo del templo. */
export const LINEAS_POR_DIAPOSITIVA = 4

/** Reparte n líneas en trozos parejos de a lo más `max` (7 líneas con max 4 → 4 + 3, no 4 + 3 + 0). */
function trozos<T>(lineas: T[], max: number): T[][] {
  const partes = Math.ceil(lineas.length / max)
  const base = Math.ceil(lineas.length / partes)
  const out: T[][] = []
  for (let i = 0; i < lineas.length; i += base) out.push(lineas.slice(i, i + base))
  return out
}

/** Letra (con o sin acordes, ChordPro) → diapositivas. Una sección larga se parte en varias. */
export function diapositivasDe(letra: string, max = LINEAS_POR_DIAPOSITIVA): Diapositiva[] {
  const out: Diapositiva[] = []
  for (const s of parse(letra)) {
    const lineas = s.lineas.map((l) => l.map((g) => g.texto).join('').replace(/\s+/g, ' ').trim()).filter(Boolean)
    if (lineas.length === 0) continue
    trozos(lineas, max).forEach((t, i) => out.push({ etiqueta: i === 0 ? s.etiqueta : null, lineas: t }))
  }
  return out
}

export interface CancionTexto { titulo: string; autor?: string | null; letra: string }

/**
 * Texto plano para importar en ProPresenter o EasyWorship: una línea en blanco separa las diapositivas.
 * Con `etiquetas` se deja el nombre de cada sección ("Coro") encima de su primera diapositiva.
 */
export function aTexto(canciones: CancionTexto[], etiquetas = false): string {
  return canciones.map((c) => {
    const bloques = diapositivasDe(quitarAcordes(c.letra)).map((d) => (etiquetas && d.etiqueta ? [d.etiqueta, ...d.lineas] : d.lineas).join('\n'))
    return [c.titulo, ...bloques].join('\n\n')
  }).join('\n\n\n') + '\n'
}
