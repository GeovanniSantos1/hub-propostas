import { FileText, Paperclip } from "lucide-react"
import { StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Proposal, ProposalFile, ProposalStatus } from "@/types/database"

const statusBorderColors: Record<ProposalStatus, string> = {
  won: "border-l-emerald-500",
  negotiating: "border-l-amber-500",
  lost: "border-l-red-500",
  draft: "border-l-neutral-400",
  sent: "border-l-blue-500",
}

function getFileExtension(fileName: string): string {
  const ext = fileName.split(".").pop()?.toUpperCase()
  return ext ?? "FILE"
}

interface ProposalCardProps {
  proposal: Proposal & { files: ProposalFile[] }
  className?: string
}

export function ProposalCard({ proposal, className }: ProposalCardProps) {
  const borderColor = statusBorderColors[proposal.status] ?? "border-l-neutral-400"

  return (
    <div
      className={cn(
        "rounded-lg border border-l-4 bg-card p-4 ring-1 ring-foreground/5",
        borderColor,
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-sm font-medium">{proposal.title}</h4>
          {proposal.proposal_date && (
            <p className="text-xs text-muted-foreground">
              {new Date(proposal.proposal_date).toLocaleDateString("pt-BR")}
            </p>
          )}
        </div>
        <StatusBadge status={proposal.status} />
      </div>

      {proposal.description && (
        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
          {proposal.description}
        </p>
      )}

      {proposal.value != null && (
        <p className="mt-2 text-sm font-semibold">
          {new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
          }).format(proposal.value)}
        </p>
      )}

      {proposal.files && proposal.files.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Paperclip className="size-3 text-muted-foreground" />
          {proposal.files.map((file) => (
            <Badge key={file.id} variant="outline" className="text-[10px]">
              {getFileExtension(file.file_name)}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
