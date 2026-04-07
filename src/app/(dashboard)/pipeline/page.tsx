"use client"

import * as React from "react"
import Link from "next/link"
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core"
import { useDroppable } from "@dnd-kit/core"
import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import {
  Clock,
  Building2,
  AlertTriangle,
  GripVertical,
  ExternalLink,
  Loader2,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { ProposalStatus } from "@/types/database"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LossReasonDialog } from "@/components/loss-reason-dialog"

interface PipelineProposal {
  id: string
  title: string
  status: ProposalStatus
  value: number | null
  proposal_date: string | null
  created_at: string
  client_id: string
  client_name: string
  file_count: number
  days_in_status: number
}

const columns: { id: ProposalStatus; label: string; color: string; bgColor: string }[] = [
  { id: "draft", label: "Rascunho", color: "text-neutral-500", bgColor: "bg-neutral-500/10" },
  { id: "sent", label: "Enviada", color: "text-blue-500", bgColor: "bg-blue-500/10" },
  { id: "negotiating", label: "Negociando", color: "text-amber-500", bgColor: "bg-amber-500/10" },
  { id: "won", label: "Ganha", color: "text-emerald-500", bgColor: "bg-emerald-500/10" },
  { id: "lost", label: "Perdida", color: "text-red-500", bgColor: "bg-red-500/10" },
]

function formatCurrency(value: number | null) {
  if (value === null) return null
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value)
}

// ---- Draggable Card ----
function DraggableCard({ proposal }: { proposal: PipelineProposal }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: proposal.id,
    data: proposal,
  })

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.3 : 1,
    cursor: isDragging ? "grabbing" : "grab",
    touchAction: "none",
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ProposalKanbanCard proposal={proposal} isDragging={isDragging} />
    </div>
  )
}

// ---- Card Visual ----
function ProposalKanbanCard({
  proposal,
  isOverlay,
  isDragging,
}: {
  proposal: PipelineProposal
  isOverlay?: boolean
  isDragging?: boolean
}) {
  const isStale = proposal.days_in_status > 15 && proposal.status !== "won" && proposal.status !== "lost"

  return (
    <Card
      className={`p-3 select-none transition-shadow ${
        isOverlay ? "shadow-xl ring-2 ring-primary/30 rotate-2" : ""
      } ${isDragging ? "opacity-50" : "hover:shadow-md"} ${isStale ? "ring-1 ring-red-500/30" : ""}`}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="mt-0.5 size-4 shrink-0 text-muted-foreground/30" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{proposal.title}</p>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Building2 className="size-3" />
            <span className="truncate">{proposal.client_name}</span>
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between">
        {proposal.value ? (
          <span className="text-sm font-semibold">
            {formatCurrency(proposal.value)}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Sem valor</span>
        )}

        <div className="flex items-center gap-1.5">
          {isStale && (
            <span className="flex items-center gap-0.5 text-[10px] text-red-500" title="Parada ha muito tempo">
              <AlertTriangle className="size-3" />
              {proposal.days_in_status}d
            </span>
          )}
          {!isStale && proposal.days_in_status > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Clock className="size-3" />
              {proposal.days_in_status}d
            </span>
          )}
        </div>
      </div>
    </Card>
  )
}

