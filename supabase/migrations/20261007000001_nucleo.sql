-- =========================================================
-- Ministerio de Alabanza — migración 1: tipos, núcleo y funciones de permisos
-- Acceso solo con usuario y contraseña que entrega un líder (sin registro público).
-- =========================================================

create extension if not exists pgcrypto;

create type rol_grupo     as enum ('propietario','lider','musico','voz','sonido','multimedia','alumno');
create type fase_cancion  as enum ('nueva','aprendiendo','ensayada','lista');
create type estado_turno  as enum ('pendiente','confirmado','no_puede');
create type tipo_item     as enum ('cancion','parte');
create type estado_prop   as enum ('nueva','aprobada','descartada');

create table grupos (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  slug        text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table perfiles (
  id                     uuid primary key references auth.users(id) on delete cascade,
  usuario                text not null unique check (usuario ~ '^[a-z0-9._-]{3,30}$'),
  nombre                 text not null,
  avatar_url             text,
  tema                   text not null default 'salvia' check (tema in ('salvia','rosa')),
  debe_cambiar_password  boolean not null default false,
  created_at             timestamptz not null default now()
);

create table miembros (
  id           uuid primary key default gen_random_uuid(),
  grupo_id     uuid not null references grupos(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  rol          rol_grupo not null default 'musico',
  descripcion  text,
  puestos      text[] not null default '{}',
  activo       boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (grupo_id, user_id)
);
create index on miembros (user_id);

-- Solo existe un propietario por grupo
create unique index un_propietario_por_grupo on miembros (grupo_id) where rol = 'propietario';

-- ---------- Funciones de permisos (security definer) ----------
create function mi_rol(g uuid) returns rol_grupo
language sql stable security definer set search_path = public as $$
  select rol from miembros where grupo_id = g and user_id = auth.uid() and activo limit 1
$$;

create function es_miembro(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from miembros where grupo_id = g and user_id = auth.uid() and activo)
$$;

create function es_lider(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(mi_rol(g) in ('propietario','lider'), false)
$$;

-- todos los del equipo (todos menos alumno)
create function es_equipo(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(mi_rol(g) in ('propietario','lider','musico','voz','sonido','multimedia'), false)
$$;

-- letra completa con acordes: líder, músico, voz
create function ve_cancionero(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(mi_rol(g) in ('propietario','lider','musico','voz'), false)
$$;

-- controla la pantalla del templo: líder y multimedia
create function puede_proyectar(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(mi_rol(g) in ('propietario','lider','multimedia'), false)
$$;

create function mi_miembro_id(g uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select id from miembros where grupo_id = g and user_id = auth.uid() and activo limit 1
$$;

create function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ---------- Protección de roles ----------
-- Quién puede tocar `miembros`:
--   · el service role (Edge Functions) y las migraciones: sin restricción
--   · propietario: nombra y quita líderes
--   · líder: solo cambia músico/voz/sonido/multimedia/alumno
--   · nadie cambia el rol del propietario ni se sube el rol a sí mismo
create function guard_miembros() returns trigger
language plpgsql security definer set search_path = public as $$
declare yo rol_grupo;
begin
  if auth.uid() is null then
    return coalesce(new, old);
  end if;

  yo := mi_rol(coalesce(new.grupo_id, old.grupo_id));

  if tg_op = 'DELETE' then
    if old.rol = 'propietario' then raise exception 'No se puede quitar al propietario'; end if;
    if old.rol = 'lider' and yo <> 'propietario' then raise exception 'Solo el propietario quita líderes'; end if;
    return old;
  end if;

  if new.grupo_id <> old.grupo_id or new.user_id <> old.user_id then
    raise exception 'No se puede mover un integrante de grupo';
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
  end if;

  if old.rol in ('propietario','lider') and old.user_id <> auth.uid() and yo <> 'propietario'
     and new.activo is distinct from old.activo then
    raise exception 'Solo el propietario desactiva a un líder';
  end if;

  return new;
end $$;

create trigger trg_guard_miembros before update or delete on miembros
  for each row execute function guard_miembros();
