# Ministerio de Alabanza — App PWA

Contexto para Claude Code. Léelo completo antes de escribir código.

## Qué es

App web instalable (PWA) para un **ministerio de alabanza de iglesia**. Tiene dos áreas:

- **Área del equipo (privada, con login):** planificar servicios, cancionero con letra y acordes, turnos, ensayos, modo escenario, equipo y roles. Más adelante: Escuela y Vida del ministerio.
- **Área pública (sin login):** "Lo que cantaremos" (orden de los próximos servicios), repertorio con propuestas de un toque y formulario "¿Falta una canción?".

Es un **proyecto independiente**: base de datos y login propios. No se conecta con ningún otro sistema.

## Multi-grupo desde el inicio

- Existen **dos grupos de alabanza totalmente distintos**, pero **por ahora solo uno usa la app**.
- Todo dato pertenece a un `grupo_id`. Nada se comparte entre grupos.
- La UI tiene un selector de grupo (el grupo 2 aparece como "Aún no usa la app · Invitar líder").
- Un usuario puede pertenecer a más de un grupo con roles distintos.

## Stack recomendado

- Vite + React + TypeScript + Tailwind, PWA con `vite-plugin-pwa` (instalable en iPhone, funciona sin conexión para el Modo escenario).
- Supabase: Postgres + Auth (correo y contraseña, más passkey después) + Storage (audios guía) + RLS.
- Deploy: GitHub Pages o Vercel.
- El dueño usa sobre todo **iPhone** y Mac. Probar primero en Safari iOS: safe areas, `100dvh`, "Agregar a pantalla de inicio".

## Diseño (fuente de verdad visual)

La carpeta `diseno/` tiene cada pantalla diseñada como un `.dc.html`. Cada uno es HTML con un bloque `<script type="text/x-dc">` cuyo `renderVals()` contiene la lógica de ejemplo y los datos de muestra. **Úsalos como referencia exacta de layout, colores, textos y comportamiento.** No los ejecutes tal cual: el `./support.js` que cargan no está incluido. Hay que reconstruirlos como componentes React.

| Archivo | Pantalla |
|---|---|
| `Artboard-2s6g.dc.html` | Login animado (ecualizador, campos con etiqueta flotante, botón con estados) |
| `Home.dc.html` | Inicio: tu turno, orden del servicio, módulos, selector de grupo |
| `Services.dc.html` | Servicios: orden del culto, reordenar, aviso de repetición, publicar |
| `Projects.dc.html` | Cancionero: fases Nueva → Aprendiendo → Ensayada → Lista |
| `Shifts.dc.html` | Turnos: mis turnos, todo el grupo, reasignar, fechas no disponibles |
| `Rehearsal.dc.html` | Ensayos: asistencia, canciones a ensayar, guías de audio, notas |
| `Stage.dc.html` | Modo escenario: tema oscuro, transponer, tamaño de letra, auto-scroll |
| `Team.dc.html` | Equipo y roles |
| `Public.dc.html` | Página pública responsive (celular y computadora) |

Cada pantalla del equipo tiene el prop `verComo` (Líder / Músico / Voz / Sonido / Alumno) que muestra exactamente qué ve cada rol. **Esa es la especificación de permisos de la UI.**

### Tokens

- Fuentes: **Fraunces** (títulos, `font-variation-settings: 'SOFT' 100`) y **Nunito** (texto).
- Tema **Salvia** (por defecto): bg `#F2F7EE`, primary `#3D6B4A`, ink `#22322A`, muted `#57695D`, line `#DBE7D4`, card `#DCEDD5`, soft `#EEF5EA`, blob `#D3E8CC`.
- Tema **Rosa**: bg `#FCF3F1`, primary `#A3485A`, ink `#3A2629`, muted `#76595D`, line `#F0DAD5`, card `#F9DFD9`, soft `#FBEDEA`.
- Modo escenario (oscuro, Salvia): bg `#121A15`, fg `#EEF5EA`, chord `#A9D4A0`, panel `#1E2A22`.
- Radios grandes (16–28 px), botones de al menos 44 px, animaciones suaves y respeto a `prefers-reduced-motion`.
- El tema lo elige cada usuario (preferencia guardada en su perfil).

