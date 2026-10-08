-- Nombre del grupo para la página pública /p/:slug (solo slug y nombre, nada más)
create view v_publico_grupo with (security_invoker = false) as
  select slug, nombre from grupos where activo;
grant select on v_publico_grupo to anon, authenticated;
