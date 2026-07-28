-- ============ ROLES ============
create type public.app_role as enum ('admin', 'user');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  username text not null unique,
  status text not null default 'ativo',
  notes text not null default '',
  permissions jsonb not null default '[]'::jsonb,
  read_only boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_read_only(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select read_only from public.profiles where id = _user_id), true)
$$;

create or replace function public.can_write()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
     and coalesce((select status = 'ativo' and not read_only from public.profiles where id = auth.uid()), false)
$$;

-- profiles policies
create policy "profiles_select_self_or_admin" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "profiles_update_admin" on public.profiles
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
create policy "profiles_insert_admin" on public.profiles
  for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));
create policy "profiles_delete_admin" on public.profiles
  for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- user_roles policies (writes only via service role / server functions)
create policy "user_roles_select_self_or_admin" on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- ============ LOCK DOWN BUSINESS TABLES ============
drop policy if exists "campanhas_all" on public.campanhas;
drop policy if exists "ofertas_all" on public.ofertas;
drop policy if exists "acertos_all" on public.acertos;
drop policy if exists "preferencias_colunas_all" on public.preferencias_colunas;
drop policy if exists "usuarios_all" on public.usuarios;
drop policy if exists "produtos_select_all" on public.produtos;
drop policy if exists "produtos_insert_valid_product" on public.produtos;
drop policy if exists "produtos_update_valid_product" on public.produtos;
drop policy if exists "produtos_delete_existing_product" on public.produtos;
drop policy if exists "importacoes_insert_all" on public.produto_importacoes;
drop policy if exists "importacoes_select_all" on public.produto_importacoes;

revoke all on public.campanhas, public.ofertas, public.acertos,
  public.preferencias_colunas, public.produtos, public.produto_importacoes,
  public.usuarios from anon;
revoke all on public.usuarios from authenticated;

grant select, insert, update, delete on public.campanhas, public.ofertas,
  public.acertos, public.preferencias_colunas, public.produtos to authenticated;
grant select, insert on public.produto_importacoes to authenticated;
grant all on public.campanhas, public.ofertas, public.acertos,
  public.preferencias_colunas, public.produtos, public.produto_importacoes to service_role;

create policy "campanhas_select" on public.campanhas for select to authenticated using (true);
create policy "campanhas_insert" on public.campanhas for insert to authenticated with check (public.can_write());
create policy "campanhas_update" on public.campanhas for update to authenticated using (public.can_write()) with check (public.can_write());
create policy "campanhas_delete" on public.campanhas for delete to authenticated using (public.can_write());

create policy "ofertas_select" on public.ofertas for select to authenticated using (true);
create policy "ofertas_insert" on public.ofertas for insert to authenticated with check (public.can_write());
create policy "ofertas_update" on public.ofertas for update to authenticated using (public.can_write()) with check (public.can_write());
create policy "ofertas_delete" on public.ofertas for delete to authenticated using (public.can_write());

create policy "acertos_select" on public.acertos for select to authenticated using (true);
create policy "acertos_insert" on public.acertos for insert to authenticated with check (public.can_write());
create policy "acertos_update" on public.acertos for update to authenticated using (public.can_write()) with check (public.can_write());
create policy "acertos_delete" on public.acertos for delete to authenticated using (public.can_write());

create policy "produtos_select" on public.produtos for select to authenticated using (true);
create policy "produtos_insert" on public.produtos for insert to authenticated with check (public.can_write() and char_length(btrim(descricao)) > 0 and preco_venda >= 0);
create policy "produtos_update" on public.produtos for update to authenticated using (public.can_write()) with check (char_length(btrim(descricao)) > 0 and preco_venda >= 0);
create policy "produtos_delete" on public.produtos for delete to authenticated using (public.can_write());

create policy "importacoes_select" on public.produto_importacoes for select to authenticated using (true);
create policy "importacoes_insert" on public.produto_importacoes for insert to authenticated with check (public.can_write());

create policy "prefs_select_own" on public.preferencias_colunas for select to authenticated using (usuario_id = auth.uid());
create policy "prefs_insert_own" on public.preferencias_colunas for insert to authenticated with check (usuario_id = auth.uid());
create policy "prefs_update_own" on public.preferencias_colunas for update to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy "prefs_delete_own" on public.preferencias_colunas for delete to authenticated using (usuario_id = auth.uid());

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.produtos_set_updated_at();