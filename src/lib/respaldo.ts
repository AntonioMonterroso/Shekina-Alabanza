// Cuándo fue la última copia de seguridad descargada desde este dispositivo, y si ya toca recordarlo.
const LS_ULTIMO = 'shekina.respaldo.ultimo'
const LS_PRIMERA = 'shekina.primeraVez'
const DIAS_ENTRE_COPIAS = 30
const DIAS_DE_GRACIA = 7 // al empezar a usar la app no se molesta

const leer = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const guardar = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* sin espacio o modo privado */ } }

export const ultimoRespaldo = () => leer(LS_ULTIMO)
export const anotarRespaldo = () => guardar(LS_ULTIMO, new Date().toISOString())

/** ¿Conviene recordarle al propietario que descargue una copia? (más de 30 días sin hacerlo, pasada la primera semana) */
export function hayQueRespaldar(ahora = Date.now()): boolean {
  const primera = leer(LS_PRIMERA)
  if (!primera) { guardar(LS_PRIMERA, new Date(ahora).toISOString()); return false }
  if (ahora - Date.parse(primera) < DIAS_DE_GRACIA * 86_400_000) return false
  const ultimo = leer(LS_ULTIMO)
  return !ultimo || ahora - Date.parse(ultimo) > DIAS_ENTRE_COPIAS * 86_400_000
}
