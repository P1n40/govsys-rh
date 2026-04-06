-- Script minimo para habilitar a rota /mensagens
-- Rode no Supabase SQL Editor (New query -> Run)

create extension if not exists pgcrypto;

create table if not exists public.mensagens (
  id uuid primary key default gen_random_uuid(),
  remetente_id uuid not null references public.usuarios(id) on delete cascade,
  destinatario_id uuid null references public.usuarios(id) on delete set null,
  setor_id text null,
  demanda_id uuid null references public.demandas(id) on delete set null,
  conteudo text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.anexos_mensagens (
  id uuid primary key default gen_random_uuid(),
  mensagem_id uuid not null references public.mensagens(id) on delete cascade,
  url text not null,
  tipo text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_mensagens_created_at on public.mensagens(created_at desc);
create index if not exists idx_anexos_mensagem_id on public.anexos_mensagens(mensagem_id);

alter table public.mensagens enable row level security;
alter table public.anexos_mensagens enable row level security;

drop policy if exists mensagens_select_public on public.mensagens;
create policy mensagens_select_public
on public.mensagens
for select
to public
using (true);

drop policy if exists mensagens_insert_public on public.mensagens;
create policy mensagens_insert_public
on public.mensagens
for insert
to public
with check (true);

drop policy if exists anexos_mensagens_select_public on public.anexos_mensagens;
create policy anexos_mensagens_select_public
on public.anexos_mensagens
for select
to public
using (true);

drop policy if exists anexos_mensagens_insert_public on public.anexos_mensagens;
create policy anexos_mensagens_insert_public
on public.anexos_mensagens
for insert
to public
with check (true);

notify pgrst, 'reload schema';

-- Bucket/policies para anexos (upload via client anon/authenticated)
insert into storage.buckets (id, name, public)
values ('anexos', 'anexos', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists anexos_bucket_public_select on storage.objects;
create policy anexos_bucket_public_select
on storage.objects
for select
to public
using (bucket_id = 'anexos');

drop policy if exists anexos_bucket_public_insert on storage.objects;
create policy anexos_bucket_public_insert
on storage.objects
for insert
to public
with check (bucket_id = 'anexos');

drop policy if exists anexos_bucket_public_update on storage.objects;
create policy anexos_bucket_public_update
on storage.objects
for update
to public
using (bucket_id = 'anexos')
with check (bucket_id = 'anexos');

drop policy if exists anexos_bucket_public_delete on storage.objects;
create policy anexos_bucket_public_delete
on storage.objects
for delete
to public
using (bucket_id = 'anexos');
