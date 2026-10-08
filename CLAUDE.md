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

Roles por grupo: `propietario`, `lider`, `musico`, `voz`, `sonido`, `alumno`. La **congregación** no tiene cuenta: solo ve lo público.

- El **propietario** elige quiénes son líderes. Puede haber varios líderes.
- **Líder** = admin del grupo.

| Módulo | Líder / Propietario | Músico / Voz | Sonido | Alumno |
|---|---|---|---|---|
| Inicio | Todo + alerta de puestos sin cubrir + crear | Su turno, orden, módulos | Su turno, orden | Su próxima clase y su práctica |
| Servicios | Crear, editar y reordenar, publicar | Solo ver | Solo ver | Sin acceso |
| Cancionero | CRUD, avanzar fase, pendientes, público sí/no | Ver letra, acordes y guías; "Ya me la sé" | Sin acceso | Sin acceso |
| Turnos | Todo el grupo + reasignar | Mis turnos (confirmar / no puedo), fechas no disponibles; ve a su equipo sin editar | Igual que músico | Sin acceso |
| Ensayos | Convocar y definir qué ensayar | Asistencia, repaso, guías, notas | Asistencia, notas | Sin acceso |
| Modo escenario | Sí | Sí (Voz entra con acordes ocultos) | No | No |
| Equipo | Invitar, cambiar roles | Solo ver | Solo ver | Sin acceso |

**Los permisos se aplican en la base de datos con RLS**, no solo ocultando botones.

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

El esquema inicial con RLS está en `supabase/schema.sql`. Revísalo, ajústalo y conviértelo en migraciones.

## Plan de construcción (en orden)

1. Proyecto Vite + React + TS + Tailwind + PWA. Tokens de diseño y tema Salvia/Rosa.
2. Supabase: migraciones desde `schema.sql`, Auth, `usePerfil` / `useGrupoActual` / `useRol`.
3. Login (igual al diseño) + aceptar invitación por enlace.
4. Inicio + navegación inferior según rol.
5. Cancionero (CRUD + ChordPro + fases).
6. Servicios (orden, reordenar, aviso de repetición, publicar).
7. Turnos (asignar, confirmar, reasignar, indisponibilidad).
8. Página pública `/p/:slug` + propuestas + bandeja de líderes.
9. Modo escenario (offline: cachear el servicio del día y sus canciones).
10. Ensayos + guías de audio en Storage.
11. Equipo (invitar, roles).
12. Después: Escuela, Vida del ministerio, notificaciones push (iOS 16.4+ con la PWA instalada).

## Convenciones

- Interfaz en español (Guatemala). Fechas: "dom 11 oct", "10:00 a. m.". Zona horaria `America/Guatemala`.
- Nunca confiar en el rol que manda el cliente: siempre RLS + funciones `security definer`.
- No subir llaves: usar `.env.local` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
- Datos de ejemplo de los diseños = solo semillas de desarrollo (`supabase/seed.sql`), nunca en producción.
