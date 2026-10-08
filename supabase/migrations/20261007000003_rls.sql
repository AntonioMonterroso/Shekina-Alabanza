-- =========================================================
-- Migración 3: RLS. Los permisos viven aquí, no en la interfaz.
-- Las altas de usuarios y miembros solo las hacen las Edge Functions (service role).
-- =========================================================

alter table grupos             enable row level security;
alter table perfiles           enable row level security;
alter table miembros           enable row level security;
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
alter table proyeccion_estado  enable row level security;

-- Grupos y perfiles
create policy grupos_sel on grupos for select using (es_miembro(id));
create policy grupos_upd on grupos for update using (mi_rol(id) = 'propietario') with check (mi_rol(id) = 'propietario');

create policy perfil_sel on perfiles for select using (
  id = auth.uid() or exists (
    select 1 from miembros a join miembros b on a.grupo_id = b.grupo_id
    where a.user_id = auth.uid() and a.activo and b.user_id = perfiles.id));
create policy perfil_upd on perfiles for update using (id = auth.uid()) with check (id = auth.uid());
-- El usuario solo edita estas columnas; `usuario` lo cambia únicamente el service role.
revoke update on perfiles from authenticated, anon;
grant update (nombre, avatar_url, tema, debe_cambiar_password) on perfiles to authenticated;

-- Miembros: todos ven a su grupo; los líderes editan (el trigger guard_miembros limita los roles)
create policy miem_sel on miembros for select using (es_miembro(grupo_id));
create policy miem_upd on miembros for update using (es_lider(grupo_id)) with check (es_lider(grupo_id));
create policy miem_del on miembros for delete using (es_lider(grupo_id) and rol <> 'propietario');

-- Cancionero (sonido y multimedia no leen la tabla; usan canciones_del_servicio / letra_proyeccion)
create policy can_sel on canciones for select using (ve_cancionero(grupo_id));
create policy can_ins on canciones for insert with check (es_lider(grupo_id));
create policy can_upd on canciones for update using (es_lider(grupo_id)) with check (es_lider(grupo_id));
create policy can_del on canciones for delete using (es_lider(grupo_id));

create policy pen_sel on cancion_pendientes for select using (exists (select 1 from canciones c where c.id = cancion_id and ve_cancionero(c.grupo_id)));
create policy pen_mod on cancion_pendientes for all using (exists (select 1 from canciones c where c.id = cancion_id and es_lider(c.grupo_id)))
                                             with check (exists (select 1 from canciones c where c.id = cancion_id and es_lider(c.grupo_id)));

create policy ton_sel on cancion_tonos for select using (exists (select 1 from canciones c where c.id = cancion_id and ve_cancionero(c.grupo_id)));
create policy ton_mod on cancion_tonos for all using (exists (select 1 from canciones c where c.id = cancion_id and es_lider(c.grupo_id)))
                                       with check (exists (select 1 from canciones c where c.id = cancion_id and es_lider(c.grupo_id)));

create policy dom_sel on cancion_dominio for select using (exists (select 1 from canciones c where c.id = cancion_id and ve_cancionero(c.grupo_id)));
create policy dom_mod on cancion_dominio for all
  using (exists (select 1 from canciones c where c.id = cancion_id and ve_cancionero(c.grupo_id) and miembro_id = mi_miembro_id(c.grupo_id)))
  with check (exists (select 1 from canciones c where c.id = cancion_id and ve_cancionero(c.grupo_id) and miembro_id = mi_miembro_id(c.grupo_id)));

create policy gui_sel on guias for select using (exists (select 1 from canciones c where c.id = cancion_id and ve_cancionero(c.grupo_id)));
create policy gui_mod on guias for all using (exists (select 1 from canciones c where c.id = cancion_id and es_lider(c.grupo_id)))
                                    with check (exists (select 1 from canciones c where c.id = cancion_id and es_lider(c.grupo_id)));

-- Servicios: el equipo ve, el líder edita
create policy srv_sel on servicios      for select using (es_equipo(grupo_id));
create policy srv_mod on servicios      for all    using (es_lider(grupo_id)) with check (es_lider(grupo_id));
create policy itm_sel on servicio_items for select using (exists (select 1 from servicios s where s.id = servicio_id and es_equipo(s.grupo_id)));
create policy itm_mod on servicio_items for all    using (exists (select 1 from servicios s where s.id = servicio_id and es_lider(s.grupo_id)))
                                                   with check (exists (select 1 from servicios s where s.id = servicio_id and es_lider(s.grupo_id)));

-- Turnos
create policy pue_sel on puestos for select using (es_equipo(grupo_id));
create policy pue_mod on puestos for all using (es_lider(grupo_id)) with check (es_lider(grupo_id));

create policy tur_sel on turnos for select using (exists (select 1 from servicios s where s.id = servicio_id and es_equipo(s.grupo_id)));
create policy tur_lid on turnos for all    using (exists (select 1 from servicios s where s.id = servicio_id and es_lider(s.grupo_id)))
                                           with check (exists (select 1 from servicios s where s.id = servicio_id and es_lider(s.grupo_id)));
