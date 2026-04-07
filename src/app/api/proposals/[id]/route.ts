/**
 * API Route - Atualizar proposta
 *
 * PATCH /api/proposals/:id
 *
 * Atualiza campos de uma proposta (status, loss_reason, retry_date, tags, etc.)
 * Usado pelo Kanban para drag-and-drop e pelo dialog de motivo de perda.
 */

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity-log'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return Response.json({ error: 'Nao autorizado.' }, { status: 401 })
    }

    const body = await request.json()
    const {
      status,
      loss_reason,
      loss_notes,
      retry_date,
      value,
      tags,
    } = body as {
      status?: string
      loss_reason?: string | null
      loss_notes?: string | null
      retry_date?: string | null
      value?: number | null
      tags?: string[] // array de tag IDs
    }

    // Montar o update
    const updates: Record<string, unknown> = {}
    if (status !== undefined) updates.status = status
    if (loss_reason !== undefined) updates.loss_reason = loss_reason
    if (loss_notes !== undefined) updates.loss_notes = loss_notes
    if (retry_date !== undefined) updates.retry_date = retry_date
    if (value !== undefined) updates.value = value

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase
        .from('proposals')
        .update(updates)
        .eq('id', id)

      if (error) {
        return Response.json({ error: error.message }, { status: 500 })
      }
    }

    // Atualizar tags (se fornecidas)
    if (tags !== undefined) {
      // Remover tags atuais
      await supabase
        .from('proposal_tags')
        .delete()
        .eq('proposal_id', id)

      // Inserir novas tags
      if (tags.length > 0) {
        const tagRows = tags.map((tagId) => ({
          proposal_id: id,
          tag_id: tagId,
        }))

        await supabase.from('proposal_tags').insert(tagRows)
      }
    }

    // Registrar no log de atividades
    if (status !== undefined) {
      await logActivity({
        userId: user.id,
        entityType: 'proposal',
        entityId: id,
        action: 'status_change',
        description: `Status alterado para "${status}"`,
        metadata: { status, loss_reason, loss_notes },
      })
    } else if (Object.keys(updates).length > 0) {
      await logActivity({
        userId: user.id,
        entityType: 'proposal',
        entityId: id,
        action: 'update',
        description: `Proposta atualizada`,
        metadata: updates,
      })
    }

    return Response.json({ success: true })
  } catch (error) {
    console.error('[API /proposals/:id] Erro:', error)
    return Response.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
