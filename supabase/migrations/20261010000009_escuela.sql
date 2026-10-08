-- =========================================================
-- Migración 9: Escuela (formación de músicos para el grupo de alabanza)
-- Cursos editables → clases (grupales o individuales) → alumnos, sesiones con asistencia,
-- práctica semanal y registro de práctica. Tutores para menores.
-- Coordinador de Escuela = cualquier integrante con la marca `coordina_escuela` (o un líder).
-- =========================================================

alter table miembros add column coordina_escuela boolean not null default false;

-- ---------- Funciones de permisos ----------
create function es_coord_escuela(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(es_lider(g), false) or exists(
    select 1 from miembros where grupo_id = g and user_id = auth.uid() and activo and coordina_escuela)
$$;

-- ¿este miembro soy yo?
create function soy_yo(m uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from miembros where id = m and user_id = auth.uid() and activo)
$$;

-- ---------- Tablas ----------
create table escuela_cursos (
  id          uuid primary key default gen_random_uuid(),
  grupo_id    uuid not null references grupos(id) on delete cascade,
  nombre      text not null check (length(nombre) between 1 and 60),
  descripcion text check (length(descripcion) <= 300),
  color       text not null default 'verde' check (color in ('verde','lila','rosa','ambar','azul')),
  orden       int not null default 0,
  activo      boolean not null default true,
  unique (grupo_id, nombre)
);

create table escuela_clases (
  id         uuid primary key default gen_random_uuid(),
  grupo_id   uuid not null references grupos(id) on delete cascade,
  curso_id   uuid not null references escuela_cursos(id) on delete restrict,
  nombre     text not null check (length(nombre) between 1 and 80),
  tipo       text not null default 'grupal' check (tipo in ('grupal','individual')),
  maestro_id uuid references miembros(id) on delete set null,
  horario    text check (length(horario) <= 80),
  lugar      text check (length(lugar) <= 80),
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);
create index on escuela_clases (grupo_id, activo);

create table escuela_alumnos (
  miembro_id uuid primary key references miembros(id) on delete cascade,
  nacimiento date,
  objetivo   text check (length(objetivo) <= 300),
  created_at timestamptz not null default now()
);

create table escuela_tutores (
  tutor_id  uuid not null references miembros(id) on delete cascade,
  alumno_id uuid not null references miembros(id) on delete cascade,
  primary key (tutor_id, alumno_id),
  check (tutor_id <> alumno_id)
);

create table escuela_inscripciones (
  clase_id  uuid not null references escuela_clases(id) on delete cascade,
  alumno_id uuid not null references miembros(id) on delete cascade,
  desde     date not null default current_date,
  activo    boolean not null default true,
  primary key (clase_id, alumno_id)
);
create index on escuela_inscripciones (alumno_id);

create table escuela_sesiones (
  id         uuid primary key default gen_random_uuid(),
  clase_id   uuid not null references escuela_clases(id) on delete cascade,
  fecha      timestamptz not null,
  tema       text check (length(tema) <= 120),
  notas      text check (length(notas) <= 1000),
  created_at timestamptz not null default now()
);
create index on escuela_sesiones (clase_id, fecha);

create table escuela_asistencia (
  sesion_id uuid not null references escuela_sesiones(id) on delete cascade,
  alumno_id uuid not null references miembros(id) on delete cascade,
  estado    text not null check (estado in ('presente','ausente','justificado')),
  primary key (sesion_id, alumno_id)
);

-- Tarea de la semana. alumno_id vacío = para toda la clase.
create table escuela_practicas (
  id           uuid primary key default gen_random_uuid(),
  clase_id     uuid not null references escuela_clases(id) on delete cascade,
  alumno_id    uuid references miembros(id) on delete cascade,
  semana       date not null,                      -- lunes de la semana
  titulo       text not null check (length(titulo) between 1 and 120),
  detalle      text check (length(detalle) <= 1000),
  minutos_meta int check (minutos_meta between 1 and 600),
  cancion_id   uuid references canciones(id) on delete set null,
  enlace       text check (length(enlace) <= 300),
  created_at   timestamptz not null default now()
);
create index on escuela_practicas (clase_id, semana);

create table escuela_registro (
  id          uuid primary key default gen_random_uuid(),
  practica_id uuid not null references escuela_practicas(id) on delete cascade,
  alumno_id   uuid not null references miembros(id) on delete cascade,
  fecha       date not null default current_date,
  minutos     int not null default 0 check (minutos between 0 and 600),
  nota        text check (length(nota) <= 500),
  created_at  timestamptz not null default now(),
  unique (practica_id, alumno_id, fecha)
);
create index on escuela_registro (alumno_id, fecha);

-- ---------- Funciones que dependen de las tablas ----------
-- ¿soy tutor de este alumno?
create function es_tutor_de(a uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from escuela_tutores t join miembros m on m.id = t.tutor_id
                where t.alumno_id = a and m.user_id = auth.uid() and m.activo)
$$;

create function es_maestro_de(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from escuela_clases where id = c and maestro_id is not null and soy_yo(maestro_id))
$$;

create function gestiona_clase(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select es_coord_escuela(grupo_id) from escuela_clases where id = c), false) or es_maestro_de(c)
$$;

