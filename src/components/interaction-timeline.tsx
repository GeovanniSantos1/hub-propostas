import {
  Users,
  Phone,
  Mail,
  MapPin,
  StickyNote,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { Interaction, InteractionType } from "@/types/database"

const typeConfig: Record<InteractionType, { icon: LucideIcon; label: string; color: string }> = {
  meeting: {
    icon: Users,
    label: "Reuniao",
    color: "bg-blue-500/10 text-blue-500",
  },
  call: {
    icon: Phone,
    label: "Ligacao",
    color: "bg-emerald-500/10 text-emerald-500",
  },
  email: {
    icon: Mail,
    label: "Email",
    color: "bg-amber-500/10 text-amber-500",
  },
  visit: {
    icon: MapPin,
    label: "Visita",
    color: "bg-purple-500/10 text-purple-500",
  },
  note: {
    icon: StickyNote,
    label: "Nota",
    color: "bg-neutral-500/10 text-neutral-500",
  },
}

interface InteractionTimelineProps {
  interactions: Interaction[]
  className?: string
}

export function InteractionTimeline({
  interactions,
  className,
}: InteractionTimelineProps) {
  if (interactions.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-6 text-center text-muted-foreground", className)}>
        <StickyNote className="mb-2 size-6 opacity-50" />
        <p className="text-sm">Nenhuma interacao registrada</p>
      </div>
    )
  }

  return (
    <div className={cn("relative space-y-0", className)}>
      {/* Timeline vertical line */}
      <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

      {interactions.map((interaction, index) => {
        const config = typeConfig[interaction.type] ?? typeConfig.note
        const Icon = config.icon

        return (
          <div key={interaction.id} className="relative flex gap-3 pb-4 last:pb-0">
            {/* Dot indicator */}
            <div
              className={cn(
                "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full",
                config.color
              )}
            >
              <Icon className="size-3.5" />
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium">{interaction.title}</p>
                <time className="shrink-0 text-xs text-muted-foreground">
                  {new Date(interaction.interaction_date).toLocaleDateString(
                    "pt-BR"
                  )}
                </time>
              </div>
              {interaction.description && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {interaction.description}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
