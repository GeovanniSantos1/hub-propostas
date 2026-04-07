-- ============================================================================
-- Migracao 002: Pipeline, Tags e Motivo de Perda
-- ============================================================================

-- 1. Novos campos em proposals para gestao de perda e retomada
alter table public.proposals
  add column if not exists loss_reason text
    check (loss_reason in ('price', 'deadline', 'competitor', 'cancelled', 'budget', 'scope', 'other')),
  add column if not exists loss_notes text,
  add column if not exists retry_date date,
  add column if not exists retried_from uuid references public.proposals(id);

-- Index para buscar propostas para retomada
create index if not exists idx_proposals_retry_date on public.proposals(retry_date)
  where retry_date is not null and status = 'lost';

-- 2. Sistema de Tags
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('service', 'technology', 'area')),
  color text default '#6b7280',
  created_at timestamptz default now(),
  unique(name, category)
);

create table if not exists public.proposal_tags (
  proposal_id uuid references public.proposals(id) on delete cascade not null,
  tag_id uuid references public.tags(id) on delete cascade not null,
  primary key (proposal_id, tag_id)
);

-- RLS para tags
alter table public.tags enable row level security;
alter table public.proposal_tags enable row level security;

create policy "Authenticated users can manage tags"
  on public.tags for all to authenticated using (true);
create policy "Authenticated users can manage proposal_tags"
  on public.proposal_tags for all to authenticated using (true);

-- 3. Tags padrao (servicos comuns)
insert into public.tags (name, category, color) values
  -- Servicos
  ('Assessment', 'service', '#8b5cf6'),
  ('Desenvolvimento', 'service', '#3b82f6'),
  ('Consultoria', 'service', '#f59e0b'),
  ('Treinamento', 'service', '#10b981'),
  ('Suporte', 'service', '#6366f1'),
  ('Migracao', 'service', '#ec4899'),
  ('Discovery', 'service', '#14b8a6'),
  ('Squad', 'service', '#f97316'),
  ('Alocacao', 'service', '#84cc16'),
  -- Tecnologias
  ('Azure', 'technology', '#0078d4'),
  ('SharePoint', 'technology', '#038387'),
  ('Power Platform', 'technology', '#742774'),
  ('RPA', 'technology', '#ff6f00'),
  ('.NET', 'technology', '#512bd4'),
  ('React', 'technology', '#61dafb'),
  ('Mobile', 'technology', '#a4c639'),
  ('IA / Machine Learning', 'technology', '#ff6f61'),
  ('DevOps', 'technology', '#f05032'),
  -- Areas
  ('TI', 'area', '#64748b'),
  ('Juridico', 'area', '#78716c'),
  ('RH', 'area', '#d946ef'),
  ('Financeiro', 'area', '#059669'),
  ('Operacoes', 'area', '#dc2626'),
  ('Comercial', 'area', '#2563eb')
on conflict (name, category) do nothing;

-- 4. Tabela de score de oportunidade (cache para o Radar)
create table if not exists public.opportunity_scores (
  client_id uuid references public.clients(id) on delete cascade primary key,
  score integer not null default 0,
  factors jsonb default '{}',
  last_interaction_at timestamptz,
  days_since_contact integer default 0,
  suggestions text[] default '{}',
  calculated_at timestamptz default now()
);

alter table public.opportunity_scores enable row level security;
create policy "Authenticated users can manage opportunity_scores"
  on public.opportunity_scores for all to authenticated using (true);
