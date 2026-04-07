import { FileText, Paperclip, ExternalLink, Copy } from "lucide-react"
import { StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Proposal, ProposalFile, ProposalStatus, Tag } from "@/types/database"
import { ProposalTags } from "@/components/proposal-tags"
import { CloneProposalButton } from "@/components/clone-proposal-button"

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

const fileExtColors: Record<string, string> = {
  PDF: "border-red-300 text-red-700 hover:bg-red-50",
  DOCX: "border-blue-300 text-blue-700 hover:bg-blue-50",
  PPTX: "border-orange-300 text-orange-700 hover:bg-orange-50",
  XLSX: "border-green-300 text-green-700 hover:bg-green-50",
}

interface ProposalCardProps {
  proposal: Proposal & { files: ProposalFile[]; tags?: Tag[] }
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

      {/* Tags + Clone */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <ProposalTags
          proposalId={proposal.id}
          initialTags={proposal.tags || []}
        />
        <CloneProposalButton proposalId={proposal.id} proposalTitle={proposal.title} />
      </div>

      {proposal.files && proposal.files.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Paperclip className="size-3 text-muted-foreground" />
          {proposal.files.map((file) => {
            const ext = getFileExtension(file.file_name)
            const colorClass = fileExtColors[ext] || ""

            return (
              <a
                key={file.id}
                href={`/api/files/${file.id}`}
                target="_blank"
                rel="noopener noreferrer"
                title={file.file_name}
              >
                <Badge
                  variant="outline"
                  className={cn(
                    "cursor-pointer gap-1 text-[10px] transition-colors",
                    colorClass
                  )}
                >
                  {ext}
                  <ExternalLink className="size-2.5" />
                </Badge>
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}
