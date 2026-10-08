-- =========================================================
-- Migración 11: Escuela fase 2
--  · El maestro externo ya no lee las fichas de los alumnos (protege a los menores)
--  · Tempo sugerido en la práctica (metrónomo)
--  · Materiales por curso (enlaces y archivos)
--  · Comentarios del maestro a cada alumno
-- =========================================================

-- ---------- Fichas: el maestro externo no las ve ----------
drop policy eal_sel on escuela_alumnos;
create policy eal_sel on escuela_alumnos for select using (
  soy_yo(miembro_id)
  or es_tutor_de(miembro_id)
  or es_coord_escuela(grupo_de_miembro(miembro_id))
  or (ensena_a(miembro_id) and coalesce(mi_rol(grupo_de_miembro(miembro_id)), 'musico') <> 'maestro')
);

-- ---------- Tempo sugerido ----------
alter table escuela_practicas add column bpm int check (bpm between 30 and 240);

-- ---------- Quién puede subir material: coordinación o quien enseña alguna clase ----------
create function puede_subir_material(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select es_coord_escuela(g) or exists(
    select 1 from escuela_clases where grupo_id = g and activo and maestro_id is not null and soy_yo(maestro_id))
$$;

create table escuela_materiales (
  id           uuid primary key default gen_random_uuid(),
  grupo_id     uuid not null references grupos(id) on delete cascade,
  curso_id     uuid not null references escuela_cursos(id) on delete cascade,
  titulo       text not null check (length(titulo) between 1 and 120),
  url          text check (length(url) <= 500),
  storage_path text,
  created_by   uuid references miembros(id) on delete set null,
  created_at   timestamptz not null default now(),
  check ((url is not null) <> (storage_path is not null))   -- o es un enlace o es un archivo
);
create index on escuela_materiales (curso_id);

alter table escuela_materiales enable row level security;
create policy emat_sel on escuela_materiales for select using (es_miembro(grupo_id));
create policy emat_mod on escuela_materiales for all using (puede_subir_material(grupo_id)) with check (puede_subir_material(grupo_id));

-- Archivos: bucket privado 'escuela'. Ruta: {grupo_id}/{curso_id}/{archivo}
insert into storage.buckets (id, name, public) values ('escuela', 'escuela', false) on conflict do nothing;

create policy escuela_leer on storage.objects for select to authenticated
  using (bucket_id = 'escuela' and es_miembro(((storage.foldername(name))[1])::uuid));
create policy escuela_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'escuela' and puede_subir_material(((storage.foldername(name))[1])::uuid));
create policy escuela_cambiar on storage.objects for update to authenticated
  using (bucket_id = 'escuela' and puede_subir_material(((storage.foldername(name))[1])::uuid));
create policy escuela_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'escuela' and puede_subir_material(((storage.foldername(name))[1])::uuid));

-- ---------- Comentarios del maestro ----------
create table escuela_comentarios (
  id         uuid primary key default gen_random_uuid(),
  clase_id   uuid not null references escuela_clases(id) on delete cascade,
  alumno_id  uuid not null references miembros(id) on delete cascade,
  autor_id   uuid references miembros(id) on delete set null,
  texto      text not null check (length(texto) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index on escuela_comentarios (clase_id, alumno_id, created_at);

alter table escuela_comentarios enable row level security;
-- Los lee el alumno, su tutor y quien gestiona la clase
create policy eco_sel on escuela_comentarios for select
  using (gestiona_clase(clase_id) or soy_yo(alumno_id) or es_tutor_de(alumno_id));
-- Los escribe quien gestiona la clase, a nombre propio
create policy eco_ins on escuela_comentarios for insert
  with check (gestiona_clase(clase_id) and autor_id = mi_miembro_id((select grupo_id from escuela_clases where id = clase_id)));
-- Los borra su autor o la coordinación
create policy eco_del on escuela_comentarios for delete
  using (gestiona_clase(clase_id) and (soy_yo(autor_id) or es_coord_escuela((select grupo_id from escuela_clases where id = clase_id))));