## Roles y permisos

Roles por grupo: `propietario`, `lider`, `musico`, `voz`, `sonido`, `multimedia` (el equipo de alabanza) y `alumno`, `maestro`, `tutor` (la Escuela). La **congregación** no tiene cuenta: solo ve lo público.

- El **propietario** elige quiénes son líderes. Puede haber varios líderes.
- **Líder** = admin del grupo (servicios, cancionero, turnos, ensayos, equipo, lo público).
- **La Escuela es del propietario.** Un líder NO ve clases, alumnos, fichas, comentarios ni prácticas por serlo: solo si el propietario le da acceso con la marca `miembros.coordina_escuela` (Equipo → integrante → "Acceso a la Escuela"). Esa marca solo la da o quita el propietario. Quien la tiene (líder o no) administra la Escuela; los alumnos, maestros y tutores solo los crean, editan, desactivan o quitan el propietario y quienes tengan esa marca. Ver `docs/ESCUELA.md`.

| Módulo | Líder / Propietario | Músico / Voz | Sonido | Multimedia | Alumno / Maestro / Tutor |
|---|---|---|---|---|---|
| Inicio | Todo + alertas + crear | Su turno, orden, módulos | Su turno, orden | Su turno, orden | Lo de la Escuela |
| Servicios | Crear, editar y reordenar, publicar | Solo ver | Solo ver | Solo ver | Sin acceso |
| Cancionero | CRUD, fases, público sí/no, audios guía | Ver letra, acordes y guías; "Ya me la sé" | Sin acceso | Sin acceso | Sin acceso |
| Turnos | Todo el grupo + reasignar | Mis turnos; ve a su equipo sin editar | Igual | Igual | Sin acceso |
| Ensayos | Convocar y definir qué ensayar | Asistencia, repaso, guías, notas | Asistencia, notas | Sin acceso | Sin acceso |
| Modo escenario | Sí | Sí (Voz entra con acordes ocultos) | No | No | No |
| Proyección (pantalla del templo) | Sí | No | No | Sí (la controla) | No |
| Equipo | Agregar integrantes, roles, contraseñas | Solo ver | Solo ver | Solo ver | Sin acceso |
| Escuela | **Solo con acceso del propietario** | Si enseña o está inscrito | Igual | Igual | Su clase, su práctica, su avance |

**Los permisos se aplican en la base de datos con RLS**, no solo ocultando botones. Se prueban sin conexión a Supabase con `npm run test:rls` (corre todas las migraciones en un Postgres local y simula usuarios).

## Reglas de negocio

- **Aviso de repetición:** al armar un servicio, si una canción se cantó hace 14 días o menos, mostrar "Se cantó hace N días". Se calcula a partir de `servicio_items` de servicios pasados.
- **Agregar canción a un servicio:** solo se ofrecen las canciones en fase `lista`.
- **Al pasar una canción a `lista`:** se vuelve pública por defecto (el líder puede apagarlo).
- **"No puedo" en un turno:** estado `no_puede`, se notifica a los líderes y aparece "Falta reemplazo".
- **Reasignar:** el nuevo asignado queda en `pendiente`. Se marca a quien tenga indisponibilidad en esa fecha.
- **Fechas no disponibles:** los líderes las ven al reasignar.
- **Transponer:** las letras se guardan en formato **ChordPro** (`[D]Abre las [G]puertas`). La transposición es cliente, en semitonos, con salida en notación americana (C D E…). Guardar tono por cantante en `cancion_tonos`.
- **Propuestas públicas:** "Proponer" es un voto anónimo por dispositivo (UUID en `localStorage`, único por canción). "¿Falta una canción?" crea una propuesta nueva. Ambas llegan a una **bandeja privada** de líderes (aprobar o descartar). Poner un límite de envíos (rate limit) en la Edge Function o en una política.
- **Página pública:** solo muestra servicios con `publicado = true` y canciones con `publica = true`, por `slug` de grupo: `/p/:slug`.

