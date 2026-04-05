-- Cria tabela para atribuicao de responsaveis por processo (Gestao de Equipe)
create extension if not exists pgcrypto;

create table if not exists public.responsabilidades (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references public.processos(id) on delete cascade,
  responsavel_id uuid not null references public.usuarios(id) on delete cascade,
  tipo text not null check (tipo in ('principal', 'secundario')),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (processo_id, tipo)
);

create index if not exists idx_responsabilidades_processo_id on public.responsabilidades(processo_id);
create index if not exists idx_responsabilidades_responsavel_id on public.responsabilidades(responsavel_id);

-- Atualiza timestamp automaticamente em updates
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_responsabilidades_updated_at on public.responsabilidades;
create trigger trg_responsabilidades_updated_at
before update on public.responsabilidades
for each row
execute function public.set_updated_at();

-- Se RLS estiver habilitado, libere acesso para o app (anon + authenticated).
alter table public.responsabilidades enable row level security;

drop policy if exists responsabilidades_select_public on public.responsabilidades;
create policy responsabilidades_select_public
on public.responsabilidades
for select
to public
using (true);

drop policy if exists responsabilidades_insert_public on public.responsabilidades;
create policy responsabilidades_insert_public
on public.responsabilidades
for insert
to public
with check (true);

drop policy if exists responsabilidades_update_public on public.responsabilidades;
create policy responsabilidades_update_public
on public.responsabilidades
for update
to public
using (true)
with check (true);

drop policy if exists responsabilidades_delete_public on public.responsabilidades;
create policy responsabilidades_delete_public
on public.responsabilidades
for delete
to public
using (true);
