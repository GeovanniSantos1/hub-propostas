"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Upload,
  FileUp,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Presentation,
  Sheet,
  File,
  Sparkles,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { parseProposalFilename, buildProposalTitle, guessClientFromFilename } from "@/lib/parse-filename"
import type { ProposalStatus } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const statusOptions: { value: ProposalStatus; label: string }[] = [
  { value: "draft", label: "Rascunho" },
  { value: "sent", label: "Enviada" },
  { value: "negotiating", label: "Negociando" },
  { value: "won", label: "Ganha" },
  { value: "lost", label: "Perdida" },
]

const fileIcons: Record<string, typeof FileText> = {
  pdf: FileText,
  pptx: Presentation,
  xlsx: Sheet,
  docx: File,
}

interface DetectedInfo {
  clientName: string | null
  proposalNumber: string | null
  proposalTitle: string | null
  proposalDate: string | null
  autoDetected: boolean
}

interface ProposalAnalysis {
  summary: string
  value: number | null
  deadline: string | null
  services: string[]
  highlights: string[]
  clientName: string | null
}

interface UploadResult {
  success: boolean
  proposal?: { id: string; title: string }
  clientId?: string
  clientName?: string
  files?: { id: string; fileName: string }[]
  analysis?: ProposalAnalysis
  errors?: string[]
  error?: string
}

