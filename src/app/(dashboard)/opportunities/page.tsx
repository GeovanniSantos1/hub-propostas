import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import {
  Radar,
  RotateCcw,
  Clock,
  Building2,
  AlertTriangle,
  TrendingUp,
  CalendarClock,
  ArrowRight,
  Flame,
  Thermometer,
  Snowflake,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/status-badge"
import type { ProposalStatus, LossReason } from "@/types/database"

const lossReasonLabels: Record<string, string> = {
  price: "Preco",
  deadline: "Prazo",
  competitor: "Concorrente",
  cancelled: "Cancelado",
  budget: "Budget",
  scope: "Escopo",
  other: "Outro",
}

function formatCurrency(value: number | null) {
  if (value === null || value === undefined) return "-"
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(date: string | null) {
  if (!date) return "-"
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date))
}

function daysSince(date: string): number {
  return Math.floor(
    (new Date().getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24)
  )
}

type Temperature = "hot" | "warm" | "cold"

function getTemperature(daysSinceContact: number): Temperature {
  if (daysSinceContact <= 90) return "hot"
  if (daysSinceContact <= 180) return "warm"
  return "cold"
}

const tempConfig: Record<Temperature, { label: string; color: string; icon: typeof Flame; bgColor: string }> = {
  hot: { label: "Quente", color: "text-red-500", icon: Flame, bgColor: "bg-red-500/10" },
  warm: { label: "Morno", color: "text-amber-500", icon: Thermometer, bgColor: "bg-amber-500/10" },
  cold: { label: "Frio", color: "text-blue-400", icon: Snowflake, bgColor: "bg-blue-400/10" },
}

