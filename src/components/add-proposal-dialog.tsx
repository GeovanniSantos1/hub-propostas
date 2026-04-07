"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Plus, Upload, X, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { ProposalStatus } from "@/types/database"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface AddProposalDialogProps {
  clientId: string
  clientName: string
}

const statusOptions: { value: ProposalStatus; label: string }[] = [
  { value: "draft", label: "Rascunho" },
  { value: "sent", label: "Enviada" },
  { value: "negotiating", label: "Negociando" },
  { value: "won", label: "Ganha" },
  { value: "lost", label: "Perdida" },
]

export function AddProposalDialog({
  clientId,
  clientName,
}: AddProposalDialogProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [title, setTitle] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [proposalNumber, setProposalNumber] = React.useState("")
  const [status, setStatus] = React.useState<ProposalStatus>("draft")
  const [value, setValue] = React.useState("")
  const [proposalDate, setProposalDate] = React.useState("")
  const [files, setFiles] = React.useState<File[]>([])

  const fileInputRef = React.useRef<HTMLInputElement>(null)

  function resetForm() {
    setTitle("")
    setDescription("")
    setProposalNumber("")
    setStatus("draft")
    setValue("")
    setProposalDate("")
    setFiles([])
    setError(null)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)])
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!title.trim()) {
      setError("O titulo da proposta e obrigatorio.")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      const { data: userData } = await supabase.auth.getUser()
      const userId = userData?.user?.id || null

      const { data: proposal, error: insertError } = await supabase
        .from("proposals")
        .insert({
          client_id: clientId,
          title: title.trim(),
          description: description.trim() || null,
          proposal_number: proposalNumber.trim() || null,
          status,
          value: value ? parseFloat(value) : null,
          proposal_date: proposalDate || null,
          created_by: userId,
        })
        .select()
        .single()

      if (insertError) throw insertError
      if (!proposal) throw new Error("Falha ao criar proposta")

      if (files.length > 0) {
        for (const file of files) {
          const filePath = `${clientId}/${proposal.id}/${file.name}`

          const { error: uploadError } = await supabase.storage
            .from("proposals")
            .upload(filePath, file)

          if (uploadError) {
            console.error("Erro ao fazer upload:", uploadError)
            continue
          }

          await supabase.from("proposal_files").insert({
            proposal_id: proposal.id,
            file_name: file.name,
            file_type: file.type || null,
            file_size: file.size || null,
            storage_path: filePath,
          })
        }
      }

      setOpen(false)
      resetForm()
      router.refresh()
    } catch (err) {
      console.error(err)
      setError(
        err instanceof Error ? err.message : "Erro ao criar proposta. Tente novamente."
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) resetForm()
      }}
    >
      <DialogTrigger
        render={
          <Button size="sm">
            <Plus className="size-4" />
            Nova Proposta
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova Proposta</DialogTitle>
          <DialogDescription>
            Criar proposta para {clientName}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="proposal-title">Titulo *</Label>
            <Input
              id="proposal-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Proposta comercial - Servico X"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="proposal-description">Descricao</Label>
            <Textarea
              id="proposal-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes sobre a proposta..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="proposal-number">Numero</Label>
              <Input
                id="proposal-number"
                value={proposalNumber}
                onChange={(e) => setProposalNumber(e.target.value)}
                placeholder="Ex: PROP-001"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(val) => setStatus(val as ProposalStatus)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="proposal-value">Valor (R$)</Label>
              <Input
                id="proposal-value"
                type="number"
                step="0.01"
                min="0"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="0,00"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="proposal-date">Data</Label>
              <Input
                id="proposal-date"
                type="date"
                value={proposalDate}
                onChange={(e) => setProposalDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Arquivos</Label>
            <div className="flex flex-col gap-2">
              <div
                className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-input px-4 py-6 text-sm text-muted-foreground transition-colors hover:border-ring hover:bg-muted/30"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="size-4" />
                <span>Clique para selecionar arquivos</span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />

              {files.length > 0 && (
                <div className="flex flex-col gap-1">
                  {files.map((file, idx) => (
                    <div
                      key={`${file.name}-${idx}`}
                      className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-1.5 text-sm"
                    >
                      <span className="truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="ml-2 shrink-0 text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <DialogTrigger render={<Button variant="outline" type="button" />}>
              Cancelar
            </DialogTrigger>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? "Criando..." : "Criar Proposta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
