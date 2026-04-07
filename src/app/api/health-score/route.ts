/**
 * API Route - Health Score de um cliente
 *
 * GET /api/health-score?clientId=xxx
 *
 * Calcula e retorna o health score do cliente baseado em interacoes,
 * propostas, conversao e volume financeiro.
 */

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateHealthScore } from '@/lib/health-score'

export async function GET(request: NextRequest) {
  try {
    const clientId = request.nextUrl.searchParams.get('clientId')

    if (!clientId) {
      return Response.json({ error: 'clientId obrigatorio.' }, { status: 400 })
    }

    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return Response.json({ error: 'Nao autorizado.' }, { status: 401 })
    }

    // Buscar dados do cliente
    const { data: interactions } = await supabase
      .from('interactions')
      .select('interaction_date')
      .eq('client_id', clientId)

    const { data: proposals } = await supabase
      .from('proposals')
      .select('status, value, updated_at, title')
      .eq('client_id', clientId)

    const result = calculateHealthScore({
      interactions: interactions || [],
      proposals: proposals || [],
    })

    return Response.json(result)
  } catch (error) {
    console.error('[API /health-score] Erro:', error)
    return Response.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
