-- Migración 10: suscripciones para notificaciones push.
-- Cada dispositivo guarda aquí su suscripción; quien envía es la Edge Function `enviar-push` (service role).
create table push_suscripciones (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index on push_suscripciones (user_id);

alter table push_suscripciones enable row level security;
create policy push_sel on push_suscripciones for select using (user_id = auth.uid());
create policy push_ins on push_suscripciones for insert with check (user_id = auth.uid());
create policy push_upd on push_suscripciones for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_del on push_suscripciones for delete using (user_id = auth.uid());
