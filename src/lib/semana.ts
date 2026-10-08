// Semanas de lunes a domingo, trabajando con fechas "YYYY-MM-DD" (sin horas, para no tener saltos de día).

/** El lunes de la semana que contiene esa fecha. */
export function lunesDe(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}

export function sumarDias(ymd: string, n: number): string {
  const d = new Date(`${ymd}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Las 7 fechas de la semana que empieza ese lunes. */
export const diasDeSemana = (lunes: string): string[] => Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i))

export const INICIAL_DIA = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
