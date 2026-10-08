// Fechas siempre en hora de Guatemala: "dom 11 oct", "10:00 a. m."
const TZ = 'America/Guatemala'
const f = (d: Date | string, o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('es-GT', { timeZone: TZ, ...o }).format(new Date(d)).replace(/[  ]/g, ' ')

export const diaSemana = (d: Date | string) => f(d, { weekday: 'short' }).replace('.', '')
export const diaNum = (d: Date | string) => f(d, { day: 'numeric' })
export const mesCorto = (d: Date | string) => f(d, { month: 'short' }).replace('.', '')
export const hora = (d: Date | string) => f(d, { hour: 'numeric', minute: '2-digit', hour12: true })
export const fechaCorta = (d: Date | string) => `${diaSemana(d)} ${diaNum(d)} ${mesCorto(d)}`

export function saludo(): string {
  const h = Number(new Intl.DateTimeFormat('es-GT', { timeZone: TZ, hour: 'numeric', hour12: false }).format(new Date()))
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'
}

/** ISO del último instante del mes actual (aprox. en UTC, suficiente para contar puestos del mes). */
export function finDeMes(): string {
  const n = new Date()
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + 1, 1, 6, 0, 0)).toISOString()
}

export const iniciales = (nombre: string) =>
  nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('')
