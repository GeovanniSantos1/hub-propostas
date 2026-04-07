-- ============================================================================
-- Migracao 003: Log de Atividades (Auditoria)
-- ============================================================================

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  entity_type text not null check (entity_type in ('client', 'proposal', 'interaction', 'reminder', 'file')),
  entity_id uuid not null,
  action text not null check (action in ('create', 'update', 'delete', 'status_change', 'upload', 'clone')),
  description text not null,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create index idx_activity_log_entity on public.activity_log(entity_type, entity_id);
create index idx_activity_log_user on public.activity_log(user_id);
create index idx_activity_log_created on public.activity_log(created_at desc);

alter table public.activity_log enable row level security;

create policy "Authenticated users can read activity_log"
  on public.activity_log for select to authenticated using (true);
create policy "Authenticated users can insert activity_log"
  on public.activity_log for insert to authenticated with check (true);
