-- Cada integrante guarda su propio tono por canción (modo escenario). Los líderes ya podían con ton_mod.
create policy ton_own on cancion_tonos for all
  using (exists (select 1 from canciones c where c.id = cancion_id and miembro_id = mi_miembro_id(c.grupo_id)))
  with check (exists (select 1 from canciones c where c.id = cancion_id and miembro_id = mi_miembro_id(c.grupo_id)));
