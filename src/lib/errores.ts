import { crearLimitador, debeIgnorar, esRecargable, limpiar, mensajeDe, rutaSinBase } from './erroresPuro'
import { supabase } from './supabase'

declare const __VERSION__: string
const VERSION = typeof __VERSION__ === 'undefined' ? 'dev' : __VERSION__

interface Fila {
  grupo_id: string
  user_id: string
  tipo: 'automatico' | 'manual'
  ruta: string
  mensaje: string
  detalle: string | null
  agente: string
  version: string
}

let contexto: { grupoId?: string; userId?: string } = {}
const permitir = crearLimitador()
const COLA = 'shekina.errores.cola'

/** Quién es y en qué grupo está (lo fija la app al iniciar sesión). */
export function fijarContexto(grupoId?: string, userId?: string) {
  contexto = { grupoId, userId }
  if (grupoId && userId && navigator.onLine) void vaciarCola()
}

function encolar(fila: Fila) {
  try {
    const c = JSON.parse(localStorage.getItem(COLA) ?? '[]') as Fila[]
    localStorage.setItem(COLA, JSON.stringify([...c, fila].slice(-20)))
  } catch { /* sin espacio: se pierde este reporte, no pasa nada */ }
}

/** Sin conexión los errores se guardan en el teléfono y se mandan cuando vuelve el internet. */
async function vaciarCola() {
  try {
    const c = JSON.parse(localStorage.getItem(COLA) ?? '[]') as Fila[]
    const mios = c.filter((f) => f.user_id === contexto.userId)
    if (mios.length === 0) return
    const { error } = await supabase.from('errores_app').insert(mios)
    if (!error) localStorage.setItem(COLA, JSON.stringify(c.filter((f) => f.user_id !== contexto.userId)))
  } catch { /* se reintenta la próxima vez */ }
}

/**
 * Anota un error para que el propietario lo vea. Nunca lanza ni estorba: si no se puede, se descarta o queda en cola.
 * Los reportes manuales ("Reportar un problema") no pasan por los filtros automáticos.
 */
export async function registrarError(error: unknown, o: { tipo?: 'automatico' | 'manual'; nota?: string } = {}): Promise<boolean> {
  try {
    const tipo = o.tipo ?? 'automatico'
    const mensaje = limpiar(mensajeDe(error), 400)
    if (!mensaje || !contexto.grupoId || !contexto.userId) return false
    if (tipo === 'automatico' && (debeIgnorar(mensaje) || !permitir(mensaje, Date.now()))) return false
    const pila = error instanceof Error ? error.stack ?? '' : ''
    const fila: Fila = {
      grupo_id: contexto.grupoId, user_id: contexto.userId, tipo,
      ruta: rutaSinBase(location.pathname, import.meta.env.BASE_URL),
      mensaje,
      detalle: limpiar([o.nota, pila].filter(Boolean).join('\n\n'), 3000) || null,
      agente: navigator.userAgent.slice(0, 300),
      version: VERSION,
    }
    if (!navigator.onLine) { encolar(fila); return false }
    const { error: e } = await supabase.from('errores_app').insert(fila)
    if (e) { encolar(fila); return false }
    return true
  } catch { return false }
}

function recargarUnaVez() {
  try {
    if (sessionStorage.getItem('shekina.recarga')) return
    sessionStorage.setItem('shekina.recarga', '1')
  } catch { /* sin sessionStorage: se recarga igual una vez por carga de página */ }
  location.reload()
}

/** Captura lo que no atrapó nadie. Se instala una vez al arrancar. */
export function instalarCapturaDeErrores() {
  const alFallar = (e: unknown) => {
    // Después de publicar una versión nueva, una pestaña vieja pide archivos que ya no existen: se recarga sola
    if (esRecargable(mensajeDe(e))) return recargarUnaVez()
    void registrarError(e)
  }
  window.addEventListener('error', (ev) => alFallar(ev.error ?? ev.message))
  window.addEventListener('unhandledrejection', (ev) => alFallar(ev.reason))
  window.setTimeout(() => { try { sessionStorage.removeItem('shekina.recarga') } catch { /* nada */ } }, 15_000)
}
