import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { StatusBadge } from "@/components/status-badge"
import type { ProposalStatus } from "@/types/database"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, ChevronLeft, ChevronRight, Paperclip, Eye } from "lucide-react"
import { ProposalFilters } from "@/components/proposal-filters"

const PAGE_SIZE = 10

const statusLabels: Record<string, string> = {
  all: "Todos",
  draft: "Rascunho",
  sent: "Enviada",
  negotiating: "Negociando",
  won: "Ganha",
  lost: "Perdida",
}

function formatCurrency(value: number | null) {
  if (value === null || value === undefined) return "-"
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
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

export default async function ProposalsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    status?: string
    client_id?: string
    page?: string
  }>
}) {
  const params = await searchParams
  const currentPage = Math.max(1, parseInt(params.page || "1", 10))
  const statusFilter = params.status || "all"
  const searchQuery = params.q || ""
  const clientIdFilter = params.client_id || ""

  const supabase = await createClient()

  let query = supabase
    .from("proposals")
    .select(
      `
      *,
      clients!inner(name),
      proposal_files(id)
    `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE - 1)

  if (statusFilter && statusFilter !== "all") {
    query = query.eq("status", statusFilter)
  }

  if (searchQuery) {
    query = query.or(
      `title.ilike.%${searchQuery}%,proposal_number.ilike.%${searchQuery}%,clients.name.ilike.%${searchQuery}%`
    )
  }

  if (clientIdFilter) {
    query = query.eq("client_id", clientIdFilter)
  }

  const { data: proposals, count } = await query

  const totalPages = Math.ceil((count || 0) / PAGE_SIZE)

  function buildPageUrl(page: number) {
    const sp = new URLSearchParams()
    if (searchQuery) sp.set("q", searchQuery)
    if (statusFilter !== "all") sp.set("status", statusFilter)
    if (clientIdFilter) sp.set("client_id", clientIdFilter)
    sp.set("page", String(page))
    return `/proposals?${sp.toString()}`
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Propostas</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie todas as propostas comerciais
          </p>
        </div>
      </div>

      <ProposalFilters currentStatus={statusFilter} currentQuery={searchQuery} />

      <Card className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Proposta</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-center">Arquivos</TableHead>
              <TableHead className="text-right">Acoes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {proposals && proposals.length > 0 ? (
              proposals.map((proposal) => {
                const client = proposal.clients as unknown as { name: string }
                const fileCount = Array.isArray(proposal.proposal_files)
                  ? proposal.proposal_files.length
                  : 0

                return (
                  <TableRow key={proposal.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{proposal.title}</span>
                        {proposal.proposal_number && (
                          <span className="text-xs text-muted-foreground">
                            #{proposal.proposal_number}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">
                        {client?.name || "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">
                        {formatDate(proposal.proposal_date || proposal.created_at)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={proposal.status as ProposalStatus} />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(proposal.value)}
                    </TableCell>
                    <TableCell className="text-center">
                      {fileCount > 0 ? (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Paperclip className="size-3.5" />
                          {fileCount}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/clients/${proposal.client_id}`}>
                        <Button variant="ghost" size="icon-sm">
                          <Eye className="size-4" />
                          <span className="sr-only">Ver proposta</span>
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <FileText className="size-8 opacity-40" />
                    <span>Nenhuma proposta encontrada</span>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {(currentPage - 1) * PAGE_SIZE + 1} a{" "}
            {Math.min(currentPage * PAGE_SIZE, count || 0)} de {count || 0}{" "}
            propostas
          </p>
          <div className="flex items-center gap-2">
            {currentPage > 1 ? (
              <Link href={buildPageUrl(currentPage - 1)}>
                <Button variant="outline" size="sm">
                  <ChevronLeft className="size-4" />
                  Anterior
                </Button>
              </Link>
            ) : (
              <Button variant="outline" size="sm" disabled>
                <ChevronLeft className="size-4" />
                Anterior
              </Button>
            )}
            <span className="text-sm text-muted-foreground">
              Pagina {currentPage} de {totalPages}
            </span>
            {currentPage < totalPages ? (
              <Link href={buildPageUrl(currentPage + 1)}>
                <Button variant="outline" size="sm">
                  Proximo
                  <ChevronRight className="size-4" />
                </Button>
              </Link>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Proximo
                <ChevronRight className="size-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
