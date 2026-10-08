-- =========================================================
-- Ministerio de Alabanza — esquema inicial (Supabase / Postgres)
-- Multi-grupo: todo cuelga de grupo_id. Permisos con RLS.
-- Punto de partida: revisar y convertir en migraciones.
-- =========================================================

create extension if not exists pgcrypto;

-- ---------- Tipos ----------
create type rol_grupo     as enum ('propietario','lider','musico','voz','sonido','alumno');
create type fase_cancion  as enum ('nueva','aprendiendo','ensayada','lista');
create type estado_turno  as enum ('pendiente','confirmado','no_puede');
create type tipo_item     as enum ('cancion','parte');
create type estado_prop   as enum ('nueva','aprobada','descartada');

-- ---------- Núcleo ----------
create table grupos (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  slug        text not null unique,                 -- para la página pública /p/:slug
  activo      boolean not null default true,         -- grupo 2 = false hasta que lo usen
  created_at  timestamptz not null default now()
);

create table perfiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nombre      text not null,
  avatar_url  text,
  tema        text not null default 'salvia' check (tema in ('salvia','rosa')),
  created_at  timestamptz not null default now()
);

create table miembros (
  id           uuid primary key default gen_random_uuid(),
  grupo_id     uuid not null references grupos(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  rol          rol_grupo not null default 'musico',
  descripcion  text,                                 -- "Voz 1", "Batería", "Consola y proyección"
  puestos      text[] not null default '{}',         -- puestos que puede cubrir: {'Voz 2','Dirige'}
  activo       boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (grupo_id, user_id)
);

create table invitaciones (
  id          uuid primary key default gen_random_uuid(),
  grupo_id    uuid not null references grupos(id) on delete cascade,
  email       text not null,
  rol         rol_grupo not null default 'musico',
  token       text not null unique default encode(gen_random_bytes(24),'hex'),
  aceptada    boolean not null default false,
  creada_por  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

-- ---------- Funciones de permisos (security definer) ----------
create or replace function mi_rol(g uuid) returns rol_grupo
language sql stable security definer set search_path = public as $$
  select rol from miembros where grupo_id = g and user_id = auth.uid() and activo limit 1
$$;

create or replace function es_miembro(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from miembros where grupo_id = g and user_id = auth.uid() and activo)
$$;

create or replace function es_lider(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(mi_rol(g) in ('propietario','lider'), false)
$$;

create or replace function es_equipo(g uuid) returns boolean   -- todos menos alumno
language sql stable security definer set search_path = public as $$
  select coalesce(mi_rol(g) in ('propietario','lider','musico','voz','sonido'), false)
$$;

create or replace function ve_cancionero(g uuid) returns boolean -- líder, músico, voz
language sql stable security definer set search_path = public as $$
  select coalesce(mi_rol(g) in ('propietario','lider','musico','voz'), false)
$$;

create or replace function mi_miembro_id(g uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select id from miembros where grupo_id = g and user_id = auth.uid() and activo limit 1
$$;

-- ---------- Cancionero ----------
create table canciones (
  id             uuid primary key default gen_random_uuid(),
  grupo_id       uuid not null references grupos(id) on delete cascade,
  titulo         text not null,
  autor          text,
  tono_original  text,                                -- 'D', 'Bb', 'F#m'
  bpm            int,
  minutos        int default 4,
  categoria      text check (categoria in ('alabanza','adoracion')),
  letra_chordpro text,                                -- "[D]Abre las [G]puertas…"
  audio_ref_url  text,
  fase           fase_cancion not null default 'nueva',
  publica        boolean not null default false,
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table cancion_pendientes (                      -- checklist por fase
  id         uuid primary key default gen_random_uuid(),
  cancion_id uuid not null references canciones(id) on delete cascade,
  fase       fase_cancion not null,
  texto      text not null,
  hecho      boolean not null default false,
  orden      int not null default 0
);

create table cancion_tonos (                           -- tono por cantante
  cancion_id uuid not null references canciones(id) on delete cascade,
  miembro_id uuid not null references miembros(id) on delete cascade,
  tono       text not null,
  primary key (cancion_id, miembro_id)
);

create table cancion_dominio (                         -- "Ya me la sé"
  cancion_id uuid not null references canciones(id) on delete cascade,
  miembro_id uuid not null references miembros(id) on delete cascade,
  ya_la_se   boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (cancion_id, miembro_id)
);

create table guias (                                   -- audios guía por parte (Storage)
  id           uuid primary key default gen_random_uuid(),
  cancion_id   uuid not null references canciones(id) on delete cascade,
  parte        text not null,                        -- 'Voz 2', 'Bajo'
  storage_path text not null,
  duracion_s   int
);

-- ---------- Servicios ----------
create table servicios (
  id          uuid primary key default gen_random_uuid(),
  grupo_id    uuid not null references grupos(id) on delete cascade,
  fecha       timestamptz not null,
  tipo        text not null,                         -- 'Servicio dominical', 'Culto de oración', 'Santa Cena'
  dirige      uuid references miembros(id),
  llegada     text,                                  -- '8:30 a. m.'
  publicado   boolean not null default false,
  notas       text,
  created_at  timestamptz not null default now()
);

create table servicio_items (
  id           uuid primary key default gen_random_uuid(),
  servicio_id  uuid not null references servicios(id) on delete cascade,
  orden        int not null,
  tipo         tipo_item not null,
  cancion_id   uuid references canciones(id),
  momento      text,                                 -- 'Bienvenida','Adoración','Ofrenda'
  dirige       uuid references miembros(id),
  tono         text,
  parte_titulo text,                                 -- si tipo = 'parte': 'Predicación'
  responsable  text,                                 -- 'Pastor'
  minutos      int,
  check ((tipo = 'cancion' and cancion_id is not null) or (tipo = 'parte' and parte_titulo is not null))
);

-- Para el aviso de repetición: última vez que se cantó cada canción
create view v_ultima_vez as
  select si.cancion_id, s.grupo_id, max(s.fecha) as ultima_fecha
  from servicio_items si join servicios s on s.id = si.servicio_id
  where si.tipo = 'cancion' and s.fecha < now()
  group by si.cancion_id, s.grupo_id;

-- ---------- Turnos ----------
create table puestos (                                 -- catálogo por grupo
  id        uuid primary key default gen_random_uuid(),
  grupo_id  uuid not null references grupos(id) on delete cascade,
  nombre    text not null,                           -- 'Dirige','Voz 1','Voz 2','Teclado','Guitarra','Bajo','Batería','Sonido'
  orden     int not null default 0,
  unique (grupo_id, nombre)
);

create table turnos (
  id           uuid primary key default gen_random_uuid(),
  servicio_id  uuid not null references servicios(id) on delete cascade,
  puesto_id    uuid not null references puestos(id),
  miembro_id   uuid references miembros(id),
  estado       estado_turno not null default 'pendiente',
  respondido_at timestamptz,
  unique (servicio_id, puesto_id)
);

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

create table ensayo_asistencia (
  ensayo_id  uuid not null references ensayos(id) on delete cascade,
  miembro_id uuid not null references miembros(id) on delete cascade,
  va         boolean,
  primary key (ensayo_id, miembro_id)
);

create table ensayo_canciones (
  ensayo_id  uuid not null references ensayos(id) on delete cascade,
  cancion_id uuid not null references canciones(id) on delete cascade,
  foco       text,                                   -- 'Voz 2 armoniza en el coro'
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

-- ---------- Público: propuestas y votos ----------
create table propuestas (                              -- "¿Falta una canción?"
  id          uuid primary key default gen_random_uuid(),
  grupo_id    uuid not null references grupos(id) on delete cascade,
  titulo      text not null check (length(titulo) between 1 and 120),
  autor       text check (length(autor) <= 120),
  contacto    text check (length(contacto) <= 80),
  estado      estado_prop not null default 'nueva',
  created_at  timestamptz not null default now()
);

create table votos (                                   -- "Proponer" con un toque
  cancion_id uuid not null references canciones(id) on delete cascade,
  device_id  uuid not null,                          -- UUID guardado en localStorage
  created_at timestamptz not null default now(),
  primary key (cancion_id, device_id)
);

-- ---------- Avisos ----------
create table avisos (
  id         uuid primary key default gen_random_uuid(),
  grupo_id   uuid not null references grupos(id) on delete cascade,
  autor      uuid references miembros(id),
  texto      text not null,
  created_at timestamptz not null default now()
);

-- =========================================================
-- RLS
-- =========================================================
alter table grupos             enable row level security;
alter table perfiles           enable row level security;
alter table miembros           enable row level security;
alter table invitaciones       enable row level security;
alter table canciones          enable row level security;
alter table cancion_pendientes enable row level security;
alter table cancion_tonos      enable row level security;
alter table cancion_dominio    enable row level security;
alter table guias              enable row level security;
alter table servicios          enable row level security;
alter table servicio_items     enable row level security;
alter table puestos            enable row level security;
alter table turnos             enable row level security;
alter table indisponibilidad   enable row level security;
alter table ensayos            enable row level security;
alter table ensayo_asistencia  enable row level security;
alter table ensayo_canciones   enable row level security;
alter table ensayo_repaso      enable row level security;
alter table ensayo_notas       enable row level security;
alter table propuestas         enable row level security;
alter table votos              enable row level security;
alter table avisos             enable row level security;

-- Grupos y perfiles
create policy grupos_sel   on grupos   for select using (es_miembro(id));
create policy grupos_upd   on grupos   for update using (mi_rol(id) = 'propietario');
create policy perfil_sel   on perfiles for select using (
  id = auth.uid() or exists (select 1 from miembros a join miembros b on a.grupo_id = b.grupo_id
                             where a.user_id = auth.uid() and b.user_id = perfiles.id));
create policy perfil_ins   on perfiles for insert with check (id = auth.uid());
create policy perfil_upd   on perfiles for update using (id = auth.uid());

-- Miembros: todos ven a su grupo; solo líderes cambian roles.
-- Nadie puede quitarle el rol al propietario, y solo el propietario nombra líderes (hacerlo cumplir con un trigger).
create policy miem_sel on miembros for select using (es_miembro(grupo_id));
create policy miem_upd on miembros for update using (es_lider(grupo_id)) with check (es_lider(grupo_id));
create policy miem_del on miembros for delete using (es_lider(grupo_id) and rol <> 'propietario');

create policy inv_all on invitaciones for all using (es_lider(grupo_id)) with check (es_lider(grupo_id));
-- Aceptar invitación: hacerlo con una función RPC security definer `aceptar_invitacion(token)`.

-- Cancionero
create policy can_sel on canciones for select using (ve_cancionero(grupo_id) or (mi_rol(grupo_id) = 'sonido' and fase = 'lista'));
create policy can_ins on canciones for insert with check (es_lider(grupo_id));
create policy can_upd on canciones for update using (es_lider(grupo_id));
create policy can_del on canciones for delete using (es_lider(grupo_id));

create policy pen_sel on cancion_pendientes for select using (exists (select 1 from canciones c where c.id = cancion_id and ve_cancionero(c.grupo_id)));
create policy pen_mod on cancion_pendientes for all    using (exists (select 1 from canciones c where c.id = cancion_id and es_lider(c.grupo_id)));

create policy ton_sel on cancion_tonos for select using (exists (select 1 from canciones c where c.id = cancion_id and ve_cancionero(c.grupo_id)));
create policy ton_mod on cancion_tonos for all    using (exists (select 1 from canciones c where c.id = cancion_id and es_lider(c.grupo_id)));

create policy dom_sel on cancion_dominio for select using (exists (select 1 from canciones c where c.id = cancion_id and ve_cancionero(c.grupo_id)));
create policy dom_mod on cancion_dominio for all    using (exists (select 1 from canciones c where c.id = cancion_id and miembro_id = mi_miembro_id(c.grupo_id)))
                                         with check (exists (select 1 from canciones c where c.id = cancion_id and miembro_id = mi_miembro_id(c.grupo_id)));

create policy gui_sel on guias for select using (exists (select 1 from canciones c where c.id = cancion_id and ve_cancionero(c.grupo_id)));
create policy gui_mod on guias for all    using (exists (select 1 from canciones c where c.id = cancion_id and es_lider(c.grupo_id)));

-- Servicios: equipo ve, líder edita
create policy srv_sel on servicios      for select using (es_equipo(grupo_id));
create policy srv_mod on servicios      for all    using (es_lider(grupo_id)) with check (es_lider(grupo_id));
create policy itm_sel on servicio_items for select using (exists (select 1 from servicios s where s.id = servicio_id and es_equipo(s.grupo_id)));
create policy itm_mod on servicio_items for all    using (exists (select 1 from servicios s where s.id = servicio_id and es_lider(s.grupo_id)));

-- Turnos: equipo ve; líder asigna; cada quien responde el suyo
create policy pue_sel on puestos for select using (es_equipo(grupo_id));
create policy pue_mod on puestos for all    using (es_lider(grupo_id));

create policy tur_sel on turnos for select using (exists (select 1 from servicios s where s.id = servicio_id and es_equipo(s.grupo_id)));
create policy tur_lid on turnos for all    using (exists (select 1 from servicios s where s.id = servicio_id and es_lider(s.grupo_id)));
create policy tur_own on turnos for update using (exists (select 1 from servicios s where s.id = servicio_id and miembro_id = mi_miembro_id(s.grupo_id)));
-- Importante: con tur_own el miembro solo debe poder cambiar `estado` y `respondido_at`.
-- Hacerlo cumplir con una RPC `responder_turno(turno_id, estado)` o un trigger que bloquee otros cambios.

create policy ind_sel on indisponibilidad for select using (exists (select 1 from miembros m where m.id = miembro_id and es_equipo(m.grupo_id)));
create policy ind_own on indisponibilidad for all    using (exists (select 1 from miembros m where m.id = miembro_id and m.user_id = auth.uid()))
                                          with check (exists (select 1 from miembros m where m.id = miembro_id and m.user_id = auth.uid()));

-- Ensayos
create policy ens_sel on ensayos for select using (es_equipo(grupo_id));
create policy ens_mod on ensayos for all    using (es_lider(grupo_id)) with check (es_lider(grupo_id));

create policy asi_sel on ensayo_asistencia for select using (exists (select 1 from ensayos e where e.id = ensayo_id and es_equipo(e.grupo_id)));
create policy asi_own on ensayo_asistencia for all    using (exists (select 1 from ensayos e where e.id = ensayo_id and miembro_id = mi_miembro_id(e.grupo_id)))
                                           with check (exists (select 1 from ensayos e where e.id = ensayo_id and miembro_id = mi_miembro_id(e.grupo_id)));

create policy ecn_sel on ensayo_canciones for select using (exists (select 1 from ensayos e where e.id = ensayo_id and es_equipo(e.grupo_id)));
create policy ecn_mod on ensayo_canciones for all    using (exists (select 1 from ensayos e where e.id = ensayo_id and es_lider(e.grupo_id)));

create policy rep_sel on ensayo_repaso for select using (exists (select 1 from ensayos e where e.id = ensayo_id and es_equipo(e.grupo_id)));
create policy rep_own on ensayo_repaso for all    using (exists (select 1 from ensayos e where e.id = ensayo_id and miembro_id = mi_miembro_id(e.grupo_id)))
                                       with check (exists (select 1 from ensayos e where e.id = ensayo_id and miembro_id = mi_miembro_id(e.grupo_id)));

create policy not_sel on ensayo_notas for select using (exists (select 1 from ensayos e where e.id = ensayo_id and es_equipo(e.grupo_id)));
create policy not_ins on ensayo_notas for insert with check (exists (select 1 from ensayos e where e.id = ensayo_id and miembro_id = mi_miembro_id(e.grupo_id)));
create policy not_del on ensayo_notas for delete using (exists (select 1 from ensayos e where e.id = ensayo_id and (miembro_id = mi_miembro_id(e.grupo_id) or es_lider(e.grupo_id))));

-- Avisos
create policy avi_sel on avisos for select using (es_miembro(grupo_id));
create policy avi_mod on avisos for all    using (es_lider(grupo_id)) with check (es_lider(grupo_id));

-- Propuestas: el público inserta (anon); solo líderes leen y gestionan
create policy pro_ins on propuestas for insert to anon, authenticated
  with check (estado = 'nueva' and exists (select 1 from grupos g where g.id = grupo_id and g.activo));
create policy pro_lid on propuestas for select using (es_lider(grupo_id));
create policy pro_upd on propuestas for update using (es_lider(grupo_id));

-- Votos: el público inserta o borra el suyo; líderes ven el conteo
create policy vot_ins on votos for insert to anon, authenticated
  with check (exists (select 1 from canciones c where c.id = cancion_id and c.publica));
create policy vot_sel on votos for select using (exists (select 1 from canciones c where c.id = cancion_id and es_lider(c.grupo_id)));
-- Quitar el voto: RPC `quitar_voto(cancion_id, device_id)` security definer.
-- Rate limit (envíos por IP o dispositivo): Edge Function delante de propuestas y votos.

-- =========================================================
-- Vistas públicas (sin login) — solo lo publicado
-- =========================================================
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
-- Nunca exponer letra_chordpro, guías ni datos de miembros en las vistas públicas.

-- =========================================================
-- Storage: bucket privado 'guias' — leer: ve_cancionero; subir: es_lider (políticas en storage.objects).
-- =========================================================
