-- Semillas de desarrollo. NUNCA correr en producción con datos de ejemplo.
-- Los grupos reales sí se crean aquí; el usuario propietario se crea con scripts/crear-propietario.mjs.
insert into grupos (nombre, slug, activo) values
  ('Ministerio de Alabanza', 'alabanza', true),
  ('Grupo 2', 'grupo-2', false)
on conflict (slug) do nothing;

insert into puestos (grupo_id, nombre, orden)
select g.id, p.nombre, p.orden from grupos g,
  (values ('Dirige',0),('Voz 1',1),('Voz 2',2),('Teclado',3),('Guitarra',4),('Bajo',5),('Batería',6),('Sonido',7),('Multimedia',8)) as p(nombre, orden)
where g.slug = 'alabanza'
on conflict do nothing;