create policy tur_own on turnos for update using (exists (select 1 from servicios s where s.id = servicio_id and miembro_id = mi_miembro_id(s.grupo_id)))
                                           with check (exists (select 1 from servicios s where s.id = servicio_id and miembro_id = mi_miembro_id(s.grupo_id)));
-- guard_turnos garantiza que el integrante solo cambie `estado`.

create policy ind_sel on indisponibilidad for select using (exists (select 1 from miembros m where m.id = miembro_id and es_equipo(m.grupo_id)));
create policy ind_own on indisponibilidad for all
  using (exists (select 1 from miembros m where m.id = miembro_id and m.user_id = auth.uid() and m.activo))
  with check (exists (select 1 from miembros m where m.id = miembro_id and m.user_id = auth.uid() and m.activo));

-- Ensayos
create policy ens_sel on ensayos for select using (es_equipo(grupo_id));
create policy ens_mod on ensayos for all using (es_lider(grupo_id)) with check (es_lider(grupo_id));

create policy asi_sel on ensayo_asistencia for select using (exists (select 1 from ensayos e where e.id = ensayo_id and es_equipo(e.grupo_id)));
create policy asi_own on ensayo_asistencia for all
  using (exists (select 1 from ensayos e where e.id = ensayo_id and miembro_id = mi_miembro_id(e.grupo_id)))
  with check (exists (select 1 from ensayos e where e.id = ensayo_id and miembro_id = mi_miembro_id(e.grupo_id)));

create policy ecn_sel on ensayo_canciones for select using (exists (select 1 from ensayos e where e.id = ensayo_id and es_equipo(e.grupo_id)));
create policy ecn_mod on ensayo_canciones for all using (exists (select 1 from ensayos e where e.id = ensayo_id and es_lider(e.grupo_id)))
                                           with check (exists (select 1 from ensayos e where e.id = ensayo_id and es_lider(e.grupo_id)));

create policy rep_sel on ensayo_repaso for select using (exists (select 1 from ensayos e where e.id = ensayo_id and es_equipo(e.grupo_id)));
create policy rep_own on ensayo_repaso for all
  using (exists (select 1 from ensayos e where e.id = ensayo_id and miembro_id = mi_miembro_id(e.grupo_id)))
  with check (exists (select 1 from ensayos e where e.id = ensayo_id and miembro_id = mi_miembro_id(e.grupo_id)));

create policy not_sel on ensayo_notas for select using (exists (select 1 from ensayos e where e.id = ensayo_id and es_equipo(e.grupo_id)));
create policy not_ins on ensayo_notas for insert with check (exists (select 1 from ensayos e where e.id = ensayo_id and miembro_id = mi_miembro_id(e.grupo_id)));
create policy not_del on ensayo_notas for delete using (exists (select 1 from ensayos e where e.id = ensayo_id and (miembro_id = mi_miembro_id(e.grupo_id) or es_lider(e.grupo_id))));

-- Avisos
create policy avi_sel on avisos for select using (es_miembro(grupo_id));
create policy avi_mod on avisos for all using (es_lider(grupo_id)) with check (es_lider(grupo_id));

-- Propuestas y votos: el público entra solo por las RPC; los líderes los gestionan
create policy pro_sel on propuestas for select using (es_lider(grupo_id));
create policy pro_upd on propuestas for update using (es_lider(grupo_id)) with check (es_lider(grupo_id));
create policy pro_del on propuestas for delete using (es_lider(grupo_id));
create policy vot_sel on votos for select using (exists (select 1 from canciones c where c.id = cancion_id and es_lider(c.grupo_id)));

-- Proyección: todo el equipo la lee (la pantalla del templo entra con un usuario de multimedia); líder y multimedia la manejan
create policy proy_sel on proyeccion_estado for select using (es_equipo(grupo_id));
create policy proy_ins on proyeccion_estado for insert with check (puede_proyectar(grupo_id));
create policy proy_upd on proyeccion_estado for update using (puede_proyectar(grupo_id)) with check (puede_proyectar(grupo_id));

-- =========================================================
-- Storage: bucket privado 'guias'. Ruta: {grupo_id}/{cancion_id}/{archivo}
-- =========================================================
insert into storage.buckets (id, name, public) values ('guias', 'guias', false) on conflict do nothing;

create policy guias_leer on storage.objects for select to authenticated
  using (bucket_id = 'guias' and ve_cancionero(((storage.foldername(name))[1])::uuid));
create policy guias_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'guias' and es_lider(((storage.foldername(name))[1])::uuid));
create policy guias_cambiar on storage.objects for update to authenticated
  using (bucket_id = 'guias' and es_lider(((storage.foldername(name))[1])::uuid));
create policy guias_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'guias' and es_lider(((storage.foldername(name))[1])::uuid));
