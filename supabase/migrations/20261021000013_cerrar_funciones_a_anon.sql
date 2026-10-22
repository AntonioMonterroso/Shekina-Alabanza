-- =========================================================
-- Migración 13: cerrar las funciones a visitantes anónimos (defensa en profundidad)
-- Postgres da EXECUTE a todos por defecto. Las funciones ya validan quién llama, pero un visitante sin
-- sesión no debería poder ni invocarlas. Solo la página pública necesita tres RPC.
-- Si algún día una función nueva debe ser pública, hay que darle `grant execute ... to anon` a propósito.
-- =========================================================

revoke execute on all functions in schema public from public, anon;

-- Lo único que usa la página pública sin sesión (con límite por dispositivo dentro de cada función)
grant execute on function votar_cancion, quitar_voto, enviar_propuesta to anon;

-- Quien tiene sesión y el servicio de Supabase siguen como antes
grant execute on all functions in schema public to authenticated, service_role;

-- Las funciones que se creen después nacen cerradas para anon
alter default privileges for role postgres in schema public revoke execute on functions from public, anon;
