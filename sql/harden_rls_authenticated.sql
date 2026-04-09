-- HARDENING RLS (modo seguro)
-- Objetivo:
-- 1) habilitar RLS nas tabelas principais do app
-- 2) remover politicas abertas (public/anon)
-- 3) permitir acesso somente para usuarios autenticados (role authenticated)
--
-- IMPORTANTE:
-- - service_role continua funcionando no backend (API server-side)
-- - se o frontend ainda usa anon sem login, ele perdera acesso ate autenticar

begin;

do $$
declare
  t text;
  p record;
  app_tables text[] := array[
    'usuarios',
    'processos',
    'etapas',
    'checklist',
    'demandas',
    'execucao_etapas',
    'pendencias',
    'anexos',
    'responsabilidades',
    'mensagens',
    'anexos_mensagens'
  ];
begin
  foreach t in array app_tables loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('alter table public.%I enable row level security;', t);
      execute format('alter table public.%I force row level security;', t);

      for p in
        select policyname
        from pg_policies
        where schemaname = 'public'
          and tablename = t
      loop
        execute format('drop policy if exists %I on public.%I;', p.policyname, t);
      end loop;

      execute format(
        'create policy %I on public.%I for select to authenticated using (true);',
        t || '_select_authenticated',
        t
      );
      execute format(
        'create policy %I on public.%I for insert to authenticated with check (true);',
        t || '_insert_authenticated',
        t
      );
      execute format(
        'create policy %I on public.%I for update to authenticated using (true) with check (true);',
        t || '_update_authenticated',
        t
      );
      execute format(
        'create policy %I on public.%I for delete to authenticated using (true);',
        t || '_delete_authenticated',
        t
      );
    end if;
  end loop;
end $$;

-- Storage (opcional): algumas instancias nao permitem ALTER/DROP em storage.objects.
-- Se faltar permissao, o bloco registra aviso e segue com hardening das tabelas public.
do $$
begin
  update storage.buckets
  set public = false
  where id = 'anexos';

  drop policy if exists anexos_bucket_public_select on storage.objects;
  drop policy if exists anexos_bucket_public_insert on storage.objects;
  drop policy if exists anexos_bucket_public_update on storage.objects;
  drop policy if exists anexos_bucket_public_delete on storage.objects;

  drop policy if exists anexos_bucket_authenticated_select on storage.objects;
  create policy anexos_bucket_authenticated_select
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'anexos');

  drop policy if exists anexos_bucket_authenticated_insert on storage.objects;
  create policy anexos_bucket_authenticated_insert
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'anexos');

  drop policy if exists anexos_bucket_authenticated_update on storage.objects;
  create policy anexos_bucket_authenticated_update
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'anexos')
  with check (bucket_id = 'anexos');

  drop policy if exists anexos_bucket_authenticated_delete on storage.objects;
  create policy anexos_bucket_authenticated_delete
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'anexos');
exception
  when insufficient_privilege then
    raise notice 'Sem permissao para gerenciar storage.objects nesta sessao. Ajuste politicas do bucket pela UI de Storage.';
end $$;

commit;

-- Validacao rapida (deve retornar zero linhas)
select
  n.nspname as schema_name,
  c.relname as table_name
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r'
  and n.nspname = 'public'
  and c.relname in (
    'usuarios',
    'processos',
    'etapas',
    'checklist',
    'demandas',
    'execucao_etapas',
    'pendencias',
    'anexos',
    'responsabilidades',
    'mensagens',
    'anexos_mensagens'
  )
  and c.relrowsecurity = false;
