/**
 * API Route - Sugestoes de Cross-sell com IA
 *
 * GET /api/ai/cross-sell?clientId=xxx
 *
 * Analisa o historico de propostas do cliente e de clientes similares
 * para sugerir novas oportunidades de venda.
 */

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

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

    // Dados do cliente
    const { data: client } = await supabase
      .from('clients')
      .select('name, sector')
      .eq('id', clientId)
      .single()

    if (!client) {
      return Response.json({ error: 'Cliente nao encontrado.' }, { status: 404 })
    }

    // Propostas do cliente
    const { data: clientProposals } = await supabase
      .from('proposals')
      .select('title, status, value, description')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(20)

    // Propostas de OUTROS clientes do mesmo setor (para referencia)
    let sectorProposals: { title: string; status: string; client_name: string }[] = []

    if (client.sector) {
      const { data: sectorData } = await supabase
        .from('proposals')
        .select('title, status, clients!inner(name, sector)')
        .eq('clients.sector', client.sector)
        .neq('client_id', clientId)
        .eq('status', 'won')
        .limit(30)

      if (sectorData) {
        sectorProposals = sectorData.map((p) => ({
          title: p.title,
          status: p.status,
          client_name: (p.clients as unknown as { name: string })?.name || '',
        }))
      }
    }

    // Top servicos vendidos globalmente (para referencia)
    const { data: allWonProposals } = await supabase
      .from('proposals')
      .select('title')
      .eq('status', 'won')
      .neq('client_id', clientId)
      .limit(50)

    const wonTitles = (allWonProposals || []).map((p) => p.title)

    // Chamar OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 500,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Voce e um consultor comercial analisando oportunidades de cross-sell e upsell.

Responda APENAS em JSON valido com este formato:
{
  "suggestions": [
    {
      "title": "Nome do servico sugerido",
      "reason": "Motivo da sugestao em 1 frase",
      "confidence": "high" | "medium" | "low",
      "estimated_value": null ou numero (valor estimado em reais)
    }
  ]
}

Regras:
- Maximo 5 sugestoes, ordenadas por relevancia
- Baseie nas propostas ja compradas por clientes similares
- Considere servicos que complementam o que o cliente ja contratou
- Se o cliente perdeu propostas, sugira retomada com abordagem diferente
- Seja especifico (nao diga "consultoria generica", diga "Assessment de Maturidade em DevOps")`,
        },
        {
          role: 'user',
          content: `Cliente: ${client.name}
Setor: ${client.sector || 'Nao definido'}

Propostas deste cliente:
${(clientProposals || []).map((p) => `- ${p.title} (${p.status}) ${p.value ? `R$ ${p.value}` : ''}`).join('\n') || 'Nenhuma'}

Propostas GANHAS de clientes do MESMO SETOR:
${sectorProposals.map((p) => `- ${p.title} (${p.client_name})`).join('\n') || 'Sem dados do setor'}

Servicos mais vendidos (geral):
${[...new Set(wonTitles.map((t) => t.split(' - ').pop()?.trim()))].slice(0, 15).join(', ') || 'Sem dados'}

Sugira oportunidades de cross-sell/upsell para este cliente.`,
        },
      ],
    })

    const content = completion.choices[0]?.message?.content?.trim() ?? '{}'

    try {
      const parsed = JSON.parse(content)
      return Response.json(parsed)
    } catch {
      return Response.json({ suggestions: [] })
    }
  } catch (error) {
    console.error('[API /ai/cross-sell] Erro:', error)
    return Response.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
