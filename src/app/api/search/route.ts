/**
 * API Route - Busca Global Federada
 *
 * GET /api/search?q=termo
 *
 * Pesquisa simultaneamente em clientes, propostas e interacoes,
 * retornando resultados agrupados por tipo.
 */

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get('q')?.trim()

    if (!q || q.length < 2) {
      return Response.json({ clients: [], proposals: [], interactions: [] })
    }

    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return Response.json({ error: 'Nao autorizado.' }, { status: 401 })
    }

    const searchTerm = `%${q}%`

    // Buscar em paralelo
    const [clientsRes, proposalsRes, interactionsRes] = await Promise.all([
      supabase
        .from('clients')
        .select('id, name, sector, status')
        .or(`name.ilike.${searchTerm},full_name.ilike.${searchTerm},sector.ilike.${searchTerm},contact_name.ilike.${searchTerm}`)
        .limit(8),

      supabase
        .from('proposals')
        .select('id, title, status, value, client_id, proposal_number, clients!inner(name)')
        .or(`title.ilike.${searchTerm},proposal_number.ilike.${searchTerm},description.ilike.${searchTerm}`)
        .limit(8),

      supabase
        .from('interactions')
        .select('id, title, type, client_id, interaction_date, clients!inner(name)')
        .or(`title.ilike.${searchTerm},description.ilike.${searchTerm}`)
        .order('interaction_date', { ascending: false })
        .limit(5),
    ])

    return Response.json({
      clients: (clientsRes.data || []).map((c) => ({
        id: c.id,
        name: c.name,
        sector: c.sector,
        status: c.status,
      })),
      proposals: (proposalsRes.data || []).map((p) => ({
        id: p.id,
        title: p.title,
        status: p.status,
        value: p.value,
        clientId: p.client_id,
        clientName: (p.clients as unknown as { name: string })?.name || '',
        proposalNumber: p.proposal_number,
      })),
      interactions: (interactionsRes.data || []).map((i) => ({
        id: i.id,
        title: i.title,
        type: i.type,
        clientId: i.client_id,
        clientName: (i.clients as unknown as { name: string })?.name || '',
        date: i.interaction_date,
      })),
    })
  } catch (error) {
    console.error('[API /search] Erro:', error)
    return Response.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
