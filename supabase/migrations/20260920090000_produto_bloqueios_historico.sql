-- Histórico das alterações na condição de bloqueio de produtos (produto + loja).
-- Registra: produto, loja, status anterior, novo status, usuário, data/hora e motivo.

create table if not exists public.produto_bloqueios_historico (
  id uuid primary key default gen_random_uuid(),
  bloqueio_id text,
  product_id text not null,
  store_id text not null,
  status_anterior text,
  status_novo text not null,
  changed_by text,
  changed_by_name text not null default '',
  motivo text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists produto_bloqueios_historico_produto_loja_idx
  on public.produto_bloqueios_historico (product_id, store_id, created_at desc);

create index if not exists produto_bloqueios_historico_created_at_idx
  on public.produto_bloqueios_historico (created_at desc);

alter table public.produto_bloqueios_historico enable row level security;

drop policy if exists "produto_bloqueios_historico_select" on public.produto_bloqueios_historico;
create policy "produto_bloqueios_historico_select"
  on public.produto_bloqueios_historico
  for select
  to authenticated
  using (true);

drop policy if exists "produto_bloqueios_historico_insert" on public.produto_bloqueios_historico;
create policy "produto_bloqueios_historico_insert"
  on public.produto_bloqueios_historico
  for insert
  to authenticated
  with check (true);
