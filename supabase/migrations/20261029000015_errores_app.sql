-- =========================================================
-- Migración 15: registro de errores de la app.
-- Cuando algo falla en un teléfono queda anotado (pantalla, mensaje, versión) para que el propietario lo vea.
-- No se guarda contenido (letras, nombres de canciones ni datos personales): solo lo técnico.
-- Cualquiera con sesión puede reportar lo suyo (con tope por hora); solo el propietario lee, marca y borra.
-- =========================================================

create table errores_app (
  id         uuid primary key default gen_random_uuid(),
  grupo_id   uuid not null references grupos(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete set null,
  tipo       text not null default 'automatico' check (tipo in ('automatico', 'manual')),
  ruta       text check (length(ruta) <= 200),
  mensaje    text not null check (length(mensaje) between 1 and 400),
  detalle    text check (length(detalle) <= 3000),
  agente     text check (length(agente) <= 300),
  version    text check (length(version) <= 40),
  resuelto   boolean not null default false,
  creado     timestamptz not null default now()
);
create index on errores_app (grupo_id, resuelto, creado desc);

-- Tope por persona: 30 reportes por hora (así un error que se repite en bucle no llena la tabla)
create function limite_errores() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from errores_app where user_id = new.user_id and creado > now() - interval '1 hour') >= 30 then
    raise exception 'Demasiados reportes, intenta más tarde';
  end if;
  return new;
end $$;
create trigger trg_limite_errores before insert on errores_app for each row execute function limite_errores();

alter table errores_app enable row level security;
create policy err_ins on errores_app for insert to authenticated with check (user_id = auth.uid() and es_miembro(grupo_id));
create policy err_sel on errores_app for select using (mi_rol(grupo_id) = 'propietario');
create policy err_upd on errores_app for update using (mi_rol(grupo_id) = 'propietario') with check (mi_rol(grupo_id) = 'propietario');
create policy err_del on errores_app for delete using (mi_rol(grupo_id) = 'propietario');
