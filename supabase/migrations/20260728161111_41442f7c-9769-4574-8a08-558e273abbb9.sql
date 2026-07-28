-- drop old FK, then remap column preferences to the new profile ids
alter table public.preferencias_colunas
  drop constraint if exists preferencias_colunas_usuario_id_fkey;

update public.preferencias_colunas pc
set usuario_id = p.id
from public.usuarios u
join public.profiles p on p.username = lower(btrim(u.username))
where pc.usuario_id = u.id;

delete from public.preferencias_colunas pc
where not exists (select 1 from public.profiles p where p.id = pc.usuario_id);

alter table public.preferencias_colunas
  add constraint preferencias_colunas_usuario_id_fkey
  foreign key (usuario_id) references public.profiles(id) on delete cascade;

drop table public.usuarios;

revoke all on function public.has_role(uuid, public.app_role) from public, anon;
revoke all on function public.is_read_only(uuid) from public, anon;
revoke all on function public.can_write() from public, anon;
revoke all on function public.produtos_set_updated_at() from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;
grant execute on function public.is_read_only(uuid) to authenticated, service_role;
grant execute on function public.can_write() to authenticated, service_role;