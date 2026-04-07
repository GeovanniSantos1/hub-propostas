import { createClient } from "@/lib/supabase/server"
import { ForecastCharts } from "@/components/forecast-charts"
import type { ProposalStatus } from "@/types/database"

// Probabilidade de conversao por estagio (configuravel)
const stageProbability: Record<string, number> = {
  draft: 0.05,
  sent: 0.20,
  negotiating: 0.50,
  won: 1.0,
  lost: 0,
}

export default async function ForecastPage() {
  const supabase = await createClient()

  const { data: proposals } = await supabase
    .from("proposals")
    .select("id, title, status, value, proposal_date, created_at, client_id, clients!inner(name)")
    .order("created_at", { ascending: false })

  // ---- Calcular forecast ----
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  // Pipeline ativo (nao won/lost)
  const activeProposals = (proposals || []).filter(
    (p) => p.status !== "won" && p.status !== "lost"
  )

  // Forecast ponderado
  const totalWeighted = activeProposals.reduce((sum, p) => {
    const prob = stageProbability[p.status] || 0
    return sum + (p.value || 0) * prob
  }, 0)

  // Forecast por estagio
  const byStage = ["draft", "sent", "negotiating"].map((status) => {
    const items = activeProposals.filter((p) => p.status === status)
    const totalValue = items.reduce((s, p) => s + (p.value || 0), 0)
    const prob = stageProbability[status] || 0
    return {
      status,
      label: { draft: "Rascunho", sent: "Enviada", negotiating: "Negociando" }[status] || status,
      count: items.length,
      totalValue,
      probability: prob,
      weightedValue: totalValue * prob,
    }
  })

  // Receita realizada por mes (ultimos 12 meses)
  const wonProposals = (proposals || []).filter((p) => p.status === "won" && p.value)
  const monthlyRealized: { month: string; realized: number; forecast: number }[] = []

  for (let i = 11; i >= 0; i--) {
    const d = new Date(currentYear, currentMonth - i, 1)
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })

    const realized = wonProposals
      .filter((p) => {
        const pd = new Date(p.proposal_date || p.created_at)
        return pd.getFullYear() === d.getFullYear() && pd.getMonth() === d.getMonth()
      })
      .reduce((s, p) => s + (p.value || 0), 0)

    monthlyRealized.push({ month: label, realized, forecast: 0 })
  }

  // Projetar proximos 3 meses com base na media dos ultimos 6
  const last6 = monthlyRealized.slice(-6)
  const avgMonthly = last6.reduce((s, m) => s + m.realized, 0) / Math.max(last6.length, 1)

  const futureMonths: typeof monthlyRealized = []
  for (let i = 1; i <= 3; i++) {
    const d = new Date(currentYear, currentMonth + i, 1)
    const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
    futureMonths.push({
      month: label,
      realized: 0,
      forecast: Math.round(avgMonthly + totalWeighted / 3),
    })
  }

  const chartData = [...monthlyRealized, ...futureMonths]

  // Top propostas no pipeline
  const topPipeline = activeProposals
    .filter((p) => p.value && p.value > 0)
    .sort((a, b) => (b.value || 0) * (stageProbability[b.status] || 0) - (a.value || 0) * (stageProbability[a.status] || 0))
    .slice(0, 10)
    .map((p) => ({
      id: p.id,
      title: p.title,
      clientName: (p.clients as unknown as { name: string })?.name || "",
      clientId: p.client_id,
      status: p.status as ProposalStatus,
      value: p.value || 0,
      probability: stageProbability[p.status] || 0,
      weightedValue: (p.value || 0) * (stageProbability[p.status] || 0),
    }))

  // Metricas
  const totalPipeline = activeProposals.reduce((s, p) => s + (p.value || 0), 0)
  const realizedThisYear = wonProposals
    .filter((p) => {
      const d = new Date(p.proposal_date || p.created_at)
      return d.getFullYear() === currentYear
    })
    .reduce((s, p) => s + (p.value || 0), 0)

  return (
    <ForecastCharts
      byStage={byStage}
      chartData={chartData}
      topPipeline={topPipeline}
      totalPipeline={totalPipeline}
      totalWeighted={totalWeighted}
      realizedThisYear={realizedThisYear}
      avgMonthly={avgMonthly}
    />
  )
}
