// Lógica pura del registro de errores (sin red), para poder probarla.

/** Errores que no son fallos de la app: falta de internet, cancelaciones, ruidos conocidos del navegador. */
const IGNORAR = [
  /failed to fetch/i, /networkerror/i, /load failed/i, /network request failed/i, /fetch failed/i,
  /resizeobserver/i, /\baborted?\b/i, /the operation was aborted/i, /signal is aborted/i, /script error/i,
  /non-error promise rejection/i,
]
export const debeIgnorar = (mensaje: string) => IGNORAR.some((r) => r.test(mensaje))

/** Pasa cuando se publica una versión nueva y la pestaña aún pide archivos viejos: basta con recargar. */
export const esRecargable = (mensaje: string) =>
  /dynamically imported module|importing a module script failed|loading chunk .* failed|error loading dynamically/i.test(mensaje)

export function mensajeDe(e: unknown): string {
  if (e instanceof Error) return e.message || e.name
  if (typeof e === 'string') return e
  if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') return (e as { message: string }).message
  try { return JSON.stringify(e) ?? '' } catch { return String(e) }
}

/** Recorta y quita lo que no debe guardarse: correos y llaves/tokens que pudieran venir dentro de un mensaje. */
export function limpiar(texto: string, max: number): string {
  return texto
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[correo]')
    .replace(/eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]*/g, '[token]')
    .replace(/sb_(?:publishable|secret)_[\w-]+/g, '[llave]')
    .trim()
    .slice(0, max)
}

/** "/Shekina-Alabanza/cancionero/abc" con base "/Shekina-Alabanza/" → "/cancionero/abc" (sin parámetros de consulta). */
export function rutaSinBase(pathname: string, base: string): string {
  const b = base.replace(/\/$/, '')
  const r = b && pathname.startsWith(b) ? pathname.slice(b.length) : pathname
  return (r || '/').slice(0, 200)
}

/**
 * Evita llenar el registro: el mismo mensaje no se repite en `ventanaMs` y cada sesión manda a lo más `maxSesion`.
 * Devuelve una función que dice si este mensaje se puede reportar ahora.
 */
export function crearLimitador({ ventanaMs = 10 * 60_000, maxSesion = 15 } = {}) {
  const vistos = new Map<string, number>()
  let total = 0
  return (mensaje: string, ahora: number): boolean => {
    if (total >= maxSesion) return false
    const antes = vistos.get(mensaje)
    if (antes !== undefined && ahora - antes < ventanaMs) return false
    vistos.set(mensaje, ahora)
    total++
    return true
  }
}
