-- Corrige erro: "new row violates row-level security policy"
-- para upload de anexos no bucket "anexos".

-- Garante bucket
insert into storage.buckets (id, name, public)
values ('anexos', 'anexos', true)
on conflict (id) do update set public = excluded.public;

-- Politicas de acesso ao bucket "anexos"
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
