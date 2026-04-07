"use client"

import * as React from "react"
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { utils, writeFile } from "xlsx"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Download, TrendingUp, Target, FileText } from "lucide-react"

const STATUS_COLORS: Record<string, string> = {
  won: "#10b981",
  negotiating: "#f59e0b",
  lost: "#ef4444",
  draft: "#6b7280",
  sent: "#3b82f6",
}

const STATUS_LABELS: Record<string, string> = {
  won: "Ganha",
  negotiating: "Negociando",
  lost: "Perdida",
  draft: "Rascunho",
  sent: "Enviada",
}

interface ReportsChartsProps {
  proposalsByStatus: { status: string; count: number }[]
  proposalsByMonth: { month: string; count: number }[]
  topClients: { name: string; proposals: number }[]
  conversionRate: number
  totalProposals: number
  wonProposals: number
}

export function ReportsCharts({
  proposalsByStatus,
  proposalsByMonth,
  topClients,
  conversionRate,
  totalProposals,
  wonProposals,
}: ReportsChartsProps) {
  const pieData = proposalsByStatus
    .filter((d) => d.count > 0)
    .map((d) => ({
      name: STATUS_LABELS[d.status] || d.status,
      value: d.count,
      color: STATUS_COLORS[d.status] || "#6b7280",
    }))

  function handleExport() {
    const wb = utils.book_new()

    const statusSheet = utils.json_to_sheet(
      proposalsByStatus.map((d) => ({
        Status: STATUS_LABELS[d.status] || d.status,
        Quantidade: d.count,
      }))
    )
    utils.book_append_sheet(wb, statusSheet, "Por Status")

    const monthSheet = utils.json_to_sheet(
      proposalsByMonth.map((d) => ({
        Mes: d.month,
        Propostas: d.count,
      }))
    )
    utils.book_append_sheet(wb, monthSheet, "Por Mes")

    const clientSheet = utils.json_to_sheet(
      topClients.map((d) => ({
        Cliente: d.name,
        Propostas: d.proposals,
      }))
    )
    utils.book_append_sheet(wb, clientSheet, "Top Clientes")

    const summarySheet = utils.json_to_sheet([
      {
        Metrica: "Total de Propostas",
        Valor: totalProposals,
      },
      {
        Metrica: "Propostas Ganhas",
        Valor: wonProposals,
      },
      {
        Metrica: "Taxa de Conversao (%)",
        Valor: conversionRate,
      },
    ])
    utils.book_append_sheet(wb, summarySheet, "Resumo")

    writeFile(wb, "relatorio-propostas.xlsx")
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card size="sm">
          <CardContent className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalProposals}</p>
              <p className="text-sm text-muted-foreground">Total de propostas</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <TrendingUp className="size-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{wonProposals}</p>
              <p className="text-sm text-muted-foreground">Propostas ganhas</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-amber-500/10">
              <Target className="size-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{conversionRate}%</p>
              <p className="text-sm text-muted-foreground">Taxa de conversao</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pie chart */}
        <Card>
          <CardHeader>
            <CardTitle>Propostas por Status</CardTitle>
            <CardDescription>Distribuicao atual das propostas</CardDescription>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[280px] items-center justify-center text-muted-foreground">
                Sem dados disponíveis
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bar chart */}
        <Card>
          <CardHeader>
            <CardTitle>Propostas por Mes</CardTitle>
            <CardDescription>Ultimos 12 meses</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={proposalsByMonth}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12 }}
                  className="fill-muted-foreground"
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12 }}
                  className="fill-muted-foreground"
                />
                <Tooltip />
                <Bar
                  dataKey="count"
                  name="Propostas"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top clients table */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle>Top 10 Clientes</CardTitle>
            <CardDescription>
              Clientes com mais propostas
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="size-4" />
            Exportar XLSX
          </Button>
        </CardHeader>
        <CardContent>
          {topClients.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Propostas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topClients.map((client, idx) => (
                  <TableRow key={client.name}>
                    <TableCell className="text-muted-foreground">
                      {idx + 1}
                    </TableCell>
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell className="text-right">
                      {client.proposals}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-8 text-center text-muted-foreground">
              Sem dados disponíveis
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
