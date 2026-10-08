// Color estable por persona (según su id), tomado de los colores de apoyo del tema.
const PALETA = ['lila', 'rosa', 'azul', 'verde', 'ambar'] as const

export function colorAvatar(id: string): { background: string; color: string } {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const n = PALETA[h % PALETA.length]!
  return { background: `var(--c-${n}-bg)`, color: `var(--c-${n}-fg)` }
}

export const primerNombre = (nombre: string) => nombre.split(/\s+/)[0] ?? nombre