// ---- Droppable Column ----
function KanbanColumn({
  column,
  proposals,
}: {
  column: (typeof columns)[number]
  proposals: PipelineProposal[]
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })

  const totalValue = proposals.reduce((sum, p) => sum + (p.value || 0), 0)

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[60vh] w-64 shrink-0 flex-col rounded-xl border transition-colors ${
        isOver ? "border-primary/50 bg-primary/5" : "border-border bg-muted/30"
      }`}
    >
      {/* Header */}
      <div className={`rounded-t-xl px-3 py-2.5 ${column.bgColor}`}>
        <div className="flex items-center justify-between">
          <span className={`text-sm font-semibold ${column.color}`}>
            {column.label}
          </span>
          <Badge variant="secondary" className="text-xs">
            {proposals.length}
          </Badge>
        </div>
        {totalValue > 0 && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatCurrency(totalValue)}
          </p>
        )}
      </div>

      {/* Cards */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
        {proposals.map((proposal) => (
          <DraggableCard key={proposal.id} proposal={proposal} />
        ))}

        {proposals.length === 0 && (
          <div className="flex flex-1 items-center justify-center p-4">
            <p className="text-xs text-muted-foreground">Nenhuma proposta</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ---- Page ----
export default function PipelinePage() {
  const [proposals, setProposals] = React.useState<PipelineProposal[]>([])
  const [loading, setLoading] = React.useState(true)
  const [activeProposal, setActiveProposal] = React.useState<PipelineProposal | null>(null)

  // Loss dialog state
  const [lossDialog, setLossDialog] = React.useState<{
    open: boolean
    proposalId: string
    proposalTitle: string
  }>({ open: false, proposalId: "", proposalTitle: "" })

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  )

  // Load proposals
  React.useEffect(() => {
    loadProposals()
  }, [])

  async function loadProposals() {
    const supabase = createClient()

    const { data } = await supabase
      .from("proposals")
      .select("id, title, status, value, proposal_date, created_at, client_id, clients!inner(name), proposal_files(id)")
      .order("created_at", { ascending: false })

    if (data) {
      const now = new Date()
      const mapped: PipelineProposal[] = data.map((p) => {
        const createdAt = new Date(p.proposal_date || p.created_at)
        const daysDiff = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))

        return {
          id: p.id,
          title: p.title,
          status: p.status as ProposalStatus,
          value: p.value,
          proposal_date: p.proposal_date,
          created_at: p.created_at,
          client_id: p.client_id,
          client_name: (p.clients as unknown as { name: string })?.name || "",
          file_count: Array.isArray(p.proposal_files) ? p.proposal_files.length : 0,
          days_in_status: daysDiff,
        }
      })

      setProposals(mapped)
    }

    setLoading(false)
  }

  function handleDragStart(event: DragStartEvent) {
    const proposal = event.active.data.current as PipelineProposal
    setActiveProposal(proposal)
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveProposal(null)
    const { active, over } = event

    if (!over) return

    const proposalId = active.id as string
    const newStatus = over.id as ProposalStatus
    const proposal = proposals.find((p) => p.id === proposalId)

    if (!proposal || proposal.status === newStatus) return

    // Se movendo para "lost", abrir dialog de motivo
    if (newStatus === "lost") {
      setLossDialog({
        open: true,
        proposalId,
        proposalTitle: proposal.title,
      })
      return
    }

    // Atualizar otimisticamente
    setProposals((prev) =>
      prev.map((p) =>
        p.id === proposalId ? { ...p, status: newStatus, days_in_status: 0 } : p
      )
    )

    // Persistir
    await fetch(`/api/proposals/${proposalId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const grouped = columns.map((col) => ({
    ...col,
    proposals: proposals.filter((p) => p.status === col.id),
  }))

  const totalPipeline = proposals
    .filter((p) => p.status === "negotiating" || p.status === "sent")
    .reduce((sum, p) => sum + (p.value || 0), 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            Arraste as propostas entre as colunas para atualizar o status
          </p>
        </div>
        {totalPipeline > 0 && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Pipeline ativo</p>
            <p className="text-lg font-bold">
              {formatCurrency(totalPipeline)}
            </p>
          </div>
        )}
      </div>

      <div className="overflow-x-auto pb-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-3">
            {grouped.map((col) => (
              <KanbanColumn
                key={col.id}
                column={col}
                proposals={col.proposals}
              />
            ))}
          </div>

          <DragOverlay>
            {activeProposal && (
              <div className="w-60">
                <ProposalKanbanCard proposal={activeProposal} isOverlay />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      <LossReasonDialog
        open={lossDialog.open}
        onOpenChange={(open) => setLossDialog((prev) => ({ ...prev, open }))}
        proposalId={lossDialog.proposalId}
        proposalTitle={lossDialog.proposalTitle}
        onConfirm={() => {
          setProposals((prev) =>
            prev.map((p) =>
              p.id === lossDialog.proposalId
                ? { ...p, status: "lost" as ProposalStatus, days_in_status: 0 }
                : p
            )
          )
        }}
      />
    </div>
  )
}