export default async function OpportunitiesPage() {
  const supabase = await createClient()
  const now = new Date()

  // -----------------------------------------------------------------------
  // 1. Propostas perdidas com data de retomada
  // -----------------------------------------------------------------------
  const { data: retryProposals } = await supabase
    .from("proposals")
    .select("*, clients!inner(name)")
    .eq("status", "lost")
    .not("retry_date", "is", null)
    .lte("retry_date", now.toISOString().split("T")[0])
    .order("retry_date", { ascending: true })

  // -----------------------------------------------------------------------
  // 2. Propostas perdidas ha mais de 6 meses (sem retry_date) - oportunidade de retomada
  // -----------------------------------------------------------------------
  const sixMonthsAgo = new Date(now)
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const { data: oldLostProposals } = await supabase
    .from("proposals")
    .select("*, clients!inner(name)")
    .eq("status", "lost")
    .is("retry_date", null)
    .lt("updated_at", sixMonthsAgo.toISOString())
    .order("value", { ascending: false, nullsFirst: false })
    .limit(20)

  // -----------------------------------------------------------------------
  // 3. Clientes dormentes (sem interacao recente)
  // -----------------------------------------------------------------------
  const { data: allClients } = await supabase
    .from("clients")
    .select(`
      id, name, status,
      interactions(interaction_date),
      proposals(id, status, value, title, updated_at)
    `)
    .eq("status", "active")
    .order("name")

  // Calcular clientes dormentes
  interface DormantClient {
    id: string
    name: string
    lastContact: string | null
    daysSinceContact: number
    temperature: Temperature
    totalProposals: number
    wonProposals: number
    totalValue: number
    reason: string
  }

  const dormantClients: DormantClient[] = []

  if (allClients) {
    for (const client of allClients) {
      const interactions = client.interactions as { interaction_date: string }[] || []
      const proposals = client.proposals as { id: string; status: string; value: number | null; title: string; updated_at: string }[] || []

      // Encontrar data de ultimo contato (mais recente entre interacao e proposta)
      const dates: Date[] = []
      for (const i of interactions) {
        dates.push(new Date(i.interaction_date))
      }
      for (const p of proposals) {
        dates.push(new Date(p.updated_at))
      }

      if (dates.length === 0) continue // sem historico

      const lastContact = new Date(Math.max(...dates.map((d) => d.getTime())))
      const daysSinceLastContact = daysSince(lastContact.toISOString())

      if (daysSinceLastContact < 60) continue // contato recente, pular

      const wonCount = proposals.filter((p) => p.status === "won").length
      const totalValue = proposals.reduce((sum, p) => sum + (p.value || 0), 0)

      // Determinar razao da oportunidade
      let reason = "Sem contato recente"
      if (proposals.length === 1) reason = "Apenas 1 proposta - potencial de cross-sell"
      else if (wonCount > 0 && daysSinceLastContact > 180) reason = "Cliente ja comprou, sem contato ha 6+ meses"
      else if (wonCount === 0) reason = "Nunca converteu - oportunidade de reengajamento"

      dormantClients.push({
        id: client.id,
        name: client.name,
        lastContact: lastContact.toISOString(),
        daysSinceContact: daysSinceLastContact,
        temperature: getTemperature(daysSinceLastContact),
        totalProposals: proposals.length,
        wonProposals: wonCount,
        totalValue,
        reason,
      })
    }
  }

  // Ordenar por temperatura (quentes primeiro) e depois por valor
  dormantClients.sort((a, b) => {
    const tempOrder = { hot: 0, warm: 1, cold: 2 }
    if (tempOrder[a.temperature] !== tempOrder[b.temperature]) {
      return tempOrder[a.temperature] - tempOrder[b.temperature]
    }
    return b.totalValue - a.totalValue
  })

  // Limitar a 30
  const topDormant = dormantClients.slice(0, 30)

  // -----------------------------------------------------------------------
  // Metricas
  // -----------------------------------------------------------------------
  const retryCount = retryProposals?.length || 0
  const dormantCount = topDormant.length
  const hotCount = topDormant.filter((c) => c.temperature === "hot").length

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Oportunidades</h1>
        <p className="text-sm text-muted-foreground">
          Radar de oportunidades e propostas para retomada
        </p>
      </div>

      {/* Metricas */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-red-500/10">
              <RotateCcw className="size-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{retryCount}</p>
              <p className="text-xs text-muted-foreground">Para retomada</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-amber-500/10">
              <Radar className="size-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{dormantCount}</p>
              <p className="text-xs text-muted-foreground">Clientes dormentes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-red-500/10">
              <Flame className="size-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{hotCount}</p>
              <p className="text-xs text-muted-foreground">Oportunidades quentes</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Propostas para retomada (com retry_date vencida) */}
      {retryProposals && retryProposals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="size-5 text-red-500" />
              Propostas para retomada
              <Badge variant="destructive">{retryProposals.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {retryProposals.map((proposal) => {
              const client = proposal.clients as unknown as { name: string }
              return (
                <div
                  key={proposal.id}
                  className="flex items-center gap-4 rounded-lg border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{proposal.title}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Building2 className="size-3" />
                        {client?.name}
                      </span>
                      {proposal.loss_reason && (
                        <Badge variant="outline" className="text-[10px]">
                          {lossReasonLabels[proposal.loss_reason] || proposal.loss_reason}
                        </Badge>
                      )}
                      {proposal.value && (
                        <span className="font-medium">
                          {formatCurrency(proposal.value)}
                        </span>
                      )}
                    </div>
                    {proposal.loss_notes && (
                      <p className="mt-1 text-xs text-muted-foreground italic">
                        {proposal.loss_notes}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-red-500">
                      Retomar desde {formatDate(proposal.retry_date)}
                    </p>
                    <Link href={`/clients/${proposal.client_id}`}>
                      <Button variant="outline" size="sm" className="mt-1">
                        Ver cliente
                        <ArrowRight className="size-3" />
                      </Button>
                    </Link>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Propostas perdidas antigas (potencial de retomada) */}
      {oldLostProposals && oldLostProposals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RotateCcw className="size-5 text-amber-500" />
              Perdidas ha mais de 6 meses
              <Badge variant="secondary">{oldLostProposals.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {oldLostProposals.map((proposal) => {
              const client = proposal.clients as unknown as { name: string }
              const days = daysSince(proposal.updated_at)
              return (
                <Link
                  key={proposal.id}
                  href={`/clients/${proposal.client_id}`}
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{proposal.title}</p>
                    <p className="text-xs text-muted-foreground">{client?.name}</p>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    {proposal.value && (
                      <span className="text-sm font-medium">
                        {formatCurrency(proposal.value)}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {days} dias
                    </span>
                  </div>
                </Link>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Radar - Clientes Dormentes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Radar className="size-5 text-primary" />
            Radar de Clientes Dormentes
            <Badge variant="secondary">{topDormant.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {topDormant.length > 0 ? (
            topDormant.map((client) => {
              const config = tempConfig[client.temperature]
              const TempIcon = config.icon

              return (
                <Link
                  key={client.id}
                  href={`/clients/${client.id}`}
                  className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className={`flex size-8 items-center justify-center rounded-lg ${config.bgColor}`}>
                    <TempIcon className={`size-4 ${config.color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{client.name}</p>
                      <Badge variant="outline" className={`text-[10px] ${config.color}`}>
                        {config.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {client.reason}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      {client.daysSinceContact} dias sem contato
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{client.totalProposals} prop.</span>
                      <span>{client.wonProposals} ganhas</span>
                      {client.totalValue > 0 && (
                        <span className="font-medium">
                          {formatCurrency(client.totalValue)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum cliente dormante encontrado. Todos estao ativos!
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
