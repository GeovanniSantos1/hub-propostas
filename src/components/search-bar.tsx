"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Search,
  Building2,
  FileText,
  MessageSquare,
  Loader2,
  ArrowRight,
  Kanban,
  Upload,
  Radar,
  TrendingUp,
  BarChart3,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/status-badge"
import type { ProposalStatus } from "@/types/database"

interface SearchResults {
  clients: { id: string; name: string; sector: string | null; status: string }[]
  proposals: {
    id: string
    title: string
    status: string
    value: number | null
    clientId: string
    clientName: string
    proposalNumber: string | null
  }[]
  interactions: {
    id: string
    title: string
    type: string
    clientId: string
    clientName: string
    date: string
  }[]
}

const quickActions = [
  { label: "Pipeline", href: "/pipeline", icon: Kanban },
  { label: "Upload", href: "/upload", icon: Upload },
  { label: "Oportunidades", href: "/opportunities", icon: Radar },
  { label: "Forecast", href: "/forecast", icon: TrendingUp },
  { label: "Relatorios", href: "/reports", icon: BarChart3 },
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value)
}

export function SearchBar() {
  const router = useRouter()
  const [query, setQuery] = React.useState("")
  const [open, setOpen] = React.useState(false)
  const [results, setResults] = React.useState<SearchResults | null>(null)
  const [loading, setLoading] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)

  // Ctrl+K shortcut
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
      if (e.key === "Escape") {
        setOpen(false)
        inputRef.current?.blur()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Click outside to close
  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  // Debounced search
  React.useEffect(() => {
    if (query.length < 2) {
      setResults(null)
      return
    }

    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        if (res.ok) {
          setResults(await res.json())
        }
      } catch {
        // silenciar
      } finally {
        setLoading(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [query])

  function navigate(href: string) {
    router.push(href)
    setOpen(false)
    setQuery("")
    setResults(null)
  }

  const hasResults =
    results &&
    (results.clients.length > 0 ||
      results.proposals.length > 0 ||
      results.interactions.length > 0)

  const showDropdown = open && (query.length >= 2 || query.length === 0)

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        type="search"
        placeholder="Buscar... (Ctrl+K)"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          if (!open) setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        className="pl-9 pr-16"
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
        Ctrl K
      </kbd>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-[70vh] overflow-y-auto rounded-xl border bg-popover shadow-xl">
          {/* Loading */}
          {loading && query.length >= 2 && (
            <div className="flex items-center gap-2 p-4">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Buscando...</span>
            </div>
          )}

          {/* Quick actions (when empty) */}
          {query.length < 2 && (
            <div className="p-2">
              <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Acesso rapido
              </p>
              {quickActions.map((action) => (
                <button
                  key={action.href}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-muted"
                  onClick={() => navigate(action.href)}
                >
                  <action.icon className="size-4 text-muted-foreground" />
                  {action.label}
                </button>
              ))}
            </div>
          )}

          {/* No results */}
          {!loading && query.length >= 2 && !hasResults && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Nenhum resultado para &ldquo;{query}&rdquo;
            </div>
          )}

          {/* Clients */}
          {results && results.clients.length > 0 && (
            <div className="p-2">
              <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Clientes
              </p>
              {results.clients.map((c) => (
                <button
                  key={c.id}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-muted"
                  onClick={() => navigate(`/clients/${c.id}`)}
                >
                  <Building2 className="size-4 shrink-0 text-blue-500" />
                  <span className="flex-1 truncate text-left font-medium">{c.name}</span>
                  {c.sector && (
                    <Badge variant="outline" className="text-[10px]">
                      {c.sector}
                    </Badge>
                  )}
                  <ArrowRight className="size-3 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}

          {/* Proposals */}
          {results && results.proposals.length > 0 && (
            <div className="border-t p-2">
              <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Propostas
              </p>
              {results.proposals.map((p) => (
                <button
                  key={p.id}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-muted"
                  onClick={() => navigate(`/clients/${p.clientId}`)}
                >
                  <FileText className="size-4 shrink-0 text-violet-500" />
                  <div className="flex-1 min-w-0 text-left">
                    <p className="truncate font-medium">{p.title}</p>
                    <p className="text-xs text-muted-foreground">{p.clientName}</p>
                  </div>
                  {p.value && (
                    <span className="text-xs font-medium">{formatCurrency(p.value)}</span>
                  )}
                  <StatusBadge status={p.status as ProposalStatus} />
                </button>
              ))}
            </div>
          )}

          {/* Interactions */}
          {results && results.interactions.length > 0 && (
            <div className="border-t p-2">
              <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Interacoes
              </p>
              {results.interactions.map((i) => (
                <button
                  key={i.id}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-muted"
                  onClick={() => navigate(`/clients/${i.clientId}`)}
                >
                  <MessageSquare className="size-4 shrink-0 text-amber-500" />
                  <div className="flex-1 min-w-0 text-left">
                    <p className="truncate font-medium">{i.title}</p>
                    <p className="text-xs text-muted-foreground">{i.clientName}</p>
                  </div>
                  <ArrowRight className="size-3 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
