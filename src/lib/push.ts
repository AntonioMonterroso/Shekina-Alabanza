// Notificaciones push: activar/desactivar en este dispositivo y pedir que se avise a otros.
// Todo queda apagado hasta que exista VITE_VAPID_PUBLIC_KEY (ver docs/NOTIFICACIONES.md).
import { supabase } from './supabase'

const CLAVE = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export type EstadoPush = 'no-configurado' | 'no-soportado' | 'instalar' | 'bloqueado' | 'inactivo' | 'activo'

const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const instalada = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true

function aBytes(base64: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const bin = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

export async function estadoPush(): Promise<EstadoPush> {
  if (!CLAVE) return 'no-configurado'
  // En iPhone solo funciona con la app agregada a la pantalla de inicio
  if (esIOS() && !instalada()) return 'instalar'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'no-soportado'
  if (Notification.permission === 'denied') return 'bloqueado'
  try {
    const reg = await navigator.serviceWorker.ready
    return (await reg.pushManager.getSubscription()) ? 'activo' : 'inactivo'
  } catch { return 'no-soportado' }
}

/** Debe llamarse desde un toque del usuario (iOS lo exige). Devuelve un mensaje de error o null. */
export async function activarPush(userId: string): Promise<string | null> {
  if (!CLAVE) return 'Las notificaciones aún no están configuradas.'
  const permiso = await Notification.requestPermission()
  if (permiso !== 'granted') return 'No diste permiso. Puedes cambiarlo en los ajustes del teléfono.'
  try {
    const reg = await navigator.serviceWorker.ready
    // Si el servicio de notificaciones del teléfono no responde, no se queda cargando para siempre
    const limite = new Promise<never>((_, no) => setTimeout(() => no(new Error('tiempo')), 20_000))
    const sub = (await reg.pushManager.getSubscription()) ?? await Promise.race([reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(CLAVE) }), limite])
    const j = sub.toJSON() as { endpoint: string; keys?: { p256dh: string; auth: string } }
    if (!j.keys) return 'Este navegador no entregó las llaves de la suscripción.'
    const { error } = await supabase.from('push_suscripciones').upsert({ user_id: userId, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }, { onConflict: 'endpoint' })
    return error ? 'No se pudo guardar la suscripción. Intenta de nuevo.' : null
  } catch { return 'No se pudo activar en este dispositivo.' }
}

export async function desactivarPush(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (!sub) return
    await supabase.from('push_suscripciones').delete().eq('endpoint', sub.endpoint)
    await sub.unsubscribe()
  } catch { /* ya estaba desactivado */ }
}

/** Pide a la Edge Function que avise a quien corresponda. Nunca interrumpe lo que el usuario estaba haciendo. */
export function avisarPush(tipo: 'aviso' | 'ensayo' | 'turno' | 'no_puede', id: string): void {
  if (!CLAVE) return
  void supabase.functions.invoke('enviar-push', { body: { tipo, id } }).catch(() => {})
}
