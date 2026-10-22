-- =========================================================
-- Migración 14: la Escuela es del propietario.
-- Antes, cualquier líder coordinaba la Escuela por serlo. Ahora solo la coordinan:
--   · el propietario, y
--   · quien el propietario marque con `coordina_escuela` (un líder, un músico, un maestro…).
-- Un líder sin esa marca no ve clases, alumnos, fichas, comentarios ni prácticas.
-- La marca solo la puede dar o quitar el propietario.
-- =========================================================

create or replace function es_coord_escuela(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(mi_rol(g) = 'propietario', false) or exists(
    select 1 from miembros where grupo_id = g and user_id = auth.uid() and activo and coordina_escuela)
$$;

-- Protección de `miembros` (se reemplaza guard_miembros con todo lo anterior + las reglas de la Escuela)
--   · los integrantes de la Escuela (alumno, maestro, tutor) solo los toca quien coordina la Escuela
--   · solo el propietario da o quita el acceso a la Escuela
create or replace function guard_miembros() returns trigger
language plpgsql security definer set search_path = public as $$
declare yo rol_grupo;
begin
  if auth.uid() is null then
    return coalesce(new, old);
  end if;

  yo := mi_rol(coalesce(new.grupo_id, old.grupo_id));

  -- Integrantes de la Escuela: ni un líder sin acceso puede editarlos, desactivarlos o quitarlos
  if old.rol in ('alumno','maestro','tutor') and not es_coord_escuela(old.grupo_id) then
    raise exception 'Solo quien coordina la Escuela administra a alumnos, maestros y tutores';
  end if;

  if tg_op = 'DELETE' then
    if old.rol = 'propietario' then raise exception 'No se puede quitar al propietario'; end if;
    if old.rol = 'lider' and yo <> 'propietario' then raise exception 'Solo el propietario quita líderes'; end if;
    return old;
  end if;

  if new.grupo_id <> old.grupo_id or new.user_id <> old.user_id then
    raise exception 'No se puede mover un integrante de grupo';
  end if;

  if new.coordina_escuela is distinct from old.coordina_escuela then
    if yo is distinct from 'propietario' then
      raise exception 'Solo el propietario da o quita el acceso a la Escuela';
    end if;
    if new.coordina_escuela and new.rol in ('propietario','alumno','tutor') then
      raise exception 'Ese rol no puede coordinar la Escuela';
    end if;
  end if;

  if new.rol is distinct from old.rol then
    if old.rol = 'propietario' or new.rol = 'propietario' then
      raise exception 'El rol de propietario no se puede cambiar';
    end if;
    if (old.rol = 'lider' or new.rol = 'lider') and yo <> 'propietario' then
      raise exception 'Solo el propietario nombra líderes';
    end if;
    if old.user_id = auth.uid() then
      raise exception 'No puedes cambiar tu propio rol';
    end if;
    -- Pasar a alguien a (o desde) un rol de la Escuela es trabajo de la coordinación
    if new.rol in ('alumno','maestro','tutor') and not es_coord_escuela(new.grupo_id) then
      raise exception 'Solo quien coordina la Escuela asigna roles de la Escuela';
    end if;
    -- Un alumno o tutor no coordina nada: al cambiar a esos roles se limpia la marca
    if new.rol in ('alumno','tutor') then new.coordina_escuela := false; end if;
  end if;

  if old.rol in ('propietario','lider') and old.user_id <> auth.uid() and yo <> 'propietario'
     and new.activo is distinct from old.activo then
    raise exception 'Solo el propietario desactiva a un líder';
  end if;

  return new;
end $$;

-- =========================================================
-- Lo que antes podía leer cualquier integrante del grupo (cursos, niveles, materiales y sus archivos)
-- ahora solo lo lee quien participa en la Escuela: la coordinación, los maestros de alguna clase,
-- los alumnos inscritos y los tutores. Un líder sin acceso (o un músico que no enseña) no ve nada.
-- =========================================================
create or replace function participa_escuela(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(mi_rol(g) in ('alumno','maestro','tutor'), false)
    or es_coord_escuela(g)
    or exists (select 1 from escuela_clases c join miembros m on m.id = c.maestro_id
               where c.grupo_id = g and c.activo and m.user_id = auth.uid() and m.activo)
    or exists (select 1 from escuela_inscripciones i join miembros m on m.id = i.alumno_id
               join escuela_clases c on c.id = i.clase_id
               where c.grupo_id = g and i.activo and m.user_id = auth.uid() and m.activo)
$$;

drop policy ecu_sel on escuela_cursos;
create policy ecu_sel on escuela_cursos for select using (participa_escuela(grupo_id));

drop policy eniv_sel on escuela_niveles;
create policy eniv_sel on escuela_niveles for select
  using (participa_escuela((select grupo_id from escuela_cursos where id = curso_id)));

drop policy emat_sel on escuela_materiales;
create policy emat_sel on escuela_materiales for select using (participa_escuela(grupo_id));

drop policy escuela_leer on storage.objects;
create policy escuela_leer on storage.objects for select to authenticated
  using (bucket_id = 'escuela' and participa_escuela(((storage.foldername(name))[1])::uuid));

-- Como las funciones nuevas nacen cerradas a visitantes (migración 13), solo hay que darles permiso a quien tiene sesión
grant execute on function participa_escuela(uuid) to authenticated, service_role;
