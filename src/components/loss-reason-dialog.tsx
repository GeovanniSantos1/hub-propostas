"use client"

import * as React from "react"
import { AlertTriangle, Loader2, CalendarClock } from "lucide-react"
import type { LossReason } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const lossReasons: { value: LossReason; label: string }[] = [
  { value: "price", label: "Preco acima do orcamento" },
  { value: "deadline", label: "Prazo nao atendido" },
  { value: "competitor", label: "Perdeu para concorrente" },
  { value: "cancelled", label: "Projeto cancelado pelo cliente" },
  { value: "budget", label: "Cliente sem budget" },
  { value: "scope", label: "Escopo nao atendia" },
  { value: "other", label: "Outro motivo" },
]

interface LossReasonDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  proposalId: string
  proposalTitle: string
  onConfirm: () => void
}

export function LossReasonDialog({
  open,
  onOpenChange,
  proposalId,
  proposalTitle,
  onConfirm,
}: LossReasonDialogProps) {
  const [reason, setReason] = React.useState<LossReason | "">("")
  const [notes, setNotes] = React.useState("")
  const [retryDate, setRetryDate] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  async function handleSubmit() {
    if (!reason) return

    setLoading(true)
    try {
      await fetch(`/api/proposals/${proposalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "lost",
          loss_reason: reason,
          loss_notes: notes || null,
          retry_date: retryDate || null,
        }),
      })

      onConfirm()
      onOpenChange(false)
      setReason("")
      setNotes("")
      setRetryDate("")
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-red-500" />
            Marcar como perdida
          </DialogTitle>
          <DialogDescription>
            {proposalTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Motivo da perda *</Label>
            <Select
              value={reason}
              onValueChange={(val) => setReason(val as LossReason)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o motivo..." />
              </SelectTrigger>
              <SelectContent>
                {lossReasons.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="loss-notes">Observacoes</Label>
            <Textarea
              id="loss-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalhes sobre a perda..."
              rows={3}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="retry-date" className="flex items-center gap-1.5">
              <CalendarClock className="size-3.5" />
              Tentar novamente em
            </Label>
            <Input
              id="retry-date"
              type="date"
              value={retryDate}
              onChange={(e) => setRetryDate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              O sistema vai te lembrar de retomar essa proposta nessa data
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={loading || !reason}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Confirmar perda"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