## Base de datos

Las migraciones están en `supabase/migrations/` (en orden, 1 a 14) y **ya están aplicadas** en el proyecto Supabase `AlabanzaAPP`. `supabase/schema.original.sql` es solo el borrador inicial. Cosas que conviene recordar:
- Las funciones nuevas nacen **cerradas a visitantes anónimos** (migración 13). Solo `votar_cancion`, `quitar_voto` y `enviar_propuesta` son públicas. Si una función nueva debe serlo, hay que darle `grant execute ... to anon` a propósito.
- `es_coord_escuela()` (migración 14) = propietario o integrante con `coordina_escuela`. `participa_escuela()` decide quién lee cursos, niveles y materiales.
- Edge Functions (`supabase/functions/`): `admin-crear-usuario`, `admin-cambiar-password`, `enviar-push`. Hay una versión de un solo archivo de cada una en `docs/despliegue/` (se regenera con `node scripts/empaquetar-funciones.mjs`).

## Estado del plan

Hecho: 1 base y PWA · 2 Supabase y sesión · 3 login con usuario y contraseña (sin registro público) · 4 Inicio y navegación por rol · 5 Cancionero (ChordPro, fases, audios guía) · 6 Servicios · 7 Turnos · 8 página pública `/p/:slug` + propuestas · 9 modo escenario · 10 ensayos · 11 equipo · proyección para la pantalla del templo · avisos al equipo · Escuela (fases 1 a 3) · notificaciones push · modo sin internet · temas de color y modo oscuro.

Pendiente: **Vida del ministerio** · Escuela fase 4 (grabaciones, recordatorios push, afinador) · pruebas con el equipo real (ver `docs/`).

## Sin internet (importante al tocar datos)

Cada músico/voz/líder guarda en su teléfono (IndexedDB, `src/lib/offline/`) el cancionero completo, el próximo servicio y sus tonos propios; y opcionalmente los audios guía. `SyncProvider` lo actualiza al abrir la app con conexión, cuando vuelve el internet, al volver a la app y cada 20 minutos. En iPhone una app web no puede descargar con la pantalla apagada: la descarga ocurre al abrirla con señal.
- Las pantallas **leen primero la copia** y luego la nube (`useCanciones`, `CancionDetalle`, `Escenario`, `useInicio`, `guiasApi`). Si agregas una pantalla que deba funcionar sin internet, haz lo mismo.
- Los cambios (fase, pendientes, publicar…) **necesitan internet**; la única excepción es el tono propio del escenario, que se guarda como `pendiente` y se sube solo después.
- Al cerrar sesión se borra la copia del teléfono.
- Las tipografías van incluidas en la app (`@fontsource-variable`), no desde Google.

## Despliegue

GitHub Pages: cada push a `main` corre `.github/workflows/desplegar.yml` (pruebas, pruebas de permisos, build con `VITE_BASE=/Shekina-Alabanza/`). URL, anon key y llave pública VAPID van como *variables* del repo. Por la ruta base, todo enlace interno es un `<Link>` del router, nunca `<a href="/...">`. Cada pantalla se carga bajo demanda (`React.lazy`) y queda guardada al instalar, así que también abre sin internet.

## Convenciones

- Interfaz en español (Guatemala). Fechas: "dom 11 oct", "10:00 a. m.". Zona horaria `America/Guatemala`.
- Nunca confiar en el rol que manda el cliente: siempre RLS + funciones `security definer`.
- No subir llaves: usar `.env.local` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
- Datos de ejemplo de los diseños = solo semillas de desarrollo (`supabase/seed.sql`), nunca en producción.
- Datos de prueba en la base real: prefijo `ZZ` y se borran al terminar. El propietario usa la app en paralelo y crea datos reales: nunca borrar por conteo.
- Colores: nunca fijos; siempre variables del tema (`var(--primary)`…) para que funcionen los seis temas y el modo oscuro.
