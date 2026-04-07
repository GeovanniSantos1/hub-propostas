import Link from "next/link"
import { Building2, Trophy, Handshake, XCircle, Clock, FileText } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { MetricCard } from "@/components/metric-card"
import { StatusBadge } from "@/components/status-badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ProposalStatus } from "@/types/database"

export default async function DashboardPage() {
  const supabase = await createClient()

  // Fetch total clients
  const { count: totalClients } = await supabase
    .from("clients")
    .select("*", { count: "exact", head: true })

  // Fetch proposals by status
  const { data: proposals } = await supabase
    .from("proposals")
    .select("status")

  const proposalsWon = proposals?.filter((p) => p.status === "won").length ?? 0
  const proposalsNegotiating =
    proposals?.filter((p) => p.status === "negotiating").length ?? 0
  const proposalsLost =
    proposals?.filter((p) => p.status === "lost").length ?? 0

  // Fetch recent proposals with client name
  const { data: recentProposals } = await supabase
    .from("proposals")
    .select("id, title, status, value, proposal_date, clients(name)")
    .order("created_at", { ascending: false })
    .limit(10)

  // Fetch upcoming reminders
  const { data: pendingReminders } = await supabase
    .from("reminders")
    .select("id, title, due_date, clients(name)")
    .eq("completed", false)
    .gte("due_date", new Date().toISOString())
    .order("due_date", { ascending: true })
    .limit(5)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Visao geral do Hub Propostas
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={Building2}
          value={totalClients ?? 0}
          label="Total Clientes"
        />
        <MetricCard
          icon={Trophy}
          value={proposalsWon}
          label="Ganhas"
        />
        <MetricCard
          icon={Handshake}
          value={proposalsNegotiating}
          label="Em Negociacao"
        />
        <MetricCard
          icon={XCircle}
          value={proposalsLost}
          label="Perdidas"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Proposals */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-4" />
              Propostas Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentProposals && recentProposals.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proposta</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentProposals.map((proposal) => {
                    const client = proposal.clients as unknown as { name: string } | null
                    return (
                      <TableRow key={proposal.id}>
                        <TableCell className="font-medium">
                          {proposal.title}
                        </TableCell>
                        <TableCell>{client?.name ?? "-"}</TableCell>
                        <TableCell>
                          <StatusBadge
                            status={proposal.status as ProposalStatus}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          {proposal.value
                            ? new Intl.NumberFormat("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              }).format(proposal.value)
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {proposal.proposal_date
                            ? new Date(proposal.proposal_date).toLocaleDateString("pt-BR")
                            : "-"}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <FileText className="mb-2 size-8 opacity-50" />
                <p>Nenhum registro</p>
                <p className="text-xs">As propostas criadas aparecerao aqui</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Reminders */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-4" />
              Lembretes Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingReminders && pendingReminders.length > 0 ? (
              <div className="space-y-3">
                {pendingReminders.map((reminder) => {
                  const client = reminder.clients as unknown as { name: string } | null
                  const dueDate = new Date(reminder.due_date)
                  const isToday =
                    dueDate.toDateString() === new Date().toDateString()
                  const isOverdue = dueDate < new Date()

                  return (
                    <div
                      key={reminder.id}
                      className="flex flex-col gap-1 rounded-lg border p-3"
                    >
                      <p className="text-sm font-medium">{reminder.title}</p>
                      {client?.name && (
                        <p className="text-xs text-muted-foreground">
                          {client.name}
                        </p>
                      )}
                      <p
                        className={`text-xs font-medium ${
                          isOverdue
                            ? "text-red-500"
                            : isToday
                              ? "text-amber-500"
                              : "text-muted-foreground"
                        }`}
                      >
                        {dueDate.toLocaleDateString("pt-BR")}
                        {isToday && " (Hoje)"}
                        {isOverdue && !isToday && " (Atrasado)"}
                      </p>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <Clock className="mb-2 size-8 opacity-50" />
                <p>Nenhum registro</p>
                <p className="text-xs">
                  Lembretes futuros aparecerao aqui
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
