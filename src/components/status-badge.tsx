import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type ProposalStatus = "draft" | "sent" | "negotiating" | "won" | "lost"

const statusConfig: Record<
  ProposalStatus,
  { label: string; className: string }
> = {
  draft: {
    label: "Rascunho",
    className:
      "bg-neutral-500/10 text-neutral-400 dark:bg-neutral-400/10 dark:text-neutral-400",
  },
  sent: {
    label: "Enviada",
    className:
      "bg-blue-500/10 text-blue-500 dark:bg-blue-400/10 dark:text-blue-400",
  },
  negotiating: {
    label: "Negociando",
    className:
      "bg-amber-500/10 text-amber-500 dark:bg-amber-400/10 dark:text-amber-400",
  },
  won: {
    label: "Ganha",
    className:
      "bg-emerald-500/10 text-emerald-500 dark:bg-emerald-400/10 dark:text-emerald-400",
  },
  lost: {
    label: "Perdida",
    className:
      "bg-red-500/10 text-red-500 dark:bg-red-400/10 dark:text-red-400",
  },
}

interface StatusBadgeProps {
  status: ProposalStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <Badge
      variant="secondary"
      className={cn(
        "border-transparent font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </Badge>
  )
}
