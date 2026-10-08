-- =========================================================
-- Migración 2: cancionero, servicios, turnos, ensayos, público y proyección
-- =========================================================

-- ---------- Cancionero ----------
create table canciones (
  id             uuid primary key default gen_random_uuid(),
  grupo_id       uuid not null references grupos(id) on delete cascade,
  titulo         text not null,
  autor          text,
  tono_original  text,
  bpm            int,
  minutos        int default 4,
  categoria      text check (categoria in ('alabanza','adoracion')),
  letra_chordpro text,
  audio_ref_url  text,
  fase           fase_cancion not null default 'nueva',
  publica        boolean not null default false,
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index on canciones (grupo_id);
create trigger trg_canciones_upd before update on canciones
  for each row execute function touch_updated_at();

-- Al pasar a `lista` se vuelve pública por defecto (el líder puede apagarlo después)
create function cancion_a_lista() returns trigger language plpgsql as $$
begin
  if new.fase = 'lista' and old.fase <> 'lista' then new.publica = true; end if;
  return new;
end $$;
create trigger trg_cancion_a_lista before update of fase on canciones
  for each row execute function cancion_a_lista();

create table cancion_pendientes (
  id         uuid primary key default gen_random_uuid(),
  cancion_id uuid not null references canciones(id) on delete cascade,
  fase       fase_cancion not null,
  texto      text not null,
  hecho      boolean not null default false,
  orden      int not null default 0
);
create index on cancion_pendientes (cancion_id);

create table cancion_tonos (
  cancion_id uuid not null references canciones(id) on delete cascade,
  miembro_id uuid not null references miembros(id) on delete cascade,
  tono       text not null,
  primary key (cancion_id, miembro_id)
);

create table cancion_dominio (
  cancion_id uuid not null references canciones(id) on delete cascade,
  miembro_id uuid not null references miembros(id) on delete cascade,
  ya_la_se   boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (cancion_id, miembro_id)
);

create table guias (
  id           uuid primary key default gen_random_uuid(),
  cancion_id   uuid not null references canciones(id) on delete cascade,
  parte        text not null,
  storage_path text not null,
  duracion_s   int
);
create index on guias (cancion_id);

-- ---------- Servicios ----------
create table servicios (
  id          uuid primary key default gen_random_uuid(),
  grupo_id    uuid not null references grupos(id) on delete cascade,
  fecha       timestamptz not null,
  tipo        text not null,
  dirige      uuid references miembros(id),
  llegada     text,
  publicado   boolean not null default false,
  notas       text,
  created_at  timestamptz not null default now()
);
create index on servicios (grupo_id, fecha);

create table servicio_items (
  id           uuid primary key default gen_random_uuid(),
  servicio_id  uuid not null references servicios(id) on delete cascade,
  orden        int not null,
  tipo         tipo_item not null,
  cancion_id   uuid references canciones(id),
  momento      text,
  dirige       uuid references miembros(id),
  tono         text,
  parte_titulo text,
  responsable  text,
  minutos      int,
  check ((tipo = 'cancion' and cancion_id is not null) or (tipo = 'parte' and parte_titulo is not null))
);
create index on servicio_items (servicio_id, orden);
create index on servicio_items (cancion_id);

-- La canción debe ser del mismo grupo que el servicio y estar en fase `lista`
create function valida_item() returns trigger language plpgsql as $$
declare g_srv uuid; g_can uuid; f fase_cancion;
begin
  if new.tipo = 'cancion' then
    select grupo_id into g_srv from servicios where id = new.servicio_id;
    select grupo_id, fase into g_can, f from canciones where id = new.cancion_id;
    if g_srv is distinct from g_can then raise exception 'La canción es de otro grupo'; end if;
    if f <> 'lista' and (tg_op = 'INSERT' or new.cancion_id is distinct from old.cancion_id) then
      raise exception 'Solo se pueden agregar canciones en fase lista';
    end if;
  end if;
  return new;
end $$;
create trigger trg_valida_item before insert or update on servicio_items
  for each row execute function valida_item();

-- Aviso de repetición: última vez que se cantó cada canción
create view v_ultima_vez with (security_invoker = true) as
  select si.cancion_id, s.grupo_id, max(s.fecha) as ultima_fecha
  from servicio_items si join servicios s on s.id = si.servicio_id
  where si.tipo = 'cancion' and s.fecha < now()
  group by si.cancion_id, s.grupo_id;

-- ---------- Turnos ----------
create table puestos (
  id        uuid primary key default gen_random_uuid(),
  grupo_id  uuid not null references grupos(id) on delete cascade,
  nombre    text not null,
  orden     int not null default 0,
  unique (grupo_id, nombre)
);

create table turnos (
  id            uuid primary key default gen_random_uuid(),
  servicio_id   uuid not null references servicios(id) on delete cascade,
  puesto_id     uuid not null references puestos(id),
  miembro_id    uuid references miembros(id),
  estado        estado_turno not null default 'pendiente',
  respondido_at timestamptz,
  unique (servicio_id, puesto_id)
);
create index on turnos (miembro_id);

-- Reasignar deja al nuevo en `pendiente`; un integrante solo cambia `estado` en su propio turno
create function guard_turnos() returns trigger
language plpgsql security definer set search_path = public as $$
declare g uuid;
begin
  if auth.uid() is null then return new; end if;
  select grupo_id into g from servicios where id = new.servicio_id;

  if new.miembro_id is distinct from old.miembro_id then
    if not es_lider(g) then raise exception 'Solo un líder reasigna turnos'; end if;
    new.estado = 'pendiente';
    new.respondido_at = null;
    return new;
  end if;

  if new.estado is distinct from old.estado then
    if not (es_lider(g) or old.miembro_id = mi_miembro_id(g)) then
      raise exception 'Este turno no es tuyo';
    end if;
    new.respondido_at = now();
  end if;

  if not es_lider(g) and (new.servicio_id <> old.servicio_id or new.puesto_id <> old.puesto_id) then
    raise exception 'Solo puedes responder tu turno';
  end if;
  return new;
end $$;
create trigger trg_guard_turnos before update on turnos
  for each row execute function guard_turnos();

create table indisponibilidad (
  miembro_id uuid not null references miembros(id) on delete cascade,
  fecha      date not null,
  primary key (miembro_id, fecha)
);

-- ---------- Ensayos ----------
create table ensayos (
  id          uuid primary key default gen_random_uuid(),
  grupo_id    uuid not null references grupos(id) on delete cascade,
  fecha       timestamptz not null,
  lugar       text,
  servicio_id uuid references servicios(id),
  created_at  timestamptz not null default now()
);
create index on ensayos (grupo_id, fecha);

create table ensayo_asistencia (
  ensayo_id  uuid not null references ensayos(id) on delete cascade,
  miembro_id uuid not null references miembros(id) on delete cascade,
  va         boolean,
  primary key (ensayo_id, miembro_id)
);

create table ensayo_canciones (
  ensayo_id  uuid not null references ensayos(id) on delete cascade,
  cancion_id uuid not null references canciones(id) on delete cascade,
  foco       text,
  orden      int not null default 0,
  primary key (ensayo_id, cancion_id)
);

create table ensayo_repaso (
  ensayo_id  uuid not null references ensayos(id) on delete cascade,
  cancion_id uuid not null references canciones(id) on delete cascade,
  miembro_id uuid not null references miembros(id) on delete cascade,
  primary key (ensayo_id, cancion_id, miembro_id)
);

create table ensayo_notas (
  id         uuid primary key default gen_random_uuid(),
  ensayo_id  uuid not null references ensayos(id) on delete cascade,
  miembro_id uuid not null references miembros(id),
  texto      text not null check (length(texto) <= 1000),
  created_at timestamptz not null default now()
);

-- ---------- Público ----------
create table propuestas (
  id          uuid primary key default gen_random_uuid(),
  grupo_id    uuid not null references grupos(id) on delete cascade,
  titulo      text not null check (length(titulo) between 1 and 120),
  autor       text check (length(autor) <= 120),
  contacto    text check (length(contacto) <= 80),
  device_id   uuid,
  estado      estado_prop not null default 'nueva',
  created_at  timestamptz not null default now()
);
create index on propuestas (grupo_id, estado);

create table votos (
  cancion_id uuid not null references canciones(id) on delete cascade,
  device_id  uuid not null,
  created_at timestamptz not null default now(),
  primary key (cancion_id, device_id)
);

create table avisos (
  id         uuid primary key default gen_random_uuid(),
  grupo_id   uuid not null references grupos(id) on delete cascade,
  autor      uuid references miembros(id),
  texto      text not null,
  created_at timestamptz not null default now()
);

-- ---------- Proyección (pantalla del templo) ----------
-- Una fila por grupo: lo que se muestra ahora. El operador la actualiza; la pantalla la escucha (Realtime).
create table proyeccion_estado (
  grupo_id    uuid primary key references grupos(id) on delete cascade,
  servicio_id uuid references servicios(id) on delete set null,
  item_id     uuid references servicio_items(id) on delete set null,
  diapositiva int not null default 0 check (diapositiva >= 0),
  modo        text not null default 'negro' check (modo in ('letra','negro','logo')),
  updated_by  uuid references auth.users(id),
  updated_at  timestamptz not null default now()
);
create trigger trg_proy_upd before update on proyeccion_estado
  for each row execute function touch_updated_at();
alter publication supabase_realtime add table proyeccion_estado;

-- Letra sin acordes ni directivas: para proyección y para quien no ve el cancionero.
-- Solo canciones que están en un servicio del grupo (líder y multimedia ven cualquiera de su grupo).
create function letra_proyeccion(p_cancion uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare g uuid; l text;
begin
  select grupo_id, letra_chordpro into g, l from canciones where id = p_cancion;
  if g is null then return null; end if;
  if not (puede_proyectar(g) or mi_rol(g) = 'sonido' and exists(
       select 1 from servicio_items si join servicios s on s.id = si.servicio_id
       where si.cancion_id = p_cancion and s.fecha >= now() - interval '1 day')) then
    raise exception 'Sin acceso';
  end if;
  -- quita [D], [G/B] … y deja las directivas de sección ({start_of_chorus}, [Coro]…) intactas más abajo
  return regexp_replace(coalesce(l,''), '\[[A-G][^\]]{0,7}\]', '', 'g');
end $$;

-- Sonido y multimedia ven título y tono de las canciones del servicio, sin letra con acordes
create function canciones_del_servicio(p_servicio uuid)
returns table (item_id uuid, orden int, cancion_id uuid, titulo text, autor text, tono text, momento text)
language sql stable security definer set search_path = public as $$
  select si.id, si.orden, c.id, c.titulo, c.autor, coalesce(si.tono, c.tono_original), si.momento
  from servicio_items si
  join servicios s on s.id = si.servicio_id
  join canciones c on c.id = si.cancion_id
  where si.servicio_id = p_servicio and si.tipo = 'cancion' and es_equipo(s.grupo_id)
  order by si.orden
$$;

-- Votar / quitar voto / proponer (anónimo, con límite por dispositivo, sin Edge Function)
create function votar_cancion(p_cancion uuid, p_device uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from canciones c join grupos g on g.id = c.grupo_id where c.id = p_cancion and c.publica and g.activo) then
    raise exception 'Canción no disponible';
  end if;
  if (select count(*) from votos where device_id = p_device and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'Demasiados votos, intenta más tarde';
  end if;
  insert into votos (cancion_id, device_id) values (p_cancion, p_device) on conflict do nothing;
end $$;

create function quitar_voto(p_cancion uuid, p_device uuid) returns void
language sql security definer set search_path = public as $$
  delete from votos where cancion_id = p_cancion and device_id = p_device
$$;

create function enviar_propuesta(p_slug text, p_titulo text, p_autor text, p_contacto text, p_device uuid) returns void
language plpgsql security definer set search_path = public as $$
declare g uuid;
begin
  select id into g from grupos where slug = p_slug and activo;
  if g is null then raise exception 'Grupo no disponible'; end if;
  if (select count(*) from propuestas where device_id = p_device and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Ya enviaste varias propuestas, intenta más tarde';
  end if;
  insert into propuestas (grupo_id, titulo, autor, contacto, device_id)
  values (g, left(trim(p_titulo),120), left(nullif(trim(p_autor),''),120), left(nullif(trim(p_contacto),''),80), p_device);
end $$;

grant execute on function votar_cancion, quitar_voto, enviar_propuesta to anon, authenticated;
grant execute on function letra_proyeccion, canciones_del_servicio to authenticated;

-- Vistas públicas: solo lo publicado, jamás letra con acordes ni datos de miembros
create view v_publico_servicios with (security_invoker = false) as
  select g.slug, s.id as servicio_id, s.fecha, s.tipo,
         si.orden, si.momento, c.titulo, c.autor, coalesce(si.tono, c.tono_original) as tono
  from servicios s
  join grupos g on g.id = s.grupo_id and g.activo
  join servicio_items si on si.servicio_id = s.id and si.tipo = 'cancion'
  join canciones c on c.id = si.cancion_id
  where s.publicado and s.fecha >= now() - interval '1 day';

create view v_publico_repertorio with (security_invoker = false) as
  select g.slug, c.id as cancion_id, c.titulo, c.autor, c.tono_original as tono, c.categoria,
         (select count(*) from votos v where v.cancion_id = c.id) as votos
  from canciones c join grupos g on g.id = c.grupo_id and g.activo
  where c.publica;

grant select on v_publico_servicios, v_publico_repertorio to anon, authenticated;
