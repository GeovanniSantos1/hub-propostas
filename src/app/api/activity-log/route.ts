/**
 * API Route - Log de Atividades
 *
 * GET /api/activity-log?page=1&entity_type=proposal
 */

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const PAGE_SIZE = 30

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return Response.json({ error: 'Nao autorizado.' }, { status: 401 })
    }

    const page = parseInt(request.nextUrl.searchParams.get('page') || '1', 10)
    const entityType = request.nextUrl.searchParams.get('entity_type')

    let query = supabase
      .from('activity_log')
      .select('*, profiles(full_name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

    if (entityType) {
      query = query.eq('entity_type', entityType)
    }

    const { data, count } = await query

    return Response.json({
      entries: data || [],
      total: count || 0,
      page,
      totalPages: Math.ceil((count || 0) / PAGE_SIZE),
    })
  } catch (error) {
    console.error('[API /activity-log] Erro:', error)
    return Response.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