function detectInfoFromFiles(files: File[]): DetectedInfo {
  if (files.length === 0) {
    return { clientName: null, proposalNumber: null, proposalTitle: null, proposalDate: null, autoDetected: false }
  }

  const firstFile = files[0]
  const parsed = parseProposalFilename(firstFile.name)

  if (parsed) {
    return {
      clientName: parsed.clientName,
      proposalNumber: parsed.proposalNumber,
      proposalTitle: buildProposalTitle(parsed),
      proposalDate: parsed.date,
      autoDetected: true,
    }
  }

  const guessedClient = guessClientFromFilename(firstFile.name)

  return {
    clientName: guessedClient,
    proposalNumber: null,
    proposalTitle: firstFile.name.replace(/\.\w+$/, '').replace(/_/g, ' '),
    proposalDate: null,
    autoDetected: false,
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function UploadPage() {
  const router = useRouter()
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = React.useState(false)

  // Files state
  const [files, setFiles] = React.useState<File[]>([])

  // Detected / editable fields
  const [clientName, setClientName] = React.useState("")
  const [clientSuggestions, setClientSuggestions] = React.useState<{ id: string; name: string }[]>([])
  const [selectedClientId, setSelectedClientId] = React.useState<string | null>(null)
  const [proposalTitle, setProposalTitle] = React.useState("")
  const [proposalNumber, setProposalNumber] = React.useState("")
  const [proposalDate, setProposalDate] = React.useState("")
  const [status, setStatus] = React.useState<ProposalStatus>("draft")
  const [value, setValue] = React.useState("")

  // UI state
  const [loading, setLoading] = React.useState(false)
  const [result, setResult] = React.useState<UploadResult | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [autoDetected, setAutoDetected] = React.useState(false)

  // Search clients as user types
  React.useEffect(() => {
    if (clientName.length < 2) {
      setClientSuggestions([])
      setSelectedClientId(null)
      return
    }

    const timer = setTimeout(async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from("clients")
        .select("id, name")
        .ilike("name", `%${clientName}%`)
        .limit(5)

      setClientSuggestions(data || [])

      // Auto-select if exact match
      const exact = data?.find(
        (c) => c.name.toLowerCase() === clientName.toLowerCase()
      )
      if (exact) {
        setSelectedClientId(exact.id)
      } else {
        setSelectedClientId(null)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [clientName])

  // When files change, auto-detect info
  function handleFilesAdded(newFiles: File[]) {
    const accepted = newFiles.filter((f) => {
      const ext = f.name.split(".").pop()?.toLowerCase()
      return ext && ["pdf", "docx", "pptx", "xlsx"].includes(ext)
    })

    if (accepted.length === 0) return

    const allFiles = [...files, ...accepted]
    setFiles(allFiles)
    setError(null)
    setResult(null)

    // Only auto-detect if fields are empty (first upload)
    if (!clientName && !proposalTitle) {
      const detected = detectInfoFromFiles(allFiles)
      if (detected.clientName) setClientName(detected.clientName)
      if (detected.proposalTitle) setProposalTitle(detected.proposalTitle)
      if (detected.proposalNumber) setProposalNumber(detected.proposalNumber)
      if (detected.proposalDate) setProposalDate(detected.proposalDate)
      setAutoDetected(detected.autoDetected)
    }
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  // Drag & drop handlers
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const droppedFiles = Array.from(e.dataTransfer.files)
    handleFilesAdded(droppedFiles)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      handleFilesAdded(Array.from(e.target.files))
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  async function handleSubmit() {
    if (files.length === 0) {
      setError("Selecione ao menos um arquivo.")
      return
    }

    if (!clientName.trim()) {
      setError("Informe o nome do cliente.")
      return
    }

    if (!proposalTitle.trim()) {
      setError("Informe o titulo da proposta.")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      for (const file of files) {
        formData.append("files", file)
      }

      formData.append("clientName", clientName.trim())
      if (selectedClientId) formData.append("clientId", selectedClientId)
      formData.append("proposalTitle", proposalTitle.trim())
      if (proposalNumber) formData.append("proposalNumber", proposalNumber.trim())
      if (proposalDate) formData.append("proposalDate", proposalDate)
      formData.append("status", status)
      if (value) formData.append("value", value)

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      const data: UploadResult = await response.json()

      if (!response.ok) {
        setError(data.error || "Erro ao fazer upload.")
        return
      }

      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao fazer upload.")
    } finally {
      setLoading(false)
    }
  }

  function handleReset() {
    setFiles([])
    setClientName("")
    setSelectedClientId(null)
    setProposalTitle("")
    setProposalNumber("")
    setProposalDate("")
    setStatus("draft")
    setValue("")
    setResult(null)
    setError(null)
    setAutoDetected(false)
    setClientSuggestions([])
  }

  function formatCurrency(val: number) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val)
  }

  // Success state
  if (result?.success) {
    const analysis = result.analysis

    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Upload Inteligente</h1>
          <p className="text-sm text-muted-foreground">
            Suba arquivos e crie propostas automaticamente
          </p>
        </div>

        {/* Sucesso */}
        <Card className="border-emerald-500/30">
          <CardContent className="flex flex-col items-center gap-4 py-8">
            <div className="flex size-14 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 className="size-7 text-emerald-500" />
            </div>
            <div className="text-center">
              <h2 className="text-lg font-semibold">Upload concluido!</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Proposta <strong>{result.proposal?.title}</strong> criada para o cliente{" "}
                <strong>{result.clientName}</strong>
              </p>
              {result.files && (
                <p className="text-sm text-muted-foreground">
                  {result.files.length} arquivo(s) enviado(s)
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Analise IA */}
        {analysis && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Sparkles className="size-4 text-primary" />
                Analise da Proposta (IA)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Resumo */}
              {analysis.summary && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Resumo
                  </p>
                  <p className="mt-1 text-sm leading-relaxed">
                    {analysis.summary}
                  </p>
                </div>
              )}

              {/* Valor + Prazo */}
              {(analysis.value || analysis.deadline) && (
                <div className="flex gap-4">
                  {analysis.value && (
                    <div className="flex-1 rounded-lg bg-emerald-500/10 p-3">
                      <p className="text-xs font-medium text-emerald-600">
                        Valor detectado
                      </p>
                      <p className="text-lg font-bold text-emerald-700">
                        {formatCurrency(analysis.value)}
                      </p>
                    </div>
                  )}
                  {analysis.deadline && (
                    <div className="flex-1 rounded-lg bg-blue-500/10 p-3">
                      <p className="text-xs font-medium text-blue-600">
                        Prazo
                      </p>
                      <p className="text-lg font-bold text-blue-700">
                        {analysis.deadline}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Servicos */}
              {analysis.services.length > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Servicos oferecidos
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {analysis.services.map((service, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {service}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Pontos principais */}
              {analysis.highlights.length > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Pontos principais
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {analysis.highlights.map((point, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Erros */}
        {result.errors && result.errors.length > 0 && (
          <Card className="border-amber-500/30">
            <CardContent className="py-4">
              <p className="text-sm font-medium text-amber-600">
                Alguns arquivos tiveram erro:
              </p>
              {result.errors.map((err, i) => (
                <p key={i} className="text-xs text-amber-600">{err}</p>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Acoes */}
        <div className="flex justify-center gap-3">
          <Button variant="outline" onClick={handleReset}>
            <Upload className="size-4" />
            Enviar mais
          </Button>
          <Button onClick={() => router.push(`/clients/${result.clientId}`)}>
            Ver cliente
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Upload Inteligente</h1>
        <p className="text-sm text-muted-foreground">
          Suba arquivos e crie propostas automaticamente
        </p>
      </div>

      {/* Drop zone */}
      <Card>
        <CardContent className="p-0">
          <div
            className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 transition-colors ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/20 hover:border-muted-foreground/40"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className={`flex size-14 items-center justify-center rounded-full transition-colors ${
              isDragging ? "bg-primary/10" : "bg-muted"
            }`}>
              <FileUp className={`size-6 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">
                {isDragging ? "Solte os arquivos aqui" : "Arraste arquivos ou clique para selecionar"}
              </p>
              <p className="text-xs text-muted-foreground">
                PDF, DOCX, PPTX, XLSX
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.pptx,.xlsx"
              className="hidden"
              onChange={handleFileInput}
            />
          </div>
        </CardContent>
      </Card>

      {/* File list */}
      {files.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-sm">
              <span>Arquivos selecionados</span>
              <Badge variant="secondary">{files.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {files.map((file, idx) => {
              const ext = file.name.split(".").pop()?.toLowerCase() || ""
              const Icon = fileIcons[ext] || File

              return (
                <div
                  key={`${file.name}-${idx}`}
                  className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2"
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeFile(idx)
                    }}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Detected / editable fields */}
      {files.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              {autoDetected && <Sparkles className="size-4 text-primary" />}
              {autoDetected
                ? "Dados detectados automaticamente"
                : "Preencha os dados da proposta"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Client name */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="client-name">Cliente *</Label>
              <div className="relative">
                <Input
                  id="client-name"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Nome do cliente"
                />
                {selectedClientId && (
                  <Badge
                    variant="secondary"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px]"
                  >
                    Existente
                  </Badge>
                )}
              </div>
              {clientSuggestions.length > 0 && !selectedClientId && (
                <div className="flex flex-wrap gap-1.5">
                  {clientSuggestions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="rounded-md border bg-muted/50 px-2.5 py-1 text-xs transition-colors hover:bg-muted"
                      onClick={() => {
                        setClientName(c.name)
                        setSelectedClientId(c.id)
                        setClientSuggestions([])
                      }}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
              {clientName && !selectedClientId && clientSuggestions.length === 0 && clientName.length >= 2 && (
                <p className="text-xs text-amber-600">
                  Cliente nao encontrado. Sera criado automaticamente.
                </p>
              )}
            </div>

            {/* Proposal title */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="proposal-title">Titulo da proposta *</Label>
              <Input
                id="proposal-title"
                value={proposalTitle}
                onChange={(e) => setProposalTitle(e.target.value)}
                placeholder="Ex: Prop1234 - Desenvolvimento de App"
              />
            </div>

            {/* Number + Date */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="proposal-number">Numero</Label>
                <Input
                  id="proposal-number"
                  value={proposalNumber}
                  onChange={(e) => setProposalNumber(e.target.value)}
                  placeholder="Ex: Prop1234"
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

            {/* Status + Value */}
            <div className="grid grid-cols-2 gap-4">
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
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={handleReset} disabled={loading}>
                Limpar
              </Button>
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Enviando e analisando...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" />
                    Criar proposta e analisar com IA
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
