"use client"

import * as React from "react"
import { Sparkles, Loader2, TrendingUp, ArrowRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface Suggestion {
  title: string
  reason: string
  confidence: "high" | "medium" | "low"
  estimated_value: number | null
}

const confidenceConfig = {
  high: { label: "Alta", color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/30" },
  medium: { label: "Media", color: "text-amber-600 bg-amber-500/10 border-amber-500/30" },
  low: { label: "Baixa", color: "text-neutral-500 bg-neutral-500/10 border-neutral-500/30" },
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value)
}

interface CrossSellCardProps {
  clientId: string
}

export function CrossSellCard({ clientId }: CrossSellCardProps) {
  const [suggestions, setSuggestions] = React.useState<Suggestion[]>([])
  const [loading, setLoading] = React.useState(false)
  const [loaded, setLoaded] = React.useState(false)

  async function loadSuggestions() {
    setLoading(true)
    try {
      const res = await fetch(`/api/ai/cross-sell?clientId=${clientId}`)
      if (res.ok) {
        const data = await res.json()
        setSuggestions(data.suggestions || [])
      }
    } catch {
      // silenciar
    } finally {
      setLoading(false)
      setLoaded(true)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <TrendingUp className="size-4" />
          Oportunidades Sugeridas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!loaded && !loading && (
          <div className="flex flex-col items-center gap-2 py-4">
            <p className="text-xs text-muted-foreground">
              Analise com IA para identificar oportunidades
            </p>
            <Button variant="outline" size="sm" onClick={loadSuggestions}>
              <Sparkles className="size-3.5" />
              Gerar sugestoes
            </Button>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 py-6">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Analisando...</span>
          </div>
        )}

        {loaded && !loading && suggestions.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Nenhuma sugestao identificada
          </p>
        )}

        {suggestions.length > 0 && (
          <div className="space-y-2.5">
            {suggestions.map((s, idx) => {
              const conf = confidenceConfig[s.confidence] || confidenceConfig.low
              return (
                <div
                  key={idx}
                  className="rounded-lg border p-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{s.title}</p>
                    <Badge variant="outline" className={`shrink-0 text-[10px] ${conf.color}`}>
                      {conf.label}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {s.reason}
                  </p>
                  {s.estimated_value && (
                    <p className="mt-1 text-xs font-medium text-emerald-600">
                      Valor estimado: {formatCurrency(s.estimated_value)}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
