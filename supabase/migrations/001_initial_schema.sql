-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles (extends auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  role text default 'member' check (role in ('admin', 'member')),
  avatar_url text,
  created_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Clients
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  full_name text,
  sector text,
  contact_name text,
  contact_email text,
  contact_phone text,
  notes text,
  folder_name text,
  status text default 'active' check (status in ('active', 'archived')),
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Proposals
create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade not null,
  title text not null,
  description text,
  proposal_number text,
  status text default 'draft' check (status in ('draft', 'sent', 'negotiating', 'won', 'lost')),
  value decimal,
  proposal_date date,
  original_filename text,
  ai_generated boolean default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Proposal files
create table public.proposal_files (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid references public.proposals(id) on delete cascade not null,
  file_name text not null,
  file_type text,
  file_size bigint,
  storage_path text not null,
  created_at timestamptz default now()
);

-- Interactions
create table public.interactions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade not null,
  type text not null check (type in ('meeting', 'call', 'email', 'visit', 'note')),
  title text not null,
  description text,
  interaction_date timestamptz not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- Reminders
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade not null,
  proposal_id uuid references public.proposals(id) on delete set null,
  title text not null,
  description text,
  due_date timestamptz not null,
  completed boolean default false,
  completed_at timestamptz,
  assigned_to uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- Indexes
create index idx_clients_name on public.clients(name);
create index idx_clients_status on public.clients(status);
create index idx_proposals_client on public.proposals(client_id);
create index idx_proposals_status on public.proposals(status);
create index idx_interactions_client on public.interactions(client_id);
create index idx_reminders_due_date on public.reminders(due_date);
create index idx_reminders_assigned on public.reminders(assigned_to);

-- Full text search on clients
alter table public.clients add column search_vector tsvector
  generated always as (
    to_tsvector('portuguese', coalesce(name, '') || ' ' || coalesce(full_name, '') || ' ' || coalesce(sector, '') || ' ' || coalesce(contact_name, ''))
  ) stored;
create index idx_clients_search on public.clients using gin(search_vector);

-- Full text search on proposals
alter table public.proposals add column search_vector tsvector
  generated always as (
    to_tsvector('portuguese', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(proposal_number, ''))
  ) stored;
create index idx_proposals_search on public.proposals using gin(search_vector);

-- RLS Policies
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.proposals enable row level security;
alter table public.proposal_files enable row level security;
alter table public.interactions enable row level security;
alter table public.reminders enable row level security;

-- All authenticated users can read everything
create policy "Authenticated users can read profiles" on public.profiles for select to authenticated using (true);
create policy "Users can update own profile" on public.profiles for update to authenticated using (auth.uid() = id);

create policy "Authenticated users can read clients" on public.clients for select to authenticated using (true);
create policy "Authenticated users can insert clients" on public.clients for insert to authenticated with check (true);
create policy "Authenticated users can update clients" on public.clients for update to authenticated using (true);
create policy "Admins can delete clients" on public.clients for delete to authenticated using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

create policy "Authenticated users can read proposals" on public.proposals for select to authenticated using (true);
create policy "Authenticated users can insert proposals" on public.proposals for insert to authenticated with check (true);
create policy "Authenticated users can update proposals" on public.proposals for update to authenticated using (true);
create policy "Admins can delete proposals" on public.proposals for delete to authenticated using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

create policy "Authenticated users can manage proposal_files" on public.proposal_files for all to authenticated using (true);
create policy "Authenticated users can manage interactions" on public.interactions for all to authenticated using (true);
create policy "Authenticated users can manage reminders" on public.reminders for all to authenticated using (true);

-- Updated_at trigger
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger clients_updated_at before update on public.clients
  for each row execute function public.update_updated_at();
create trigger proposals_updated_at before update on public.proposals
  for each row execute function public.update_updated_at();
