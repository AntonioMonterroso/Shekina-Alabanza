# Shekina Alabanza

App web instalable (PWA) para un **ministerio de alabanza**: planificar el culto, cancionero con letra y acordes, turnos, ensayos, modo escenario, pantalla del templo, una escuela de música y una página pública para la congregación.

- **Uso:** https://antoniomonterroso.github.io/Shekina-Alabanza/ (se instala desde el navegador: *Compartir → Agregar a pantalla de inicio*).
- **Acceso:** solo con usuario y contraseña que entrega un líder. No hay registro público.
- **Hecha para el celular** (probada primero en Safari de iPhone) y para usarse **sin internet**.

## Qué incluye

| | |
|---|---|
| **Inicio** | Tu turno, el orden del servicio, avisos y accesos según tu rol |
| **Cancionero** | Letras en ChordPro, transposición, fases (Nueva → Lista), audios guía |
| **Servicios** | Orden del culto, aviso de repetición ("se cantó hace N días"), publicar |
| **Turnos** | Asignar, confirmar, "no puedo", reemplazos, fechas no disponibles |
| **Ensayos** | Convocar, asistencia, canciones a ensayar, repaso y notas |
| **Modo escenario** | Pantalla completa para cantar: tono propio por canción, tamaño de letra, desplazamiento automático, fondo claro u oscuro con el color que elegiste |
| **Proyección** | Control para el equipo de multimedia y pantalla en vivo para el proyector del templo |
| **Equipo** | Integrantes, roles, puestos que cada quien puede cubrir, contraseñas |
| **Escuela** | Cursos, clases, práctica semanal con temporizador y metrónomo, niveles. Solo del propietario (ver abajo) |
| **Página pública** | Lo que cantaremos, repertorio con votos y "¿Falta una canción?" |
| **Notificaciones push** | Avisos, ensayos, turnos y la Escuela |

Seis temas de color (Salvia, Rosa, Cielo, Ámbar, Lavanda, Turquesa), cada uno con modo claro y oscuro.

### Sin internet
El cancionero completo, el próximo servicio y los tonos propios se guardan en el teléfono (IndexedDB) y se actualizan solos al abrir la app con conexión. Los audios guía son opcionales (Perfil → Sin internet). En iPhone una app web no puede descargar con la pantalla apagada: la descarga ocurre al abrirla con señal. Los cambios (fases, pendientes, publicar…) sí necesitan internet.

### Roles
`propietario`, `lider`, `musico`, `voz`, `sonido`, `multimedia` (equipo) y `alumno`, `maestro`, `tutor` (Escuela). **La Escuela es del propietario**: un líder solo entra si el propietario le da acceso. Los permisos viven en la base de datos (RLS), no solo en la interfaz. Detalle en [`CLAUDE.md`](CLAUDE.md) y [`docs/ESCUELA.md`](docs/ESCUELA.md).

## Tecnología

Vite · React 19 · TypeScript · Tailwind 4 · `vite-plugin-pwa` · Supabase (Postgres, Auth, Storage, Realtime, Edge Functions) · GitHub Pages.

## Poner a andar una copia

Necesitas Node 20.19+ (o 22.12+) y un proyecto de [Supabase](https://supabase.com).

```bash
npm ci
cp .env.example .env.local     # pon la URL y la anon key de tu proyecto
npm run dev                    # http://localhost:5173
```

### Base de datos
1. Aplica las migraciones de `supabase/migrations/` en orden (SQL Editor de Supabase, o `supabase db push`).
2. Corre `supabase/seed.sql` (crea el grupo y los puestos de ejemplo).
3. En *Authentication → Sign In / Providers* desactiva *Allow new users to sign up*.
4. Despliega las funciones de `supabase/functions/` (hay una guía sin terminal en [`docs/DESPLEGAR_FUNCIONES.md`](docs/DESPLEGAR_FUNCIONES.md)).
5. Crea tu usuario propietario (una sola vez, en tu computadora; usa la llave `service_role`, nunca en el navegador ni en el repo):
   ```bash
   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
   node scripts/crear-propietario.mjs alabanza tuusuario "Tu Nombre" "una-contraseña-larga"
   ```
6. Para notificaciones push sigue [`docs/NOTIFICACIONES.md`](docs/NOTIFICACIONES.md).

### Pruebas
```bash
npm test          # lógica: ChordPro, transposición, almacén sin conexión, permisos de la interfaz…
npm run test:rls  # permisos de la base de datos: corre todas las migraciones en un Postgres local y simula usuarios
npm run build
```

## Despliegue

Cada push a `main` corre [`.github/workflows/desplegar.yml`](.github/workflows/desplegar.yml): pruebas, pruebas de permisos, build y publicación en GitHub Pages. La URL y la anon key de Supabase (públicas por diseño) y la llave pública de push van como *variables* del repo (Settings → Secrets and variables → Actions → Variables). **Nunca** subas la `service_role` ni la llave privada de push.

## Estructura

```
src/
  app/            router, barra inferior por rol
  features/       una carpeta por módulo (cancionero, servicios, turnos, escenario, escuela…)
  hooks/          sesión (AuthProvider) y sincronización sin conexión (SyncProvider)
  lib/            ChordPro, fechas, permisos, y offline/ (IndexedDB y sincronización)
  components/     hojas, iconos, avisos
supabase/         migraciones, funciones Edge, semillas
docs/             Escuela, notificaciones, despliegue de funciones
scripts/          crear propietario, empaquetar funciones, pruebas de permisos
diseno/           pantallas de referencia (HTML)
tests/            pruebas de lógica
```

## Seguridad

- Acceso solo por cuentas creadas por un líder; el registro público está apagado en Supabase.
- RLS en todas las tablas; las funciones internas no son ejecutables por visitantes sin sesión (solo votar y proponer en la página pública, con límite por dispositivo).
- Los datos de menores de la Escuela solo los lee quien la coordina, el maestro de la clase, el alumno y su tutor.
- Si encuentras un problema de seguridad, avísale al propietario del ministerio en privado antes de publicarlo.
