/**
 * API Route - Construtor Inteligente de Propostas
 *
 * POST /api/ai/proposal-builder
 *
 * Recebe contexto (cliente, servicos, escopo) e retorna sugestao completa
 * de valor, escopo, prazo e probabilidade de ganho baseado no historico.
 */

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateHealthScore } from '@/lib/health-score'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

function median(arr: number[]): number {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function formatBRL(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return Response.json({ error: 'Nao autorizado.' }, { status: 401 })
    }

    const body = await request.json()
    const {
      clientId,
      serviceTags,
      technologyTags,
      scopeDescription,
      baseProposalId,
    } = body as {
      clientId: string
      serviceTags: string[]
      technologyTags: string[]
      scopeDescription: string
      baseProposalId?: string
    }

    if (!clientId) {
      return Response.json({ error: 'clientId obrigatorio.' }, { status: 400 })
    }

    // -----------------------------------------------------------------------
    // 1. Buscar contexto do cliente
    // -----------------------------------------------------------------------
    const { data: client } = await supabase
      .from('clients')
      .select('id, name, sector')
      .eq('id', clientId)
      .single()

    if (!client) {
      return Response.json({ error: 'Cliente nao encontrado.' }, { status: 404 })
    }

    // Propostas do cliente
    const { data: clientProposals } = await supabase
      .from('proposals')
      .select('id, title, status, value, proposal_date, created_at, description')
      .eq('client_id', clientId)

    // Interacoes do cliente (para health score)
    const { data: clientInteractions } = await supabase
      .from('interactions')
      .select('interaction_date')
      .eq('client_id', clientId)

    const healthScore = calculateHealthScore({
      interactions: clientInteractions || [],
      proposals: (clientProposals || []).map(p => ({
        status: p.status,
        value: p.value,
        updated_at: p.proposal_date || p.created_at,
        title: p.title,
      })),
    })

    // -----------------------------------------------------------------------
    // 2. Buscar propostas similares por tags
    // -----------------------------------------------------------------------
    const allTagIds = [...(serviceTags || []), ...(technologyTags || [])]

    let similarWon: { id: string; title: string; value: number; client_name: string }[] = []
    let similarLost: { id: string; title: string; value: number; loss_reason: string | null; client_name: string }[] = []

    if (allTagIds.length > 0) {
      try {
        // Propostas que tem ao menos 1 tag em comum
        const { data: taggedProposalIds } = await supabase
          .from('proposal_tags')
          .select('proposal_id')
          .in('tag_id', allTagIds)

        if (taggedProposalIds && taggedProposalIds.length > 0) {
          const proposalIds = [...new Set(taggedProposalIds.map(t => t.proposal_id))]

          const { data: wonData } = await supabase
            .from('proposals')
            .select('id, title, value, clients!inner(name)')
            .in('id', proposalIds)
            .eq('status', 'won')
            .not('value', 'is', null)
            .order('value', { ascending: false })
            .limit(20)

          if (wonData) {
            similarWon = wonData.map(p => ({
              id: p.id,
              title: p.title,
              value: p.value!,
              client_name: (p.clients as unknown as { name: string })?.name || '',
            }))
          }

          const { data: lostData } = await supabase
            .from('proposals')
            .select('id, title, value, clients!inner(name)')
            .in('id', proposalIds)
            .eq('status', 'lost')
            .not('value', 'is', null)
            .order('value', { ascending: false })
            .limit(20)

          if (lostData) {
            similarLost = lostData.map(p => ({
              id: p.id,
              title: p.title,
              value: p.value!,
              loss_reason: null,
              client_name: (p.clients as unknown as { name: string })?.name || '',
            }))
          }
        }
      } catch {
        // Tabela proposal_tags pode nao existir se migracao 002 nao rodou
        console.warn('[proposal-builder] Tabela proposal_tags nao encontrada, pulando busca por tags')
      }
    }

    // -----------------------------------------------------------------------
    // 3. Buscar propostas do mesmo setor
    // -----------------------------------------------------------------------
    let sectorWonValues: number[] = []
    let sectorConversionRate = 0

    if (client.sector) {
      const { data: sectorProposals } = await supabase
        .from('proposals')
        .select('status, value, clients!inner(sector)')
        .eq('clients.sector', client.sector)
        .not('value', 'is', null)

      if (sectorProposals) {
        const sectorWon = sectorProposals.filter(p => p.status === 'won')
        sectorWonValues = sectorWon.map(p => p.value!).filter(v => v > 0)
        const total = sectorProposals.length
        sectorConversionRate = total > 0 ? Math.round((sectorWon.length / total) * 100) : 0
      }
    }

    // -----------------------------------------------------------------------
    // 4. Buscar tags por nome (para o prompt)
    // -----------------------------------------------------------------------
    let serviceTagNames: string[] = []
    let techTagNames: string[] = []

    if (allTagIds.length > 0) {
      try {
        const { data: tagData } = await supabase
          .from('tags')
          .select('name, category')
          .in('id', allTagIds)

        if (tagData) {
          serviceTagNames = tagData.filter(t => t.category === 'service').map(t => t.name)
          techTagNames = tagData.filter(t => t.category === 'technology').map(t => t.name)
        }
      } catch {
        // Tabela tags pode nao existir se migracao 002 nao rodou
      }
    }

    // -----------------------------------------------------------------------
    // 5. Proposta base (template)
    // -----------------------------------------------------------------------
    let baseProposal: { title: string; description: string | null; value: number | null } | null = null
    if (baseProposalId) {
      const { data } = await supabase
        .from('proposals')
        .select('title, description, value')
        .eq('id', baseProposalId)
        .single()
      baseProposal = data
    }

    // -----------------------------------------------------------------------
    // 6. Calcular estatisticas
    // -----------------------------------------------------------------------
    const wonValues = similarWon.map(p => p.value)
    const lostByPrice = similarLost.filter(p => p.loss_reason === 'price')
    const lostByPriceValues = lostByPrice.map(p => p.value)

    const clientWon = (clientProposals || []).filter(p => p.status === 'won' && p.value)
    const clientWonValues = clientWon.map(p => p.value!)

    const avgWon = wonValues.length > 0 ? Math.round(wonValues.reduce((s, v) => s + v, 0) / wonValues.length) : 0
    const medianWon = median(wonValues)
    const avgLostByPrice = lostByPriceValues.length > 0 ? Math.round(lostByPriceValues.reduce((s, v) => s + v, 0) / lostByPriceValues.length) : 0
    const avgSectorWon = sectorWonValues.length > 0 ? Math.round(sectorWonValues.reduce((s, v) => s + v, 0) / sectorWonValues.length) : 0
    const avgClientWon = clientWonValues.length > 0 ? Math.round(clientWonValues.reduce((s, v) => s + v, 0) / clientWonValues.length) : 0

    const lastLost = (clientProposals || [])
      .filter(p => p.status === 'lost')
      .sort((a, b) => (b.proposal_date || '').localeCompare(a.proposal_date || ''))
      [0]

    // -----------------------------------------------------------------------
    // 7. Chamar IA
    // -----------------------------------------------------------------------
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1200,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Voce e um consultor comercial de uma empresa de TI analisando dados historicos para precificar uma nova proposta.
Responda APENAS em JSON valido:
{
  "suggested_value": numero,
  "value_range": { "min": numero, "max": numero },
  "win_probability": decimal 0 a 1,
  "title_suggestion": "titulo sugerido",
  "description": "resumo de 2-3 frases da proposta",
  "scope_suggestion": "escopo detalhado com etapas numeradas",
  "timeline": "prazo estimado",
  "team_suggestion": "equipe sugerida",
  "alerts": ["lista de alertas e insights importantes"],
  "reasoning": "explicacao de como chegou ao valor sugerido"
}

Regras:
- O valor sugerido deve ser realista e baseado nos dados historicos fornecidos
- Se nao houver dados suficientes, use a descricao do escopo para estimar
- value_range.min deve ser ~20% abaixo do sugerido, max ~30% acima
- win_probability baseada no historico do cliente + setor + faixa de preco
- scope_suggestion deve ter etapas claras e prazo por etapa
- alerts devem ser acoes praticas para o vendedor`,
        },
        {
          role: 'user',
          content: `CLIENTE: ${client.name}
SETOR: ${client.sector || 'Nao definido'}
HEALTH SCORE: ${healthScore.score}/100

SERVICOS: ${serviceTagNames.join(', ') || 'Nao especificado'}
TECNOLOGIAS: ${techTagNames.join(', ') || 'Nao especificado'}
ESCOPO: ${scopeDescription || 'Nao descrito'}
${baseProposal ? `\nPROPOSTA BASE (template):\nTitulo: ${baseProposal.title}\nDescricao: ${baseProposal.description || 'N/A'}\nValor: ${baseProposal.value ? formatBRL(baseProposal.value) : 'N/A'}` : ''}

DADOS HISTORICOS:
- Propostas similares ganhas: ${similarWon.length} (media ${formatBRL(avgWon)}, mediana ${formatBRL(medianWon)})
- Propostas similares perdidas por preco: ${lostByPrice.length} (media ${formatBRL(avgLostByPrice)})
- Setor "${client.sector}": media ganhas ${formatBRL(avgSectorWon)}, conversao ${sectorConversionRate}%
- Este cliente: ${clientWon.length} ganhas (media ${formatBRL(avgClientWon)}), ${(clientProposals || []).filter(p => p.status === 'lost').length} perdidas
${lastLost ? `- Ultima perda: valor ${lastLost.value ? formatBRL(lastLost.value) : 'N/A'}` : ''}

Sugira valor, escopo e probabilidade para esta nova proposta.`,
        },
      ],
    })

    const content = completion.choices[0]?.message?.content?.trim() ?? '{}'
    let suggestion: Record<string, unknown>

    try {
      suggestion = JSON.parse(content)
    } catch {
      suggestion = { error: 'Falha ao interpretar resposta da IA' }
    }

    return Response.json({
      suggestion,
      stats: {
        similarWonCount: similarWon.length,
        avgWonValue: avgWon,
        medianWonValue: medianWon,
        avgLostByPriceValue: avgLostByPrice,
        sectorAvgWon: avgSectorWon,
        sectorConversionRate,
        clientAvgWon: avgClientWon,
      },
      similarProposals: {
        won: similarWon.slice(0, 5),
        lost: similarLost.slice(0, 5),
      },
      clientContext: {
        healthScore: healthScore.score,
        totalProposals: (clientProposals || []).length,
        wonProposals: clientWon.length,
        suggestions: healthScore.suggestions,
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[API /ai/proposal-builder] Erro:', msg, error)
    return Response.json({ error: `Erro: ${msg}` }, { status: 500 })
  }
}
