# Escuela — especificación

Decisiones del propietario:
- Se enseña **todo** (piano, guitarra, bajo, batería, voz, teoría…). Los **cursos son editables**; la migración trae seis de entrada.
- Clases **grupales e individuales**.
- Enseñan **personas del ministerio y a veces externos**.
- Hay **menores y adultos**.
- Sirve para **formar músicos que entren al grupo de alabanza**.
- Tamaño real: hoy no pasan de 5 alumnos; se prevén 10 a 25. Listas simples, sin paneles pesados.

## Roles
| Rol | Qué ve |
|---|---|
| Alumno | Su clase, su práctica, sus materiales |
| Maestro (rol nuevo) | Maestro **externo**: solo la Escuela. Un maestro del ministerio sigue siendo músico/líder y se asigna a la clase |
| Tutor (rol nuevo) | Solo lectura del avance de su hijo; puede anotar la práctica por él |
| Coordinador | Marca `miembros.coordina_escuela` en cualquier integrante (o cualquier líder): arma cursos, clases, inscripciones |

La seguridad vive en RLS (`20261010000009_escuela.sql`) y se prueba con `scripts/prueba-escuela.mjs`.

## Modelo
cursos → clases (maestro, horario, lugar, grupal/individual) → inscripciones (alumno) · sesiones (+ asistencia) ·
prácticas semanales (a toda la clase o a un alumno; pueden apuntar a una canción) → registro de práctica (minutos, nota).
Perfil de alumno (nacimiento, objetivo) y tutores (tutor ↔ alumno).

## Fases
1. **Base** — cursos, clases, inscripciones, sesiones con asistencia, práctica semanal con check. *(esquema listo, falta la interfaz)*
2. **Acompañamiento** — materiales, comentarios del maestro, modo práctica con temporizador y metrónomo.
3. **Crecimiento** — niveles/hitos, "listo para el equipo" (el líder pasa al alumno a músico), vista del tutor.
4. **Extras** — grabaciones, recordatorios push (ya existen las notificaciones), afinador.

## Diseño
- Una planta que crece: cada semana de práctica suma una hoja (sin ranking; es personal).
- El nivel como sendero con estaciones; la semana en siete puntos.
- Color por curso con los chips que ya usa la app.
- Maestro: lista de clase con pase de lista en dos toques.
- Menores: botones grandes y lenguaje corto.
