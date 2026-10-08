-- canciones_del_servicio ahora también devuelve la duración (para sumar los minutos del culto)
drop function if exists canciones_del_servicio(uuid);
create function canciones_del_servicio(p_servicio uuid)
returns table (item_id uuid, orden int, cancion_id uuid, titulo text, autor text, tono text, momento text, minutos int)
language sql stable security definer set search_path = public as $$
  select si.id, si.orden, c.id, c.titulo, c.autor, coalesce(si.tono, c.tono_original), si.momento, coalesce(si.minutos, c.minutos)
  from servicio_items si
  join servicios s on s.id = si.servicio_id
  join canciones c on c.id = si.cancion_id
  where si.servicio_id = p_servicio and si.tipo = 'cancion' and es_equipo(s.grupo_id)
  order by si.orden
$$;
grant execute on function canciones_del_servicio to authenticated;
