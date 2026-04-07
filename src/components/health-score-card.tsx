"use client"

import * as React from "react"
import { Activity, Loader2, Lightbulb } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { HealthScoreResult } from "@/lib/health-score"

function getScoreColor(score: number) {
  if (score >= 70) return { text: "text-emerald-500", bg: "bg-emerald-500", ring: "ring-emerald-500/20" }
  if (score >= 40) return { text: "text-amber-500", bg: "bg-amber-500", ring: "ring-amber-500/20" }
  return { text: "text-red-500", bg: "bg-red-500", ring: "ring-red-500/20" }
}

function getScoreLabel(score: number) {
  if (score >= 70) return "Saudavel"
  if (score >= 40) return "Atencao"
  return "Critico"
}

const factorLabels: Record<string, string> = {
  interactionFrequency: "Frequencia",
  conversionRate: "Conversao",
  recency: "Recencia",
  financialVolume: "Volume",
  serviceDiversity: "Diversidade",
}

interface HealthScoreCardProps {
  clientId: string
}

export function HealthScoreCard({ clientId }: HealthScoreCardProps) {
  const [data, setData] = React.useState<HealthScoreResult | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/health-score?clientId=${clientId}`)
        if (res.ok) {
          const result = await res.json()
          setData(result)
        }
      } catch {
        // silenciar
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [clientId])

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (!data) return null

  const colors = getScoreColor(data.score)

  return (
    <Card className={`ring-1 ${colors.ring}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Activity className="size-4" />
          Health Score
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score principal */}
        <div className="flex items-center gap-3">
          <div className={`flex size-14 items-center justify-center rounded-full ${colors.bg}/10`}>
            <span className={`text-2xl font-bold ${colors.text}`}>
              {data.score}
            </span>
          </div>
          <div>
            <p className={`text-sm font-semibold ${colors.text}`}>
              {getScoreLabel(data.score)}
            </p>
            <p className="text-xs text-muted-foreground">
              {data.daysSinceContact > 0
                ? `${data.daysSinceContact} dias sem contato`
                : "Contato recente"}
            </p>
          </div>
        </div>

        {/* Barras por fator */}
        <div className="space-y-2">
          {Object.entries(data.factors).map(([key, factor]) => {
            const factorColor = getScoreColor(factor.score)
            return (
              <div key={key}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {factorLabels[key] || key}
                  </span>
                  <span className={`font-medium ${factorColor.text}`}>
                    {factor.score}
                  </span>
                </div>
                <div className="mt-0.5 h-1.5 rounded-full bg-muted">
                  <div
                    className={`h-1.5 rounded-full ${factorColor.bg} transition-all`}
                    style={{ width: `${factor.score}%` }}
                  />
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {factor.detail}
                </p>
              </div>
            )
          })}
        </div>

        {/* Sugestoes */}
        {data.suggestions.length > 0 && (
          <div className="space-y-1.5 rounded-lg bg-amber-500/5 p-2.5">
            <p className="flex items-center gap-1 text-xs font-medium text-amber-600">
              <Lightbulb className="size-3" />
              Sugestoes
            </p>
            {data.suggestions.map((s, i) => (
              <p key={i} className="text-xs text-muted-foreground">
                {s}
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
