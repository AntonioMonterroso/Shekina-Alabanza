-- Migración 8: dos roles nuevos para la Escuela.
--  · maestro: quien enseña pero no está en el equipo de alabanza (externo). Solo ve la Escuela.
--  · tutor: papá o mamá de un alumno menor; solo ve el avance de sus hijos.
-- Va sola porque un valor nuevo de enum no se puede usar en el mismo bloque que lo crea.
alter type rol_grupo add value if not exists 'maestro';
alter type rol_grupo add value if not exists 'tutor';
