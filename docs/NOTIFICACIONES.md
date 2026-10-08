# Notificaciones push — cómo activarlas

Todo el código ya está. Queda apagado hasta completar estos pasos (una sola vez). Mientras no exista
`VITE_VAPID_PUBLIC_KEY`, la app no muestra nada de notificaciones y no llama a ninguna función.

## 1. Generar las llaves (en tu computadora)
```
npx web-push generate-vapid-keys
```
Da una llave **pública** y una **privada**. La privada no se comparte ni se sube a GitHub.

## 2. Aplicar la migración
Pega `supabase/migrations/20261011000010_push.sql` en el SQL Editor de Supabase (crea `push_suscripciones`).

## 3. Guardar los secretos y desplegar la función
En Supabase → Edge Functions → Secrets (o con `supabase secrets set`):
- `VAPID_PUBLIC_KEY` = la llave pública
- `VAPID_PRIVATE_KEY` = la llave privada
- `VAPID_SUBJECT` = `mailto:tu-correo@ejemplo.com`
- `APP_URL` = `https://antoniomonterroso.github.io/Shekina-Alabanza/`

Desplegar (y volver a desplegar cada vez que cambie la función): `supabase functions deploy enviar-push --project-ref acdskhdbnnvijyekzuft`
(Si ya habías desplegado `admin-crear-usuario`, vuelve a desplegarla para que acepte los roles maestro y tutor.)

## 4. Publicar la llave pública en la app
GitHub → repo → Settings → Secrets and variables → Actions → **Variables** → New:
`VITE_VAPID_PUBLIC_KEY` = la llave pública. Luego vuelve a correr el despliegue (Actions → Desplegar → Run workflow).

## 5. Cada persona la activa en su teléfono
Perfil → Notificaciones → **Activar**. En iPhone la app debe estar agregada a la pantalla de inicio
(Compartir → Agregar a inicio) y abierta desde ahí (iOS 16.4 o más).

## Qué se avisa
| Pasa esto | Le llega a |
|---|---|
| Un líder publica un aviso | Todo el grupo |
| Un líder convoca un ensayo | El equipo de alabanza |
| Un líder asigna o reasigna un turno | La persona asignada |
| Alguien marca "No puedo" en un turno | Los líderes ("Falta reemplazo") |
| Un maestro deja una práctica nueva | Los alumnos de la clase (o el alumno elegido) y sus tutores |
| Un maestro le escribe un comentario a un alumno | Ese alumno y sus tutores |
| Un maestro marca un nivel completado | El alumno y sus tutores |
| Un maestro recomienda a un alumno para el equipo | Los líderes |

Quien dispara la acción no recibe su propia notificación. La función valida en el servidor quién puede
disparar cada tipo; el teléfono nunca decide a quién se envía.
