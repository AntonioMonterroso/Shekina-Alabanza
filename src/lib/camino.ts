// Progreso por niveles de un curso (sin dependencias, se prueba con `npm test`).

export interface NivelBase { id: string; orden: number }

export type EstadoNivel = 'hecho' | 'actual' | 'pendiente'

/**
 * El camino de un alumno: los niveles completados van marcados y el primero sin completar es el actual.
 * Si completó alguno saltándose otro, el actual sigue siendo el primer hueco.
 */
export function estadoNiveles(niveles: NivelBase[], completados: Set<string>): Map<string, EstadoNivel> {
  const orden = [...niveles].sort((a, b) => a.orden - b.orden)
  const res = new Map<string, EstadoNivel>()
  let actual = false
  for (const n of orden) {
    if (completados.has(n.id)) res.set(n.id, 'hecho')
    else if (!actual) { res.set(n.id, 'actual'); actual = true }
    else res.set(n.id, 'pendiente')
  }
  return res
}

/** El siguiente nivel por completar (null si ya los completó todos o no hay niveles). */
export function nivelActual<T extends NivelBase>(niveles: T[], completados: Set<string>): T | null {
  const estados = estadoNiveles(niveles, completados)
  return niveles.find((n) => estados.get(n.id) === 'actual') ?? null
}

/** El último nivel completado, en orden (para poder deshacerlo). */
export function ultimoCompletado<T extends NivelBase>(niveles: T[], completados: Set<string>): T | null {
  return [...niveles].sort((a, b) => b.orden - a.orden).find((n) => completados.has(n.id)) ?? null
}
