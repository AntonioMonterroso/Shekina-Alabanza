# Escuela — especificación

Decisiones del propietario:
- **La Escuela es suya.** Los líderes no ven clases, alumnos ni avances a menos que él les dé acceso (Equipo → integrante → *Acceso a la Escuela*).
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
| Coordinador | **El propietario**, y quien él marque con `miembros.coordina_escuela` (un líder, un músico, un maestro…): arma cursos, clases, inscripciones y administra a alumnos, maestros y tutores. **Un líder no coordina por serlo**: sin la marca no ve nada de la Escuela. Solo el propietario da o quita la marca |

**Privacidad de menores:** el maestro externo (rol `maestro`) no lee la ficha del alumno (nacimiento, meta, tutores); el maestro del ministerio y la coordinación sí. Los comentarios solo los leen el alumno, su tutor y quien gestiona la clase.

La seguridad vive en RLS (migraciones 9, 11, 12 y **14**) y se prueba con `npm run test:rls` (`scripts/prueba-escuela.mjs` y `scripts/prueba-acceso-escuela.mjs`).

Qué lee cada quien: cursos, niveles y materiales los lee solo quien participa en la Escuela (coordinación, maestros de alguna clase, alumnos inscritos y tutores) —`participa_escuela()`—. Los integrantes de la Escuela (alumno, maestro, tutor) solo los edita, desactiva o quita quien coordina. Los nombres de esos integrantes siguen siendo legibles por la base para los demás integrantes del grupo (así funcionan los perfiles), pero ninguna clase, ficha, comentario o práctica; la pantalla de Equipo los oculta a quien no coordina.

## Modelo
cursos → clases (maestro, horario, lugar, grupal/individual) → inscripciones (alumno) · sesiones (+ asistencia) ·
prácticas semanales (a toda la clase o a un alumno; pueden apuntar a una canción) → registro de práctica (minutos, nota).
Perfil de alumno (nacimiento, objetivo) y tutores (tutor ↔ alumno).

## Fases
1. **Base** — cursos, clases, inscripciones, sesiones con asistencia, práctica semanal con check. *(hecha)*
2. **Acompañamiento** — materiales por curso (enlaces y archivos), comentarios del maestro, modo práctica con temporizador y metrónomo, historial de semanas, tempo sugerido por práctica. *(hecha; migración 11)*
3. **Crecimiento** — niveles editables por curso, hitos que marca el maestro, recomendación "listo para el equipo" y paso a músico/voz/sonido/multimedia por un líder, sendero visible para el alumno y su tutor. *(hecha; migración 12)*
4. **Extras** — grabaciones, recordatorios push (ya existen las notificaciones), afinador.

## Diseño
- Una planta que crece: cada semana de práctica suma una hoja (sin ranking; es personal).
- El nivel como sendero con estaciones; la semana en siete puntos.
- Color por curso con los chips que ya usa la app.
- Maestro: lista de clase con pase de lista en dos toques.
- Menores: botones grandes y lenguaje corto.
