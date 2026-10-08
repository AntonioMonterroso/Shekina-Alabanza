-- =========================================================
-- Migración 12: Escuela fase 3 — niveles, hitos y "listo para el equipo"
--  · Cada curso tiene niveles (editables); el maestro marca los que el alumno completa
--  · El maestro recomienda al alumno para el equipo; un líder lo pasa a músico, voz, sonido o multimedia
-- =========================================================

create table escuela_niveles (
  id          uuid primary key default gen_random_uuid(),
  curso_id    uuid not null references escuela_cursos(id) on delete cascade,
  orden       int not null,
  nombre      text not null check (length(nombre) between 1 and 60),
  descripcion text check (length(descripcion) <= 300),
  unique (curso_id, orden)
);

-- Un hito = el alumno completó ese nivel (aprobó su "audición")
create table escuela_hitos (
  id         uuid primary key default gen_random_uuid(),
  alumno_id  uuid not null references miembros(id) on delete cascade,
  nivel_id   uuid not null references escuela_niveles(id) on delete cascade,
  fecha      date not null default current_date,
  nota       text check (length(nota) <= 300),
  por        uuid references miembros(id) on delete set null,
  unique (alumno_id, nivel_id)
);
create index on escuela_hitos (alumno_id);

alter table escuela_alumnos
  add column listo_equipo_at   timestamptz,
  add column listo_equipo_nota text check (length(listo_equipo_nota) <= 300);

-- ---------- RLS ----------
alter table escuela_niveles enable row level security;
alter table escuela_hitos   enable row level security;

create policy eniv_sel on escuela_niveles for select
  using (es_miembro((select grupo_id from escuela_cursos where id = curso_id)));
create policy eniv_mod on escuela_niveles for all
  using (es_coord_escuela((select grupo_id from escuela_cursos where id = curso_id)))
  with check (es_coord_escuela((select grupo_id from escuela_cursos where id = curso_id)));

-- Los hitos (no son datos personales) los ve el alumno, su tutor, quien le enseña y la coordinación; los marca quien le enseña o coordina
create policy ehi_sel on escuela_hitos for select
  using (soy_yo(alumno_id) or es_tutor_de(alumno_id) or ensena_a(alumno_id) or es_coord_escuela(grupo_de_miembro(alumno_id)));
create policy ehi_mod on escuela_hitos for all
  using (ensena_a(alumno_id) or es_coord_escuela(grupo_de_miembro(alumno_id)))
  with check (ensena_a(alumno_id) or es_coord_escuela(grupo_de_miembro(alumno_id)));

-- ---------- Recomendar para el equipo ----------
-- Lo hace quien le enseña (incluido el maestro externo, que no puede leer la ficha) o la coordinación.
create function recomendar_alumno(p_alumno uuid, p_nota text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (ensena_a(p_alumno) or es_coord_escuela(grupo_de_miembro(p_alumno))) then
    raise exception 'Sin permiso';
  end if;
  insert into escuela_alumnos (miembro_id, listo_equipo_at, listo_equipo_nota)
  values (p_alumno, now(), nullif(left(trim(coalesce(p_nota, '')), 300), ''))
  on conflict (miembro_id) do update set listo_equipo_at = now(), listo_equipo_nota = excluded.listo_equipo_nota;
end $$;

create function quitar_recomendacion(p_alumno uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (ensena_a(p_alumno) or es_coord_escuela(grupo_de_miembro(p_alumno))) then
    raise exception 'Sin permiso';
  end if;
  update escuela_alumnos set listo_equipo_at = null, listo_equipo_nota = null where miembro_id = p_alumno;
end $$;

grant execute on function recomendar_alumno, quitar_recomendacion to authenticated;

-- ---------- Niveles de entrada para los cursos que ya existen ----------
insert into escuela_niveles (curso_id, orden, nombre)
select c.id, n.orden, n.nombre from escuela_cursos c
cross join (values (1, 'Fundamentos'), (2, 'Intermedio'), (3, 'Avanzado')) as n(orden, nombre);
