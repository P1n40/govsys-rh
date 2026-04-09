-- Auditoria de seguranca (RLS / politicas abertas)
-- Execute no SQL Editor do Supabase

-- 1) Tabelas do schema public sem RLS habilitado
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r'
  and n.nspname = 'public'
  and c.relname not like 'pg_%'
  and c.relrowsecurity = false
order by c.relname;

-- 2) Politicas abertas para anon/public
select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname in ('public', 'storage')
  and (
    'public' = any(roles)
    or 'anon' = any(roles)
  )
order by schemaname, tablename, policyname;

