import Link from "next/link"
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Search,
} from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { ClientFormDialog } from "@/components/client-form-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import type { Client } from "@/types/database"

const PAGE_SIZE = 10

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    sector?: string
    status?: string
    page?: string
  }>
}) {
  const { q, sector, status, page } = await searchParams
  const currentPage = Math.max(1, parseInt(page ?? "1", 10))
  const offset = (currentPage - 1) * PAGE_SIZE

  const supabase = await createClient()

  // Build query
  let query = supabase
    .from("clients")
    .select("*, proposals(id)", { count: "exact" })

  // Full-text search
  if (q && q.trim()) {
    query = query.textSearch("search_vector", q.trim(), {
      type: "websearch",
    })
  }

  // Sector filter
  if (sector) {
    query = query.eq("sector", sector)
  }

  // Status filter
  if (status) {
    query = query.eq("status", status)
  }

  // Order and paginate
  query = query
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  const { data: clients, count } = await query

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

  // Build query string helper
  function buildQueryString(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams()
    const merged = { q, sector, status, page: String(currentPage), ...overrides }
    for (const [key, value] of Object.entries(merged)) {
      if (value && value !== "undefined") {
        params.set(key, value)
      }
    }
    return params.toString()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground">
            Gerencie sua carteira de clientes
          </p>
        </div>
        <ClientFormDialog />
      </div>

      {/* Filters */}
      <Card size="sm">
        <CardContent>
          <form className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  name="q"
                  defaultValue={q ?? ""}
                  placeholder="Buscar clientes..."
                  className="h-8 w-full rounded-lg border border-input bg-transparent pl-8 pr-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                />
              </div>
            </div>
            <select
              name="sector"
              defaultValue={sector ?? ""}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            >
              <option value="">Todos os setores</option>
              {[
                "Energia",
                "Mineracao",
                "Tecnologia",
                "Saude",
                "Financeiro",
                "Agronegocio",
                "Industria",
                "Servicos",
                "Educacao",
                "Governo",
                "Outro",
              ].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              name="status"
              defaultValue={status ?? ""}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            >
              <option value="">Todos os status</option>
              <option value="active">Ativo</option>
              <option value="archived">Arquivado</option>
            </select>
            <Button type="submit" size="sm">
              Filtrar
            </Button>
            {(q || sector || status) && (
              <Button variant="ghost" size="sm" render={<Link href="/clients" />}>
                Limpar
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent>
          {clients && clients.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead className="text-center">Propostas</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => {
                    const proposalCount = Array.isArray(client.proposals)
                      ? client.proposals.length
                      : 0
                    return (
                      <TableRow key={client.id}>
                        <TableCell>
                          <Link
                            href={`/clients/${client.id}`}
                            className="font-medium hover:underline"
                          >
                            {client.name}
                          </Link>
                          {client.full_name && (
                            <p className="text-xs text-muted-foreground">
                              {client.full_name}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>{client.sector ?? "-"}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            {client.contact_name && (
                              <span className="text-sm">{client.contact_name}</span>
                            )}
                            {client.contact_email && (
                              <span className="text-xs text-muted-foreground">
                                {client.contact_email}
                              </span>
                            )}
                            {!client.contact_name && !client.contact_email && "-"}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{proposalCount}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              client.status === "active" ? "secondary" : "outline"
                            }
                          >
                            {client.status === "active" ? "Ativo" : "Arquivado"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              render={<Link href={`/clients/${client.id}`} />}
                            >
                              <Eye className="size-3.5" />
                              <span className="sr-only">Ver</span>
                            </Button>
                            <ClientFormDialog
                              client={client as Client}
                              trigger={
                                <Button variant="ghost" size="icon-xs">
                                  <Pencil className="size-3.5" />
                                  <span className="sr-only">Editar</span>
                                </Button>
                              }
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-xs text-muted-foreground">
                    Mostrando {offset + 1}-
                    {Math.min(offset + PAGE_SIZE, count ?? 0)} de {count ?? 0}{" "}
                    clientes
                  </p>
                  <div className="flex items-center gap-1">
                    {currentPage > 1 ? (
                      <Button
                        variant="outline"
                        size="icon-xs"
                        render={
                          <Link
                            href={`/clients?${buildQueryString({ page: String(currentPage - 1) })}`}
                          />
                        }
                      >
                        <ChevronLeft className="size-3.5" />
                        <span className="sr-only">Anterior</span>
                      </Button>
                    ) : (
                      <Button variant="outline" size="icon-xs" disabled>
                        <ChevronLeft className="size-3.5" />
                      </Button>
                    )}
                    <span className="px-2 text-xs text-muted-foreground">
                      {currentPage} / {totalPages}
                    </span>
                    {currentPage < totalPages ? (
                      <Button
                        variant="outline"
                        size="icon-xs"
                        render={
                          <Link
                            href={`/clients?${buildQueryString({ page: String(currentPage + 1) })}`}
                          />
                        }
                      >
                        <ChevronRight className="size-3.5" />
                        <span className="sr-only">Proximo</span>
                      </Button>
                    ) : (
                      <Button variant="outline" size="icon-xs" disabled>
                        <ChevronRight className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Building2 className="mb-3 size-10 opacity-50" />
              <p className="font-medium">Nenhum registro</p>
              <p className="text-xs">
                {q || sector || status
                  ? "Nenhum cliente encontrado com os filtros aplicados"
                  : "Comece cadastrando seu primeiro cliente"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
