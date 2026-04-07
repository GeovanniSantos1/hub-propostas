/**
 * Utilitario para registrar atividades no log de auditoria.
 *
 * Uso: chamar logActivity() apos cada acao relevante no sistema.
 * Falhas sao silenciadas para nao impactar o fluxo principal.
 */

import { createClient } from '@supabase/supabase-js'

type EntityType = 'client' | 'proposal' | 'interaction' | 'reminder' | 'file'
type Action = 'create' | 'update' | 'delete' | 'status_change' | 'upload' | 'clone'

interface LogEntry {
  userId: string | null
  entityType: EntityType
  entityId: string
  action: Action
  description: string
  metadata?: Record<string, unknown>
}

/**
 * Registra uma atividade no log de auditoria.
 * Usa service role para garantir escrita independente de RLS.
 */
export async function logActivity(entry: LogEntry) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) return

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    })

    await supabase.from('activity_log').insert({
      user_id: entry.userId,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      action: entry.action,
      description: entry.description,
      metadata: entry.metadata || {},
    })
  } catch {
    // Silenciar - log nao deve quebrar o fluxo
  }
}
