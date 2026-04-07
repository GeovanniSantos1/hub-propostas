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
import type { InteractionType } from "@/types/database"

const INTERACTION_TYPES: { value: InteractionType; label: string }[] = [
  { value: "meeting", label: "Reuniao" },
  { value: "call", label: "Ligacao" },
  { value: "email", label: "Email" },
  { value: "visit", label: "Visita" },
  { value: "note", label: "Nota" },
]

interface AddInteractionDialogProps {
  clientId: string
  trigger?: React.ReactElement
}

export function AddInteractionDialog({
  clientId,
  trigger,
}: AddInteractionDialogProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [formData, setFormData] = React.useState({
    type: "meeting" as InteractionType,
    title: "",
    description: "",
    interaction_date: new Date().toISOString().split("T")[0],
  })

  React.useEffect(() => {
    if (open) {
      setFormData({
        type: "meeting",
        title: "",
        description: "",
        interaction_date: new Date().toISOString().split("T")[0],
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

    setLoading(true)
    setError(null)

    const supabase = createClient()

    const { error: insertError } = await supabase.from("interactions").insert({
      client_id: clientId,
      type: formData.type,
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      interaction_date: formData.interaction_date,
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
              Registrar Interacao
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Interacao</DialogTitle>
          <DialogDescription>
            Registre uma nova interacao com o cliente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="interaction-type">Tipo</Label>
            <Select
              value={formData.type}
              onValueChange={(val) => handleChange("type", val ?? "meeting")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Tipo de interacao" />
              </SelectTrigger>
              <SelectContent>
                {INTERACTION_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="interaction-title">Titulo *</Label>
            <Input
              id="interaction-title"
              placeholder="Titulo da interacao"
              value={formData.title}
              onChange={(e) => handleChange("title", e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="interaction-description">Descricao</Label>
            <Textarea
              id="interaction-description"
              placeholder="Detalhes da interacao..."
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="interaction-date">Data</Label>
            <Input
              id="interaction-date"
              type="date"
              value={formData.interaction_date}
              onChange={(e) => handleChange("interaction_date", e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
