"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Proposal } from "@/types/database"

interface AddReminderDialogProps {
  clientId: string
  proposals?: Proposal[]
  trigger?: React.ReactElement
}

export function AddReminderDialog({
  clientId,
  proposals,
  trigger,
}: AddReminderDialogProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split("T")[0]

  const [formData, setFormData] = React.useState({
    title: "",
    description: "",
    due_date: tomorrowStr,
    proposal_id: "",
  })

  React.useEffect(() => {
    if (open) {
      const t = new Date()
      t.setDate(t.getDate() + 1)
      setFormData({
        title: "",
        description: "",
        due_date: t.toISOString().split("T")[0],
        proposal_id: "",
      })
      setError(null)
    }
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.title.trim()) {
      setError("Titulo e obrigatorio")
      return
    }
    if (!formData.due_date) {
      setError("Data e obrigatoria")
      return
    }

    setLoading(true)
    setError(null)

    const supabase = createClient()

    const { error: insertError } = await supabase.from("reminders").insert({
      client_id: clientId,
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      due_date: formData.due_date,
      proposal_id: formData.proposal_id || null,
    })

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    setLoading(false)
    setOpen(false)
    router.refresh()
  }

  function handleChange(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button variant="outline" size="sm">
              <Plus className="size-3.5" data-icon="inline-start" />
              Criar Lembrete
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Lembrete</DialogTitle>
          <DialogDescription>
            Crie um lembrete de acompanhamento para este cliente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reminder-title">Titulo *</Label>
            <Input
              id="reminder-title"
              placeholder="Titulo do lembrete"
              value={formData.title}
              onChange={(e) => handleChange("title", e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reminder-description">Descricao</Label>
            <Textarea
              id="reminder-description"
              placeholder="Detalhes do lembrete..."
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reminder-due-date">Data *</Label>
            <Input
              id="reminder-due-date"
              type="date"
              value={formData.due_date}
              onChange={(e) => handleChange("due_date", e.target.value)}
              required
            />
          </div>

          {proposals && proposals.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="reminder-proposal">Proposta (opcional)</Label>
              <Select
                value={formData.proposal_id}
                onValueChange={(val) => handleChange("proposal_id", val ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Vincular a uma proposta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma</SelectItem>
                  {proposals.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Criar Lembrete"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