-- Veo la clase si la gestiono, o si yo (o mi hijo, siendo tutor) estoy inscrito
create function ve_clase(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select gestiona_clase(c) or exists(
    select 1 from escuela_inscripciones where clase_id = c and (soy_yo(alumno_id) or es_tutor_de(alumno_id)))
$$;

create function clase_de_sesion(s uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select clase_id from escuela_sesiones where id = s
$$;

create function clase_de_practica(p uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select clase_id from escuela_practicas where id = p
$$;

-- La práctica es para toda la clase o para mí (o mi hijo)
create function ve_practica(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from escuela_practicas x where x.id = p and (
    gestiona_clase(x.clase_id)
    or (ve_clase(x.clase_id) and (x.alumno_id is null or soy_yo(x.alumno_id) or es_tutor_de(x.alumno_id)))))
$$;

-- ¿le enseño a este alumno en alguna clase?
create function ensena_a(a uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from escuela_inscripciones i where i.alumno_id = a and es_maestro_de(i.clase_id))
$$;

create function grupo_de_miembro(m uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select grupo_id from miembros where id = m
$$;

-- ---------- RLS ----------
alter table escuela_cursos         enable row level security;
alter table escuela_clases         enable row level security;
alter table escuela_alumnos        enable row level security;
alter table escuela_tutores        enable row level security;
alter table escuela_inscripciones  enable row level security;
alter table escuela_sesiones       enable row level security;
alter table escuela_asistencia     enable row level security;
alter table escuela_practicas      enable row level security;
alter table escuela_registro       enable row level security;

create policy ecu_sel on escuela_cursos for select using (es_miembro(grupo_id));
create policy ecu_mod on escuela_cursos for all using (es_coord_escuela(grupo_id)) with check (es_coord_escuela(grupo_id));

create policy ecl_sel on escuela_clases for select using (ve_clase(id));
create policy ecl_mod on escuela_clases for all using (es_coord_escuela(grupo_id)) with check (es_coord_escuela(grupo_id));

create policy eal_sel on escuela_alumnos for select
  using (soy_yo(miembro_id) or es_tutor_de(miembro_id) or ensena_a(miembro_id) or es_coord_escuela(grupo_de_miembro(miembro_id)));
create policy eal_mod on escuela_alumnos for all
  using (es_coord_escuela(grupo_de_miembro(miembro_id))) with check (es_coord_escuela(grupo_de_miembro(miembro_id)));

create policy etu_sel on escuela_tutores for select
  using (soy_yo(tutor_id) or soy_yo(alumno_id) or es_coord_escuela(grupo_de_miembro(alumno_id)));
create policy etu_mod on escuela_tutores for all
  using (es_coord_escuela(grupo_de_miembro(alumno_id))) with check (es_coord_escuela(grupo_de_miembro(alumno_id)));

-- Un alumno ve su propia inscripción, no la de sus compañeros
create policy ein_sel on escuela_inscripciones for select
  using (gestiona_clase(clase_id) or soy_yo(alumno_id) or es_tutor_de(alumno_id));
create policy ein_mod on escuela_inscripciones for all
  using (es_coord_escuela((select grupo_id from escuela_clases where id = clase_id)))
  with check (es_coord_escuela((select grupo_id from escuela_clases where id = clase_id)));

create policy ese_sel on escuela_sesiones for select using (ve_clase(clase_id));
create policy ese_mod on escuela_sesiones for all using (gestiona_clase(clase_id)) with check (gestiona_clase(clase_id));

create policy eas_sel on escuela_asistencia for select
  using (gestiona_clase(clase_de_sesion(sesion_id)) or soy_yo(alumno_id) or es_tutor_de(alumno_id));
create policy eas_mod on escuela_asistencia for all
  using (gestiona_clase(clase_de_sesion(sesion_id))) with check (gestiona_clase(clase_de_sesion(sesion_id)));

create policy epr_sel on escuela_practicas for select using (ve_practica(id));
create policy epr_mod on escuela_practicas for all using (gestiona_clase(clase_id)) with check (gestiona_clase(clase_id));

-- El alumno (o su tutor) anota su práctica; maestro y coordinación la leen
create policy ere_sel on escuela_registro for select
  using (gestiona_clase(clase_de_practica(practica_id)) or soy_yo(alumno_id) or es_tutor_de(alumno_id));
create policy ere_mod on escuela_registro for all
  using ((soy_yo(alumno_id) or es_tutor_de(alumno_id)) and ve_practica(practica_id))
  with check ((soy_yo(alumno_id) or es_tutor_de(alumno_id)) and ve_practica(practica_id));

-- ---------- Cursos de entrada (editables) ----------
insert into escuela_cursos (grupo_id, nombre, color, orden)
select g.id, c.nombre, c.color, c.orden from grupos g
cross join (values ('Piano y teclados','lila',1), ('Guitarra','verde',2), ('Bajo','azul',3),
                   ('Batería','ambar',4), ('Voz','rosa',5), ('Teoría musical','azul',6)) as c(nombre, color, orden);
