"use client"

import Link from "next/link"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import {
  TrendingUp,
  Target,
  DollarSign,
  Layers,
  ArrowRight,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/status-badge"
import type { ProposalStatus } from "@/types/database"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatShort(value: number) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`
  return String(value)
}

interface StageData {
  status: string
  label: string
  count: number
  totalValue: number
  probability: number
  weightedValue: number
}

interface ChartData {
  month: string
  realized: number
  forecast: number
}

interface PipelineItem {
  id: string
  title: string
  clientName: string
  clientId: string
  status: ProposalStatus
  value: number
  probability: number
  weightedValue: number
}

interface ForecastChartsProps {
  byStage: StageData[]
  chartData: ChartData[]
  topPipeline: PipelineItem[]
  totalPipeline: number
  totalWeighted: number
  realizedThisYear: number
  avgMonthly: number
}

const stageColors: Record<string, string> = {
  draft: "#a3a3a3",
  sent: "#3b82f6",
  negotiating: "#f59e0b",
}

export function ForecastCharts({
  byStage,
  chartData,
  topPipeline,
  totalPipeline,
  totalWeighted,
  realizedThisYear,
  avgMonthly,
}: ForecastChartsProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Forecast</h1>
        <p className="text-sm text-muted-foreground">
          Projecao de receita baseada no pipeline atual
        </p>
      </div>

      {/* Metricas */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/10">
              <Layers className="size-5 text-blue-500" />
            </div>
            <div>
              <p className="text-lg font-bold">{formatCurrency(totalPipeline)}</p>
              <p className="text-xs text-muted-foreground">Pipeline total</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-amber-500/10">
              <Target className="size-5 text-amber-500" />
            </div>
            <div>
              <p className="text-lg font-bold">{formatCurrency(totalWeighted)}</p>
              <p className="text-xs text-muted-foreground">Forecast ponderado</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <DollarSign className="size-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-lg font-bold">{formatCurrency(realizedThisYear)}</p>
              <p className="text-xs text-muted-foreground">Realizado este ano</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-violet-500/10">
              <TrendingUp className="size-5 text-violet-500" />
            </div>
            <div>
              <p className="text-lg font-bold">{formatCurrency(avgMonthly)}</p>
              <p className="text-xs text-muted-foreground">Media mensal</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grafico Realizado vs Projetado */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Receita Realizada vs Projetada</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" className="text-xs" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={formatShort} className="text-xs" tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value))}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend />
              <Bar dataKey="realized" name="Realizado" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="forecast" name="Projetado" fill="#8b5cf6" radius={[4, 4, 0, 0]} opacity={0.6} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Funil por estagio */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Funil por Estagio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {byStage.map((stage) => (
              <div key={stage.status} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="size-3 rounded-full"
                      style={{ backgroundColor: stageColors[stage.status] }}
                    />
                    <span className="font-medium">{stage.label}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {stage.count}
                    </Badge>
                  </div>
                  <span className="text-muted-foreground">
                    {Math.round(stage.probability * 100)}%
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <div className="h-2 flex-1 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{
                        width: `${totalPipeline > 0 ? (stage.totalValue / totalPipeline) * 100 : 0}%`,
                        backgroundColor: stageColors[stage.status],
                      }}
                    />
                  </div>
                  <span className="w-24 text-right font-medium">
                    {formatCurrency(stage.totalValue)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ponderado: {formatCurrency(stage.weightedValue)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Top propostas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topPipeline.length > 0 ? (
              topPipeline.map((item) => (
                <Link
                  key={item.id}
                  href={`/clients/${item.clientId}`}
                  className="flex items-center justify-between rounded-lg border p-2.5 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.clientName}</p>
                  </div>
                  <div className="flex items-center gap-2 text-right">
                    <div>
                      <p className="text-sm font-medium">{formatCurrency(item.value)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Pond: {formatCurrency(item.weightedValue)}
                      </p>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                </Link>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhuma proposta ativa com valor
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
