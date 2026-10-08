// Aplica todas las migraciones en un Postgres local (PGlite) con lo mínimo de Supabase simulado
// (auth.users, auth.uid(), roles anon/authenticated) y deja una función para probar RLS como un usuario.
// Uso: npm i --no-save @electric-sql/pglite && node scripts/probar-migraciones.mjs [prueba.mjs]
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

export async function baseConMigraciones() {
  const db = new PGlite()
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub', '')::uuid $$;
    create role anon nologin; create role authenticated nologin;
    grant usage on schema public, auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant execute on functions to anon, authenticated;
    create publication supabase_realtime;
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean);
    create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(n text) returns text[] language sql immutable as $$
      select (string_to_array(n, '/'))[1:greatest(cardinality(string_to_array(n, '/')) - 1, 0)] $$;
  `)
  const dir = 'supabase/migrations'
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    const sql = readFileSync(join(dir, f), 'utf8').replace(/create extension if not exists pgcrypto;/g, '')
    try { await db.exec(sql) } catch (e) { throw new Error(`${f}: ${e.message}`) }
  }
  return db
}

/** Ejecuta una consulta como el usuario `uid` (rol authenticated, con RLS). */
export async function como(db, uid, sql, params) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claims', '{"sub":"${uid}"}', false);`)
  try { return await db.query(sql, params) } finally { await db.exec("reset role; select set_config('request.jwt.claims', '', false);") }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const db = await baseConMigraciones()
  console.log('Migraciones aplicadas sin errores')
  if (process.argv[2]) await (await import(join(process.cwd(), process.argv[2]))).default(db, como)
}
