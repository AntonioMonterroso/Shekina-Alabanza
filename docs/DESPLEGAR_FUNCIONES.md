# Desplegar las funciones de Supabase

Hay dos formas. La A no necesita terminal.

Funciones del proyecto:
- `enviar-push` — manda las notificaciones (nueva).
- `admin-crear-usuario` — para que acepte los roles maestro y tutor (volver a desplegar).
- `admin-cambiar-password` — no cambió; no hace falta volver a subirla.

## A) Desde el navegador (sin terminal)
Cada función tiene su archivo único en `docs/despliegue/`. Ábrelo en GitHub, toca **Raw**, selecciona todo y copia.

1. supabase.com → proyecto **AlabanzaAPP** → **Edge Functions**.
2. **enviar-push** (nueva): *Deploy a new function* → *Via Editor*. Nombre exacto: `enviar-push`. Borra lo que trae el editor, pega el contenido de `docs/despliegue/enviar-push.ts` y toca **Deploy**.
3. **admin-crear-usuario** (ya existe): ábrela → pestaña de código → borra todo, pega `docs/despliegue/admin-crear-usuario.ts` → **Deploy**.
4. Deja activada la opción "Verify JWT" (viene así por defecto).

## B) Desde la terminal
```
git clone https://github.com/AntonioMonterroso/shekina-alabanza.git   # solo si no tienes la carpeta
cd shekina-alabanza
supabase functions deploy enviar-push --project-ref acdskhdbnnvijyekzuft --use-api
supabase functions deploy admin-crear-usuario --project-ref acdskhdbnnvijyekzuft --use-api
```
La herramienta `supabase` debe estar iniciada con la cuenta dueña del proyecto (`supabase login`).

## Comprobar
- En Edge Functions deben aparecer las dos funciones con fecha de hoy.
- Si al probar el log dice "Notificaciones sin configurar", falta algún secreto (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `APP_URL`).

## Si cambia el código de una función
Regenera los archivos únicos con `node scripts/empaquetar-funciones.mjs` y vuelve a pegarlos.
