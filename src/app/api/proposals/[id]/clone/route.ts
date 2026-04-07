/**
 * API Route - Clonar proposta como template
 *
 * POST /api/proposals/:id/clone
 * Body: { clientId: string } (cliente destino da nova proposta)
 *
 * Clona uma proposta existente para outro cliente, copiando titulo,
 * descricao, valor, tags e linkando como retried_from.
 */

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
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
    const { clientId } = body as { clientId?: string }

    // Buscar proposta original
    const { data: original, error: fetchError } = await supabase
      .from('proposals')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !original) {
      return Response.json({ error: 'Proposta nao encontrada.' }, { status: 404 })
    }

    // Criar clone
    const targetClientId = clientId || original.client_id

    const { data: clone, error: cloneError } = await supabase
      .from('proposals')
      .insert({
        client_id: targetClientId,
        title: `${original.title} (copia)`,
        description: original.description,
        proposal_number: null, // novo numero sera atribuido
        status: 'draft',
        value: original.value,
        retried_from: original.id,
        created_by: user.id,
      })
      .select('id, title')
      .single()

    if (cloneError || !clone) {
      return Response.json(
        { error: `Erro ao clonar: ${cloneError?.message}` },
        { status: 500 },
      )
    }

    // Copiar tags
    const { data: originalTags } = await supabase
      .from('proposal_tags')
      .select('tag_id')
      .eq('proposal_id', id)

    if (originalTags && originalTags.length > 0) {
      await supabase.from('proposal_tags').insert(
        originalTags.map((t) => ({
          proposal_id: clone.id,
          tag_id: t.tag_id,
        }))
      )
    }

    return Response.json({
      success: true,
      proposal: clone,
      clonedFrom: id,
    })
  } catch (error) {
    console.error('[API /proposals/:id/clone] Erro:', error)
    return Response.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
