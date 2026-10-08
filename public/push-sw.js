// Se carga dentro del service worker de la app (importScripts): recibe las notificaciones push.
self.addEventListener('push', (event) => {
  let d = {}
  try { d = event.data ? event.data.json() : {} } catch { /* mensaje sin formato */ }
  event.waitUntil(self.registration.showNotification(d.title || 'Alabanza', {
    body: d.body || '',
    icon: 'pwa-192.png',
    badge: 'pwa-192.png',
    data: { url: d.url || self.registration.scope },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
    for (const v of ventanas) {
      if ('focus' in v) { if ('navigate' in v) v.navigate(url); return v.focus() }
    }
    return self.clients.openWindow(url)
  }))
})
