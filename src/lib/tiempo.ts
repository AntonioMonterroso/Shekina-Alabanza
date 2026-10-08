/** "hoy", "ayer", "hace 4 días", "hace 2 semanas", "hace 3 meses" */
export function relativo(fecha: string | Date, ahora = new Date()): string {
  const dias = Math.floor((ahora.getTime() - new Date(fecha).getTime()) / 86_400_000)
  if (dias <= 0) return 'hoy'
  if (dias === 1) return 'ayer'
  if (dias < 14) return `hace ${dias} días`
  if (dias < 60) return `hace ${Math.floor(dias / 7)} semanas`
  if (dias < 365) return `hace ${Math.floor(dias / 30)} meses`
  const a = Math.floor(dias / 365)
  return a === 1 ? 'hace 1 año' : `hace ${a} años`
}

/** Días enteros desde una fecha (para el aviso "se cantó hace N días"). */
export const diasDesde = (fecha: string | Date, ahora = new Date()) =>
  Math.floor((ahora.getTime() - new Date(fecha).getTime()) / 86_400_000)
