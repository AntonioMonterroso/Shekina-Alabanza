// Ayudas para escribir canciones sin saber ChordPro: insertar partes y acordes, y convertir
// letras con los acordes encima (como en la mayoría de páginas) al formato [D]Abre las [G]puertas.
import { esAcorde, etiquetaDeSeccion, transponerAcorde, usaBemoles } from './chordpro.ts'

export const PARTES = ['Verso', 'Pre-coro', 'Coro', 'Puente', 'Intro', 'Interludio', 'Final']

const tokens = (linea: string) => linea.trim().split(/\s+/).filter((t) => t && t !== '|')

/** Una línea es de acordes si todo lo que tiene son acordes (G  D/F#  Em7). */
export function esLineaDeAcordes(linea: string): boolean {
  const t = tokens(linea)
  return t.length > 0 && t.every(esAcorde)
}

/** Pone cada acorde de la línea de arriba justo encima de la sílaba que le corresponde. */
function mezclar(acordes: string, letra: string): string {
  const pos = [...acordes.matchAll(/\S+/g)].filter((m) => m[0] !== '|').map((m) => ({ i: m.index!, a: m[0] }))
  const dentro = pos.filter((p) => p.i < letra.length)
  const fuera = pos.filter((p) => p.i >= letra.length)
  let res = letra
  for (const p of dentro.reverse()) res = res.slice(0, p.i) + `[${p.a}]` + res.slice(p.i)
  return res.trimEnd() + fuera.map((p) => `[${p.a}]`).join('')
}

/** Convierte "acordes encima de la letra" a ChordPro. Los nombres de parte ("CORO:") pasan a [Coro]. */
export function deAcordesArriba(texto: string): string {
  const lineas = texto.replace(/\r/g, '').replace(/\t/g, '    ').split('\n')
  const out: string[] = []
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i]!
    const parte = etiquetaDeSeccion(l)
    if (parte) { out.push(`[${parte}]`); continue }
    if (esLineaDeAcordes(l)) {
      const sig = lineas[i + 1]
      const sigEsLetra = sig !== undefined && sig.trim() !== '' && !esLineaDeAcordes(sig) && !etiquetaDeSeccion(sig)
      if (sigEsLetra) { out.push(mezclar(l, sig)); i++; continue }
      out.push(tokens(l).map((t) => `[${t}]`).join(' ')) // línea instrumental: solo acordes
      continue
    }
    out.push(l.trimEnd())
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

export interface Edicion { texto: string; cursor: number }

/** Inserta algo en la posición del cursor (reemplazando lo seleccionado) y dice dónde queda el cursor. */
export function insertarEn(texto: string, inicio: number, fin: number, ins: string): Edicion {
  return { texto: texto.slice(0, inicio) + ins + texto.slice(fin), cursor: inicio + ins.length }
}

/** Inserta el nombre de una parte ([Coro]) en su propia línea, con una línea en blanco antes. */
export function insertarParte(texto: string, pos: number, nombre: string): Edicion {
  const antes = texto.slice(0, pos)
  const despues = texto.slice(pos)
  const prefijo = antes === '' || antes.endsWith('\n\n') ? '' : antes.endsWith('\n') ? '\n' : '\n\n'
  const ins = `${prefijo}[${nombre}]\n`
  return { texto: antes + ins + despues.replace(/^\n/, ''), cursor: antes.length + ins.length }
}

const MAYOR: [number, string][] = [[0, ''], [2, 'm'], [4, 'm'], [5, ''], [7, ''], [9, 'm']]
const MENOR: [number, string][] = [[0, 'm'], [3, ''], [5, 'm'], [7, ''], [8, ''], [10, ''], [7, 'm']]

/** Los acordes que más se usan en un tono: en G → G Am Bm C D Em. */
export function acordesDelTono(tono: string): string[] {
  const m = tono.trim().match(/^([A-G][#b]?)(m?)$/)
  if (!m) return []
  const bemoles = usaBemoles(tono)
  return (m[2] ? MENOR : MAYOR).map(([n, suf]) => transponerAcorde(m[1]!, n, bemoles) + suf)
}
