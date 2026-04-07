"use client"

import * as React from "react"
import {
  History,
  Loader2,
  Building2,
  FileText,
  MessageSquare,
  Bell,
  Upload,
  ArrowUpDown,
  Copy,
  Trash2,
  Pencil,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface LogEntry {
  id: string
  entity_type: string
  entity_id: string
  action: string
  description: string
  metadata: Record<string, unknown>
  created_at: string
  profiles: { full_name: string | null } | null
}

const entityIcons: Record<string, typeof FileText> = {
  client: Building2,
  proposal: FileText,
  interaction: MessageSquare,
  reminder: Bell,
  file: Upload,
}

const actionIcons: Record<string, typeof Pencil> = {
  create: Pencil,
  update: Pencil,
  delete: Trash2,
  status_change: ArrowUpDown,
  upload: Upload,
  clone: Copy,
}

const actionColors: Record<string, string> = {
  create: "text-emerald-500 bg-emerald-500/10",
  update: "text-blue-500 bg-blue-500/10",
  delete: "text-red-500 bg-red-500/10",
  status_change: "text-amber-500 bg-amber-500/10",
  upload: "text-violet-500 bg-violet-500/10",
  clone: "text-cyan-500 bg-cyan-500/10",
}

const actionLabels: Record<string, string> = {
  create: "Criacao",
  update: "Atualizacao",
  delete: "Exclusao",
  status_change: "Mudanca de status",
  upload: "Upload",
  clone: "Clone",
}

function formatDateTime(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date))
}

export default function ActivityPage() {
  const [entries, setEntries] = React.useState<LogEntry[]>([])
  const [loading, setLoading] = React.useState(true)
  const [page, setPage] = React.useState(1)
  const [totalPages, setTotalPages] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [filter, setFilter] = React.useState<string | null>(null)

  React.useEffect(() => {
    loadEntries()
  }, [page, filter])

  async function loadEntries() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (filter) params.set("entity_type", filter)

      const res = await fetch(`/api/activity-log?${params}`)
      if (res.ok) {
        const data = await res.json()
        setEntries(data.entries || [])
        setTotalPages(data.totalPages || 1)
        setTotal(data.total || 0)
      }
    } catch {
      // silenciar
    } finally {
      setLoading(false)
    }
  }

  const filters = [
    { value: null, label: "Todos" },
    { value: "proposal", label: "Propostas" },
    { value: "client", label: "Clientes" },
    { value: "interaction", label: "Interacoes" },
    { value: "file", label: "Arquivos" },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Atividades</h1>
        <p className="text-sm text-muted-foreground">
          Log de todas as acoes realizadas no sistema
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        {filters.map((f) => (
          <Button
            key={f.value || "all"}
            variant={filter === f.value ? "default" : "outline"}
            size="sm"
            onClick={() => { setFilter(f.value); setPage(1) }}
          >
            {f.label}
          </Button>
        ))}
        {total > 0 && (
          <Badge variant="secondary" className="ml-auto">
            {total} registros
          </Badge>
        )}
      </div>

      {/* Log entries */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <History className="size-8 opacity-30" />
              <p className="text-sm">Nenhuma atividade registrada</p>
            </div>
          ) : (
            <div className="divide-y">
              {entries.map((entry) => {
                const EntityIcon = entityIcons[entry.entity_type] || FileText
                const ActionIcon = actionIcons[entry.action] || Pencil
                const color = actionColors[entry.action] || "text-neutral-500 bg-neutral-500/10"

                return (
                  <div key={entry.id} className="flex items-center gap-3 px-4 py-3">
                    <div className={`flex size-8 items-center justify-center rounded-full ${color}`}>
                      <ActionIcon className="size-3.5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        {entry.description}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <EntityIcon className="size-3" />
                          {entry.entity_type}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {actionLabels[entry.action] || entry.action}
                        </Badge>
                        {entry.profiles?.full_name && (
                          <span>{entry.profiles.full_name}</span>
                        )}
                      </div>
                    </div>

                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDateTime(entry.created_at)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Pagina {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="size-4" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Proximo
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
