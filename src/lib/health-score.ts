/**
 * Calculo do Health Score do cliente (0-100).
 *
 * Fatores:
 *   - Frequencia de interacoes (25%)
 *   - Taxa de conversao de propostas (25%)
 *   - Recencia da ultima interacao (20%)
 *   - Volume financeiro (15%)
 *   - Diversidade de servicos (15%)
 */

export interface HealthScoreFactors {
  interactionFrequency: { score: number; detail: string }
  conversionRate: { score: number; detail: string }
  recency: { score: number; detail: string }
  financialVolume: { score: number; detail: string }
  serviceDiversity: { score: number; detail: string }
}

export interface HealthScoreResult {
  score: number
  factors: HealthScoreFactors
  lastInteractionAt: string | null
  daysSinceContact: number
  suggestions: string[]
}

interface ClientData {
  interactions: { interaction_date: string }[]
  proposals: { status: string; value: number | null; updated_at: string; title: string }[]
}

export function calculateHealthScore(client: ClientData): HealthScoreResult {
  const now = new Date()
  const interactions = client.interactions || []
  const proposals = client.proposals || []

  // ---- 1. Frequencia de interacoes (25%) ----
  // 12+ interacoes/ano = 100, 0 = 0
  const oneYearAgo = new Date(now)
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  const recentInteractions = interactions.filter(
    (i) => new Date(i.interaction_date) >= oneYearAgo
  ).length
  const freqScore = Math.min(100, Math.round((recentInteractions / 12) * 100))

  // ---- 2. Taxa de conversao (25%) ----
  const totalProposals = proposals.length
  const wonProposals = proposals.filter((p) => p.status === "won").length
  const convScore = totalProposals > 0
    ? Math.round((wonProposals / totalProposals) * 100)
    : 0

  // ---- 3. Recencia (20%) ----
  // Contato nos ultimos 30 dias = 100, 365+ dias = 0
  function safeDate(val: string): Date | null {
    if (!val) return null
    const d = new Date(val)
    return isNaN(d.getTime()) ? null : d
  }

  const allDates: Date[] = [
    ...interactions.map((i) => safeDate(i.interaction_date)).filter((d): d is Date => d !== null),
    ...proposals.map((p) => safeDate(p.updated_at)).filter((d): d is Date => d !== null),
  ]
  const lastContact = allDates.length > 0
    ? new Date(Math.max(...allDates.map((d) => d.getTime())))
    : null
  const daysSinceContact = lastContact
    ? Math.floor((now.getTime() - lastContact.getTime()) / (1000 * 60 * 60 * 24))
    : 999

  let recencyScore = 0
  if (daysSinceContact <= 30) recencyScore = 100
  else if (daysSinceContact <= 60) recencyScore = 80
  else if (daysSinceContact <= 90) recencyScore = 60
  else if (daysSinceContact <= 180) recencyScore = 30
  else if (daysSinceContact <= 365) recencyScore = 10

  // ---- 4. Volume financeiro (15%) ----
  // Baseado no valor total de propostas ganhas
  const totalWonValue = proposals
    .filter((p) => p.status === "won")
    .reduce((sum, p) => sum + (p.value || 0), 0)

  let finScore = 0
  if (totalWonValue >= 500000) finScore = 100
  else if (totalWonValue >= 200000) finScore = 80
  else if (totalWonValue >= 100000) finScore = 60
  else if (totalWonValue >= 50000) finScore = 40
  else if (totalWonValue > 0) finScore = 20

  // ---- 5. Diversidade de servicos (15%) ----
  // Baseado em propostas distintas (titulos unicos)
  const uniqueTitles = new Set(proposals.map((p) => p.title.split(" - ")[0])).size
  let divScore = 0
  if (uniqueTitles >= 5) divScore = 100
  else if (uniqueTitles >= 3) divScore = 70
  else if (uniqueTitles >= 2) divScore = 40
  else if (uniqueTitles >= 1) divScore = 20

  // ---- Score final ponderado ----
  const score = Math.round(
    freqScore * 0.25 +
    convScore * 0.25 +
    recencyScore * 0.20 +
    finScore * 0.15 +
    divScore * 0.15
  )

  // ---- Sugestoes ----
  const suggestions: string[] = []
  if (daysSinceContact > 60) {
    suggestions.push(`Sem contato ha ${daysSinceContact} dias. Agende um follow-up.`)
  }
  if (convScore < 30 && totalProposals > 2) {
    suggestions.push("Taxa de conversao baixa. Revise a abordagem comercial.")
  }
  if (wonProposals > 0 && uniqueTitles <= 1) {
    suggestions.push("Cliente ja comprou, mas apenas 1 tipo de servico. Oportunidade de cross-sell.")
  }
  const lostProposals = proposals.filter((p) => p.status === "lost")
  if (lostProposals.length > 0 && daysSinceContact > 180) {
    suggestions.push(`${lostProposals.length} proposta(s) perdida(s). Considere retomar com nova abordagem.`)
  }
  if (recentInteractions === 0) {
    suggestions.push("Nenhuma interacao no ultimo ano. Cliente precisa de atencao.")
  }

  const formatValue = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v)

  return {
    score,
    factors: {
      interactionFrequency: {
        score: freqScore,
        detail: `${recentInteractions} interacoes no ultimo ano`,
      },
      conversionRate: {
        score: convScore,
        detail: `${wonProposals}/${totalProposals} propostas ganhas`,
      },
      recency: {
        score: recencyScore,
        detail: lastContact
          ? `Ultimo contato ha ${daysSinceContact} dias`
          : "Sem contato registrado",
      },
      financialVolume: {
        score: finScore,
        detail: totalWonValue > 0
          ? `${formatValue(totalWonValue)} em propostas ganhas`
          : "Sem receita registrada",
      },
      serviceDiversity: {
        score: divScore,
        detail: `${uniqueTitles} tipo(s) de servico`,
      },
    },
    lastInteractionAt: lastContact?.toISOString() ?? null,
    daysSinceContact,
    suggestions,
  }
}
