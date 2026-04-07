"use client"

import * as React from "react"
import {
  GitCompareArrows,
  Search,
  X,
  Loader2,
  FileText,
  Building2,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { StatusBadge } from "@/components/status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import type { ProposalStatus } from "@/types/database"

interface CompareProposal {
  id: string
  title: string
  status: ProposalStatus
  value: number | null
  proposal_date: string | null
  description: string | null
  proposal_number: string | null
  client_name: string
  client_id: string
  files_count: number
  loss_reason: string | null
  loss_notes: string | null
}

function formatCurrency(value: number | null) {
  if (!value) return "-"
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function formatDate(date: string | null) {
  if (!date) return "-"
  return new Intl.DateTimeFormat("pt-BR").format(new Date(date))
}

const lossReasonLabels: Record<string, string> = {
  price: "Preco", deadline: "Prazo", competitor: "Concorrente",
  cancelled: "Cancelado", budget: "Budget", scope: "Escopo", other: "Outro",
}

// Search component for selecting proposals
function ProposalSelector({
  label,
  selected,
  onSelect,
  onClear,
}: {
  label: string
  selected: CompareProposal | null
  onSelect: (p: CompareProposal) => void
  onClear: () => void
}) {
  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<CompareProposal[]>([])
  const [loading, setLoading] = React.useState(false)
  const [showResults, setShowResults] = React.useState(false)

  React.useEffect(() => {
    if (query.length < 2) { setResults([]); return }

    setLoading(true)
    const timer = setTimeout(async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from("proposals")
        .select("id, title, status, value, proposal_date, description, proposal_number, loss_reason, loss_notes, client_id, clients!inner(name), proposal_files(id)")
        .or(`title.ilike.%${query}%,proposal_number.ilike.%${query}%,clients.name.ilike.%${query}%`)
        .order("created_at", { ascending: false })
        .limit(8)

      if (data) {
        setResults(
          data.map((p) => ({
            id: p.id,
            title: p.title,
            status: p.status as ProposalStatus,
            value: p.value,
            proposal_date: p.proposal_date,
            description: p.description,
            proposal_number: p.proposal_number,
            client_name: (p.clients as unknown as { name: string })?.name || "",
            client_id: p.client_id,
            files_count: Array.isArray(p.proposal_files) ? p.proposal_files.length : 0,
            loss_reason: p.loss_reason,
            loss_notes: p.loss_notes,
          }))
        )
      }
      setLoading(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  if (selected) {
    return (
      <div className="rounded-lg border p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold">{selected.title}</p>
            <p className="text-xs text-muted-foreground">{selected.client_name}</p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClear}>
            <X className="size-3.5" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Buscar proposta..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShowResults(true) }}
          onFocus={() => setShowResults(true)}
          className="pl-9"
        />
      </div>
      {showResults && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover shadow-lg">
          {results.map((p) => (
            <button
              key={p.id}
              className="flex w-full items-center gap-2 border-b px-3 py-2 text-sm last:border-b-0 hover:bg-muted"
              onClick={() => {
                onSelect(p)
                setQuery("")
                setShowResults(false)
              }}
            >
              <FileText className="size-3.5 shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0 text-left">
                <p className="truncate font-medium">{p.title}</p>
                <p className="text-xs text-muted-foreground">{p.client_name}</p>
              </div>
              <StatusBadge status={p.status} />
            </button>
          ))}
        </div>
      )}
      {loading && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover p-3 shadow-lg">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  )
}

// Comparison row
function CompRow({
  label,
  left,
  right,
  highlight,
}: {
  label: string
  left: React.ReactNode
  right: React.ReactNode
  highlight?: boolean
}) {
  return (
    <div className={`grid grid-cols-[120px_1fr_1fr] gap-4 rounded-lg px-3 py-2 ${highlight ? "bg-muted/50" : ""}`}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm">{left}</span>
      <span className="text-sm">{right}</span>
    </div>
  )
}

export default function ComparePage() {
  const [left, setLeft] = React.useState<CompareProposal | null>(null)
  const [right, setRight] = React.useState<CompareProposal | null>(null)

  const canCompare = left && right

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Comparar Propostas</h1>
        <p className="text-sm text-muted-foreground">
          Compare duas propostas lado a lado
        </p>
      </div>

      {/* Selectors */}
      <div className="grid gap-4 sm:grid-cols-2">
        <ProposalSelector
          label="Proposta A"
          selected={left}
          onSelect={setLeft}
          onClear={() => setLeft(null)}
        />
        <ProposalSelector
          label="Proposta B"
          selected={right}
          onSelect={setRight}
          onClear={() => setRight(null)}
        />
      </div>

      {/* Comparison */}
      {canCompare && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <GitCompareArrows className="size-5" />
              Comparacao
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0.5">
            <CompRow
              label="Titulo"
              left={<span className="font-medium">{left.title}</span>}
              right={<span className="font-medium">{right.title}</span>}
            />
            <CompRow
              label="Cliente"
              left={<span className="flex items-center gap-1"><Building2 className="size-3" />{left.client_name}</span>}
              right={<span className="flex items-center gap-1"><Building2 className="size-3" />{right.client_name}</span>}
              highlight
            />
            <CompRow
              label="Status"
              left={<StatusBadge status={left.status} />}
              right={<StatusBadge status={right.status} />}
            />
            <CompRow
              label="Valor"
              left={
                <span className={`font-semibold ${left.value && right.value && left.value > right.value ? "text-emerald-600" : ""}`}>
                  {formatCurrency(left.value)}
                </span>
              }
              right={
                <span className={`font-semibold ${left.value && right.value && right.value > left.value ? "text-emerald-600" : ""}`}>
                  {formatCurrency(right.value)}
                </span>
              }
              highlight
            />
            <CompRow
              label="Data"
              left={formatDate(left.proposal_date)}
              right={formatDate(right.proposal_date)}
            />
            <CompRow
              label="Numero"
              left={left.proposal_number || "-"}
              right={right.proposal_number || "-"}
              highlight
            />
            <CompRow
              label="Arquivos"
              left={`${left.files_count} arquivo(s)`}
              right={`${right.files_count} arquivo(s)`}
            />
            {(left.loss_reason || right.loss_reason) && (
              <CompRow
                label="Motivo perda"
                left={left.loss_reason ? (
                  <Badge variant="outline" className="text-[10px] text-red-500">
                    {lossReasonLabels[left.loss_reason] || left.loss_reason}
                  </Badge>
                ) : "-"}
                right={right.loss_reason ? (
                  <Badge variant="outline" className="text-[10px] text-red-500">
                    {lossReasonLabels[right.loss_reason] || right.loss_reason}
                  </Badge>
                ) : "-"}
                highlight
              />
            )}

            {/* Descriptions side by side */}
            <div className="mt-4 grid grid-cols-2 gap-4 border-t pt-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Descricao A</p>
                <p className="text-sm text-muted-foreground">
                  {left.description || "Sem descricao"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Descricao B</p>
                <p className="text-sm text-muted-foreground">
                  {right.description || "Sem descricao"}
                </p>
              </div>
            </div>

            {/* Value difference */}
            {left.value && right.value && (
              <div className="mt-4 rounded-lg bg-muted/50 p-3 text-center">
                <p className="text-xs text-muted-foreground">Diferenca de valor</p>
                <p className={`text-lg font-bold ${left.value - right.value > 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {left.value - right.value > 0 ? "+" : ""}
                  {formatCurrency(left.value - right.value)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!canCompare && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <GitCompareArrows className="size-10 opacity-30" />
            <p className="text-sm">Selecione duas propostas para comparar</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
