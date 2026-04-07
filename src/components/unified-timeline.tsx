import {
  FileText,
  Phone,
  Mail,
  Calendar,
  MapPin,
  StickyNote,
  CheckCircle2,
  XCircle,
  Send,
  Clock,
  Trophy,
  Pencil,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { Proposal, Interaction, Reminder, ProposalStatus } from "@/types/database"

// ---- Types ----
type TimelineEventType =
  | "proposal_created"
  | "proposal_won"
  | "proposal_lost"
  | "proposal_sent"
  | "interaction"
  | "reminder_completed"
  | "reminder_due"

interface TimelineEvent {
  id: string
  type: TimelineEventType
  date: Date
  title: string
  subtitle?: string
  value?: number | null
  metadata?: Record<string, unknown>
}

// ---- Config ----
const eventConfig: Record<
  TimelineEventType,
  { icon: typeof FileText; color: string; bgColor: string; label: string }
> = {
  proposal_created: {
    icon: FileText,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    label: "Proposta criada",
  },
  proposal_sent: {
    icon: Send,
    color: "text-blue-600",
    bgColor: "bg-blue-600/10",
    label: "Proposta enviada",
  },
  proposal_won: {
    icon: Trophy,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    label: "Proposta ganha",
  },
  proposal_lost: {
    icon: XCircle,
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    label: "Proposta perdida",
  },
  interaction: {
    icon: Phone,
    color: "text-violet-500",
    bgColor: "bg-violet-500/10",
    label: "Interacao",
  },
  reminder_completed: {
    icon: CheckCircle2,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    label: "Lembrete concluido",
  },
  reminder_due: {
    icon: Clock,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    label: "Lembrete pendente",
  },
}

const interactionIcons: Record<string, typeof Phone> = {
  meeting: Calendar,
  call: Phone,
  email: Mail,
  visit: MapPin,
  note: StickyNote,
}

// ---- Build events ----
function buildTimeline(
  proposals: Proposal[],
  interactions: Interaction[],
  reminders: Reminder[]
): TimelineEvent[] {
  const events: TimelineEvent[] = []

  // Propostas
  for (const p of proposals) {
    // Evento de criacao
    events.push({
      id: `prop-created-${p.id}`,
      type: "proposal_created",
      date: new Date(p.proposal_date || p.created_at),
      title: p.title,
      value: p.value,
      subtitle: p.proposal_number || undefined,
    })

    // Evento de status final (se nao draft)
    if (p.status === "won") {
      events.push({
        id: `prop-won-${p.id}`,
        type: "proposal_won",
        date: new Date(p.updated_at),
        title: p.title,
        value: p.value,
      })
    } else if (p.status === "lost") {
      events.push({
        id: `prop-lost-${p.id}`,
        type: "proposal_lost",
        date: new Date(p.updated_at),
        title: p.title,
        value: p.value,
        metadata: { loss_reason: p.loss_reason },
      })
    } else if (p.status === "sent") {
      events.push({
        id: `prop-sent-${p.id}`,
        type: "proposal_sent",
        date: new Date(p.updated_at),
        title: p.title,
        value: p.value,
      })
    }
  }

  // Interacoes
  for (const i of interactions) {
    events.push({
      id: `int-${i.id}`,
      type: "interaction",
      date: new Date(i.interaction_date),
      title: i.title,
      subtitle: i.description || undefined,
      metadata: { interactionType: i.type },
    })
  }

  // Lembretes
  for (const r of reminders) {
    if (r.completed) {
      events.push({
        id: `rem-${r.id}`,
        type: "reminder_completed",
        date: new Date(r.completed_at || r.due_date),
        title: r.title,
        subtitle: r.description || undefined,
      })
    } else {
      events.push({
        id: `rem-${r.id}`,
        type: "reminder_due",
        date: new Date(r.due_date),
        title: r.title,
        subtitle: r.description || undefined,
      })
    }
  }

  // Ordenar por data decrescente
  events.sort((a, b) => b.date.getTime() - a.date.getTime())

  return events
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date)
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value)
}

const lossReasonLabels: Record<string, string> = {
  price: "Preco",
  deadline: "Prazo",
  competitor: "Concorrente",
  cancelled: "Cancelado",
  budget: "Budget",
  scope: "Escopo",
  other: "Outro",
}

// ---- Component ----
interface UnifiedTimelineProps {
  proposals: Proposal[]
  interactions: Interaction[]
  reminders: Reminder[]
  maxItems?: number
}

export function UnifiedTimeline({
  proposals,
  interactions,
  reminders,
  maxItems = 50,
}: UnifiedTimelineProps) {
  const events = buildTimeline(proposals, interactions, reminders).slice(0, maxItems)

  if (events.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Nenhuma atividade registrada
      </div>
    )
  }

  return (
    <div className="relative space-y-0">
      {/* Linha vertical */}
      <div className="absolute left-4 top-0 h-full w-px bg-border" />

      {events.map((event, idx) => {
        const config = eventConfig[event.type]
        const Icon =
          event.type === "interaction" && event.metadata?.interactionType
            ? interactionIcons[event.metadata.interactionType as string] || config.icon
            : config.icon

        return (
          <div key={event.id} className="relative flex gap-3 pb-4">
            {/* Icone */}
            <div
              className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full ${config.bgColor}`}
            >
              <Icon className={`size-3.5 ${config.color}`} />
            </div>

            {/* Conteudo */}
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{event.title}</p>
                  {event.subtitle && (
                    <p className="truncate text-xs text-muted-foreground">
                      {event.subtitle}
                    </p>
                  )}
                  {event.type === "proposal_lost" && event.metadata?.loss_reason ? (
                    <Badge variant="outline" className="mt-1 text-[10px] text-red-500">
                      {lossReasonLabels[String(event.metadata.loss_reason)] || String(event.metadata.loss_reason)}
                    </Badge>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] text-muted-foreground">
                    {formatDate(event.date)}
                  </p>
                  {event.value != null && event.value > 0 && (
                    <p className="text-xs font-medium">
                      {formatCurrency(event.value)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
