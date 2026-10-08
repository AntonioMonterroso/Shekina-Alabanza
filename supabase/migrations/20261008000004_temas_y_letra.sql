-- =========================================================
-- Migración 4: más temas de color, modo claro/oscuro/automático y corrección de letra_proyeccion
-- =========================================================

alter table perfiles drop constraint if exists perfiles_tema_check;
alter table perfiles add constraint perfiles_tema_check
  check (tema in ('salvia','rosa','cielo','ambar','lavanda','turquesa'));

alter table perfiles add column modo text not null default 'auto' check (modo in ('claro','oscuro','auto'));

revoke update on perfiles from authenticated, anon;
grant update (nombre, avatar_url, tema, modo, debe_cambiar_password) on perfiles to authenticated;

-- Antes la expresión '\[[A-G][^\]]{0,7}\]' también borraba etiquetas como [Coro] o [Final].
-- Ahora solo quita acordes de verdad (gramática de acordes en notación americana).
create or replace function letra_proyeccion(p_cancion uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare g uuid; l text;
begin
  select grupo_id, letra_chordpro into g, l from canciones where id = p_cancion;
  if g is null then return null; end if;
  if not (puede_proyectar(g) or (mi_rol(g) = 'sonido' and exists(
       select 1 from servicio_items si join servicios s on s.id = si.servicio_id
       where si.cancion_id = p_cancion and s.fecha >= now() - interval '1 day'))) then
    raise exception 'Sin acceso';
  end if;
  return regexp_replace(
    coalesce(l, ''),
    '\[[A-G][#b]?(maj|min|dim|aug|sus|add|m|M)?[0-9]*((sus|add|b|#)?[0-9]+)*(/[A-G][#b]?)?\]',
    '', 'g');
end $$;
