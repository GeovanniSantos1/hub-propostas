-- ============================================================================
-- Migracao 004: Campo ai_suggestion para o Construtor de Propostas
-- ============================================================================

alter table public.proposals
  add column if not exists ai_suggestion jsonb;
