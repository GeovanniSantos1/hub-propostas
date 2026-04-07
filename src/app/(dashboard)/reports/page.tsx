import { createClient } from "@/lib/supabase/server"
import { ReportsCharts } from "@/components/reports-charts"

export default async function ReportsPage() {
  const supabase = await createClient()

  // Proposals by status
  const { data: allProposals } = await supabase
    .from("proposals")
    .select("id, status, value, created_at, client_id")

  const proposals = allProposals || []

  const statusCounts: Record<string, number> = {
    draft: 0,
    sent: 0,
    negotiating: 0,
    won: 0,
    lost: 0,
  }
  for (const p of proposals) {
    if (p.status in statusCounts) {
      statusCounts[p.status]++
    }
  }

  const proposalsByStatus = Object.entries(statusCounts).map(
    ([status, count]) => ({
      status,
      count,
    })
  )

  // Proposals by month (last 12 months)
  const now = new Date()
  const monthsData: { month: string; count: number }[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const label = new Intl.DateTimeFormat("pt-BR", {
      month: "short",
      year: "2-digit",
    }).format(d)
    const count = proposals.filter((p) => {
      const pDate = new Date(p.created_at)
      return (
        pDate.getFullYear() === d.getFullYear() &&
        pDate.getMonth() === d.getMonth()
      )
    }).length
    monthsData.push({ month: label, count })
  }

  // Top 10 clients by number of proposals
  const clientProposalCounts: Record<string, number> = {}
  for (const p of proposals) {
    clientProposalCounts[p.client_id] = (clientProposalCounts[p.client_id] || 0) + 1
  }

  const topClientIds = Object.entries(clientProposalCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([id]) => id)

  let topClients: { name: string; proposals: number }[] = []
  if (topClientIds.length > 0) {
    const { data: clientsData } = await supabase
      .from("clients")
      .select("id, name")
      .in("id", topClientIds)

    const clientNameMap: Record<string, string> = {}
    for (const c of clientsData || []) {
      clientNameMap[c.id] = c.name
    }

    topClients = topClientIds.map((id) => ({
      name: clientNameMap[id] || "Desconhecido",
      proposals: clientProposalCounts[id],
    }))
  }

  // Conversion rate
  const totalProposals = proposals.length
  const wonProposals = statusCounts.won
  const conversionRate =
    totalProposals > 0
      ? parseFloat(((wonProposals / totalProposals) * 100).toFixed(1))
      : 0

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Relatorios</h1>
        <p className="text-sm text-muted-foreground">
          Visao geral das propostas e desempenho comercial
        </p>
      </div>

      <ReportsCharts
        proposalsByStatus={proposalsByStatus}
        proposalsByMonth={monthsData}
        topClients={topClients}
        conversionRate={conversionRate}
        totalProposals={totalProposals}
        wonProposals={wonProposals}
      />
    </div>
  )
}
