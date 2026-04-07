"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil } from "lucide-react"
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
import type { Client } from "@/types/database"

const SECTORS = [
  "Energia",
  "Mineracao",
  "Tecnologia",
  "Saude",
  "Financeiro",
  "Agronegocio",
  "Industria",
  "Servicos",
  "Educacao",
  "Governo",
  "Outro",
]

interface ClientFormDialogProps {
  client?: Client
  trigger?: React.ReactElement
}

export function ClientFormDialog({ client, trigger }: ClientFormDialogProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const isEditing = !!client

  const [formData, setFormData] = React.useState({
    name: client?.name ?? "",
    full_name: client?.full_name ?? "",
    sector: client?.sector ?? "",
    contact_name: client?.contact_name ?? "",
    contact_email: client?.contact_email ?? "",
    contact_phone: client?.contact_phone ?? "",
    notes: client?.notes ?? "",
  })

  // Reset form when dialog opens/closes or client changes
  React.useEffect(() => {
    if (open) {
      setFormData({
        name: client?.name ?? "",
        full_name: client?.full_name ?? "",
        sector: client?.sector ?? "",
        contact_name: client?.contact_name ?? "",
        contact_email: client?.contact_email ?? "",
        contact_phone: client?.contact_phone ?? "",
        notes: client?.notes ?? "",
      })
      setError(null)
    }
  }, [open, client])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.name.trim()) {
      setError("Nome e obrigatorio")
      return
    }

    setLoading(true)
    setError(null)

    const supabase = createClient()

    const payload = {
      name: formData.name.trim(),
      full_name: formData.full_name.trim() || null,
      sector: formData.sector || null,
      contact_name: formData.contact_name.trim() || null,
      contact_email: formData.contact_email.trim() || null,
      contact_phone: formData.contact_phone.trim() || null,
      notes: formData.notes.trim() || null,
    }

    let result
    if (isEditing) {
      result = await supabase
        .from("clients")
        .update(payload)
        .eq("id", client.id)
    } else {
      result = await supabase.from("clients").insert(payload)
    }

    if (result.error) {
      setError(result.error.message)
      setLoading(false)
      return
    }

    setLoading(false)
    setOpen(false)
    router.refresh()
  }

  function handleChange(
    field: string,
    value: string
  ) {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button>
              <Plus className="size-4" data-icon="inline-start" />
              Novo Cliente
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Cliente" : "Novo Cliente"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Atualize as informacoes do cliente."
              : "Preencha os dados para cadastrar um novo cliente."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                placeholder="Nome do cliente"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="full_name">Razao Social</Label>
              <Input
                id="full_name"
                placeholder="Razao social completa"
                value={formData.full_name}
                onChange={(e) => handleChange("full_name", e.target.value)}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="sector">Setor</Label>
              <Select
                value={formData.sector}
                onValueChange={(val) => handleChange("sector", val ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o setor" />
                </SelectTrigger>
                <SelectContent>
                  {SECTORS.map((sector) => (
                    <SelectItem key={sector} value={sector}>
                      {sector}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_name">Nome do Contato</Label>
              <Input
                id="contact_name"
                placeholder="Nome do contato"
                value={formData.contact_name}
                onChange={(e) => handleChange("contact_name", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_email">Email</Label>
              <Input
                id="contact_email"
                type="email"
                placeholder="email@exemplo.com"
                value={formData.contact_email}
                onChange={(e) => handleChange("contact_email", e.target.value)}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="contact_phone">Telefone</Label>
              <Input
                id="contact_phone"
                placeholder="(00) 00000-0000"
                value={formData.contact_phone}
                onChange={(e) => handleChange("contact_phone", e.target.value)}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="notes">Observacoes</Label>
              <Textarea
                id="notes"
                placeholder="Notas sobre o cliente..."
                value={formData.notes}
                onChange={(e) => handleChange("notes", e.target.value)}
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={loading}>
              {loading
                ? "Salvando..."
                : isEditing
                  ? "Salvar"
                  : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
