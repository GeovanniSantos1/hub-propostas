import Link from "next/link"
import { notFound } from "next/navigation"
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  User,
  Bell,
  Clock,
  FileText,
} from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { ClientFormDialog } from "@/components/client-form-dialog"
import { ProposalCard } from "@/components/proposal-card"
import { UnifiedTimeline } from "@/components/unified-timeline"
import { HealthScoreCard } from "@/components/health-score-card"
import { CrossSellCard } from "@/components/cross-sell-card"
import { AddInteractionDialog } from "@/components/add-interaction-dialog"
import { AddReminderDialog } from "@/components/add-reminder-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { Client, Proposal, ProposalFile, Interaction, Reminder, Tag } from "@/types/database"

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()

  // Fetch client
  const { data: client, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .single()

  if (error || !client) {
    notFound()
  }

  // Fetch proposals with files and tags
  const { data: proposals } = await supabase
    .from("proposals")
    .select("*, files:proposal_files(*), proposal_tags(tag_id, tags(*))")
    .eq("client_id", id)
    .order("created_at", { ascending: false })

  // Fetch interactions
  const { data: interactions } = await supabase
    .from("interactions")
    .select("*")
    .eq("client_id", id)
    .order("interaction_date", { ascending: false })

  // Fetch reminders
  const { data: reminders } = await supabase
    .from("reminders")
    .select("*")
    .eq("client_id", id)
    .order("due_date", { ascending: true })

  const typedProposals = (proposals ?? []).map((p) => {
    const rawTags = (p as unknown as { proposal_tags?: { tags: Tag }[] }).proposal_tags || []
    const tags = rawTags.map((pt) => pt.tags).filter(Boolean)
    return { ...p, tags } as Proposal & { files: ProposalFile[]; tags: Tag[] }
  })
  const typedInteractions = (interactions ?? []) as Interaction[]
  const typedReminders = (reminders ?? []) as Reminder[]
  const typedClient = client as Client

  // Find next upcoming reminder
  const nextReminder = typedReminders.find(
    (r) => !r.completed && new Date(r.due_date) >= new Date()
  )

  // Plain proposals (without files) for the reminder dialog
  const plainProposals = typedProposals.map(({ files, ...rest }) => rest) as Proposal[]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            render={<Link href="/clients" />}
          >
            <ArrowLeft className="size-4" />
            <span className="sr-only">Voltar</span>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                {typedClient.name}
              </h1>
              <Badge
                variant={
                  typedClient.status === "active" ? "secondary" : "outline"
                }
              >
                {typedClient.status === "active" ? "Ativo" : "Arquivado"}
              </Badge>
            </div>
            {typedClient.full_name && (
              <p className="text-sm text-muted-foreground">
                {typedClient.full_name}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <AddInteractionDialog clientId={id} />
          <AddReminderDialog clientId={id} proposals={plainProposals} />
          <ClientFormDialog
            client={typedClient}
            trigger={
              <Button variant="outline" size="sm">
                Editar Cliente
              </Button>
            }
          />
        </div>
      </div>

      {/* 2-Column Layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* LEFT: Proposals */}
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Propostas</h2>
            <Badge variant="secondary">
              {typedProposals.length}
            </Badge>
          </div>

          {typedProposals.length > 0 ? (
            <div className="space-y-3">
              {typedProposals.map((proposal) => (
                <ProposalCard key={proposal.id} proposal={proposal} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                  <FileText className="mb-2 size-8 opacity-50" />
                  <p className="text-sm">Nenhuma proposta</p>
                  <p className="text-xs">
                    As propostas deste cliente aparecerao aqui
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* RIGHT: Contact, Reminder, Interactions */}
        <div className="space-y-4">
          {/* Contact Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Building2 className="size-4" />
                Informacoes de Contato
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {typedClient.sector && (
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="outline">{typedClient.sector}</Badge>
                </div>
              )}
              {typedClient.contact_name && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="size-3.5 text-muted-foreground" />
                  <span>{typedClient.contact_name}</span>
                </div>
              )}
              {typedClient.contact_email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="size-3.5 text-muted-foreground" />
                  <a
                    href={`mailto:${typedClient.contact_email}`}
                    className="text-primary hover:underline"
                  >
                    {typedClient.contact_email}
                  </a>
                </div>
              )}
              {typedClient.contact_phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="size-3.5 text-muted-foreground" />
                  <span>{typedClient.contact_phone}</span>
                </div>
              )}
              {typedClient.notes && (
                <div className="border-t pt-3">
                  <p className="text-xs text-muted-foreground">
                    {typedClient.notes}
                  </p>
                </div>
              )}
              {!typedClient.contact_name &&
                !typedClient.contact_email &&
                !typedClient.contact_phone &&
                !typedClient.sector && (
                  <p className="text-xs text-muted-foreground">
                    Nenhuma informacao de contato cadastrada
                  </p>
                )}
            </CardContent>
          </Card>

          {/* Health Score */}
          <HealthScoreCard clientId={id} />

          {/* Next Follow-up Reminder */}
          <Card
            className={
              nextReminder
                ? "border-amber-500/30 ring-amber-500/20"
                : undefined
            }
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Bell className="size-4" />
                Proximo Follow-up
              </CardTitle>
            </CardHeader>
            <CardContent>
              {nextReminder ? (
                <div className="space-y-1">
                  <p className="text-sm font-medium">{nextReminder.title}</p>
                  {nextReminder.description && (
                    <p className="text-xs text-muted-foreground">
                      {nextReminder.description}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 pt-1">
                    <Clock className="size-3 text-amber-500" />
                    <span className="text-xs font-medium text-amber-500">
                      {new Date(nextReminder.due_date).toLocaleDateString(
                        "pt-BR",
                        { weekday: "long", day: "numeric", month: "long" }
                      )}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground">
                  <p className="text-xs">Nenhum lembrete pendente</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cross-sell IA */}
          <CrossSellCard clientId={id} />

          {/* Timeline Unificada */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Clock className="size-4" />
                  Timeline
                </span>
                <Badge variant="secondary">
                  {typedInteractions.length + typedProposals.length + typedReminders.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <UnifiedTimeline
                proposals={typedProposals}
                interactions={typedInteractions}
                reminders={typedReminders}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
