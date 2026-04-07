"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Sparkles,
  Building2,
  Tag,
  Brain,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Search,
  AlertTriangle,
  Lightbulb,
  TrendingUp,
  Target,
  Clock,
  Users,
  FileText,
  Info,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { ProposalStatus, TagCategory } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

// ---- Types ----
interface TagItem { id: string; name: string; category: TagCategory; color: string | null }
interface ClientItem { id: string; name: string; sector: string | null }

interface AISuggestion {
  suggested_value: number
  value_range: { min: number; max: number }
  win_probability: number
  title_suggestion: string
  description: string
  scope_suggestion: string
  timeline: string
  team_suggestion: string
  alerts: string[]
  reasoning: string
}

interface BuilderResponse {
  suggestion: AISuggestion
  stats: {
    similarWonCount: number
    avgWonValue: number
    medianWonValue: number
    sectorAvgWon: number
    sectorConversionRate: number
    clientAvgWon: number
  }
  similarProposals: {
    won: { id: string; title: string; value: number; client_name: string }[]
    lost: { id: string; title: string; value: number; loss_reason: string | null; client_name: string }[]
  }
  clientContext: {
    healthScore: number
    totalProposals: number
    wonProposals: number
    suggestions: string[]
  }
}

// ---- Helpers ----
function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v)
}

function getScoreColor(score: number) {
  if (score >= 70) return "text-emerald-500"
  if (score >= 40) return "text-amber-500"
  return "text-red-500"
}

const categoryLabels: Record<TagCategory, string> = { service: "Servicos", technology: "Tecnologias", area: "Areas" }

const steps = [
  { label: "Cliente", icon: Building2 },
  { label: "Servicos", icon: Tag },
  { label: "IA Sugere", icon: Brain },
  { label: "Criar", icon: CheckCircle2 },
]

// ---- Component ----
export default function ProposalBuilderPage() {
  const router = useRouter()
  const [step, setStep] = React.useState(0)

  // Step 1 - Client
  const [clientQuery, setClientQuery] = React.useState("")
  const [clientResults, setClientResults] = React.useState<ClientItem[]>([])
  const [selectedClient, setSelectedClient] = React.useState<ClientItem | null>(null)

  // Step 2 - Services/Tags
  const [allTags, setAllTags] = React.useState<TagItem[]>([])
  const [selectedTags, setSelectedTags] = React.useState<Set<string>>(new Set())
  const [scopeDescription, setScopeDescription] = React.useState("")

  // Step 3 - AI response
  const [aiLoading, setAiLoading] = React.useState(false)
  const [aiResult, setAiResult] = React.useState<BuilderResponse | null>(null)

  // Step 4 - Final form
  const [title, setTitle] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [value, setValue] = React.useState("")
  const [creating, setCreating] = React.useState(false)

  // ---- Search clients ----
  React.useEffect(() => {
    if (clientQuery.length < 2) { setClientResults([]); return }
    const timer = setTimeout(async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from("clients")
        .select("id, name, sector")
        .ilike("name", `%${clientQuery}%`)
        .limit(8)
      setClientResults(data || [])
    }, 250)
    return () => clearTimeout(timer)
  }, [clientQuery])

  // ---- Load tags ----
  React.useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase.from("tags").select("*").order("category").order("name")
      if (data) setAllTags(data)
    }
    load()
  }, [])

  // ---- Tag grouping ----
  const groupedTags = allTags.reduce((acc, tag) => {
    if (!acc[tag.category]) acc[tag.category] = []
    acc[tag.category].push(tag)
    return acc
  }, {} as Record<TagCategory, TagItem[]>)

  function toggleTag(id: string) {
    setSelectedTags(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const serviceTags = allTags.filter(t => t.category === "service" && selectedTags.has(t.id)).map(t => t.id)
  const technologyTags = allTags.filter(t => t.category === "technology" && selectedTags.has(t.id)).map(t => t.id)

  // ---- Call AI ----
  const [aiError, setAiError] = React.useState<string | null>(null)

  async function callBuilder() {
    if (!selectedClient) return
    setAiLoading(true)
    setAiError(null)
    try {
      const svcTags = allTags.filter(t => t.category === "service" && selectedTags.has(t.id)).map(t => t.id)
      const techTags = allTags.filter(t => t.category === "technology" && selectedTags.has(t.id)).map(t => t.id)

      const res = await fetch("/api/ai/proposal-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClient.id,
          serviceTags: svcTags,
          technologyTags: techTags,
          scopeDescription,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setAiError(data.error || "Erro ao gerar sugestao.")
        return
      }

      setAiResult(data as BuilderResponse)
      // Pre-fill step 4
      setTitle(data.suggestion?.title_suggestion || "")
      setDescription(data.suggestion?.description || "")
      setValue(String(data.suggestion?.suggested_value || ""))
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Erro de conexao.")
    } finally {
      setAiLoading(false)
    }
  }

  // When entering step 3, auto-call AI
  const calledRef = React.useRef(false)
  React.useEffect(() => {
    if (step === 2 && !aiResult && !aiLoading && !calledRef.current) {
      calledRef.current = true
      callBuilder()
    }
    if (step !== 2) {
      calledRef.current = false
    }
  }, [step])

  // ---- Create proposal ----
  async function handleCreate() {
    if (!selectedClient || !title.trim()) return
    setCreating(true)
    try {
      const supabase = createClient()
      const { data: userData } = await supabase.auth.getUser()

      const { data: proposal, error } = await supabase
        .from("proposals")
        .insert({
          client_id: selectedClient.id,
          title: title.trim(),
          description: description.trim() || null,
          value: value ? parseFloat(value) : null,
          status: "draft" as ProposalStatus,
          created_by: userData?.user?.id || null,
          ai_generated: true,
          ai_suggestion: aiResult?.suggestion || null,
        })
        .select("id")
        .single()

      if (error || !proposal) throw error

      // Atribuir tags
      if (selectedTags.size > 0) {
        const tagRows = [...selectedTags].map(tagId => ({
          proposal_id: proposal.id,
          tag_id: tagId,
        }))
        await supabase.from("proposal_tags").insert(tagRows)
      }

      router.push(`/clients/${selectedClient.id}`)
    } catch (err) {
      console.error(err)
    } finally {
      setCreating(false)
    }
  }

  // ---- Navigation ----
  function canAdvance() {
    if (step === 0) return !!selectedClient
    if (step === 1) return selectedTags.size > 0 || scopeDescription.trim().length > 0
    if (step === 2) return !!aiResult
    return !!title.trim()
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Nova Proposta</h1>
        <p className="text-sm text-muted-foreground">
          Construtor inteligente com calculo de valor baseado no historico
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-1">
        {steps.map((s, i) => {
          const Icon = s.icon
          const isActive = i === step
          const isDone = i < step
          return (
            <React.Fragment key={i}>
              {i > 0 && <div className={`h-px flex-1 ${isDone ? "bg-primary" : "bg-border"}`} />}
              <div
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive ? "bg-primary text-primary-foreground" :
                  isDone ? "bg-primary/10 text-primary" :
                  "bg-muted text-muted-foreground"
                }`}
              >
                <Icon className="size-3.5" />
                <span className="hidden sm:inline">{s.label}</span>
              </div>
            </React.Fragment>
          )
        })}
      </div>

      {/* ============================================================ */}
      {/* STEP 0 - Selecionar Cliente */}
      {/* ============================================================ */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="size-5" />
              Selecionar Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedClient ? (
              <>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Buscar cliente..."
                    value={clientQuery}
                    onChange={(e) => setClientQuery(e.target.value)}
                    className="pl-9"
                    autoFocus
                  />
                </div>
                {clientResults.length > 0 && (
                  <div className="space-y-1">
                    {clientResults.map(c => (
                      <button
                        key={c.id}
                        className="flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-sm hover:bg-muted transition-colors"
                        onClick={() => { setSelectedClient(c); setClientQuery("") }}
                      >
                        <Building2 className="size-4 text-blue-500" />
                        <span className="flex-1 text-left font-medium">{c.name}</span>
                        {c.sector && <Badge variant="outline" className="text-[10px]">{c.sector}</Badge>}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-blue-500/10">
                    <Building2 className="size-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="font-semibold">{selectedClient.name}</p>
                    {selectedClient.sector && <p className="text-xs text-muted-foreground">{selectedClient.sector}</p>}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => { setSelectedClient(null); setAiResult(null) }}>
                  Trocar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ============================================================ */}
      {/* STEP 1 - Servicos e Escopo */}
      {/* ============================================================ */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Tag className="size-5" />
              Servicos e Escopo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {(Object.entries(groupedTags) as [TagCategory, TagItem[]][]).map(([category, tags]) => (
              <div key={category}>
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {categoryLabels[category]}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map(tag => {
                    const isSelected = selectedTags.has(tag.id)
                    return (
                      <button
                        key={tag.id}
                        onClick={() => toggleTag(tag.id)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                          isSelected
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:bg-muted"
                        }`}
                        style={isSelected && tag.color ? {
                          borderColor: tag.color,
                          color: tag.color,
                          backgroundColor: `${tag.color}15`,
                        } : undefined}
                      >
                        {tag.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}

            <div className="space-y-2">
              <Label htmlFor="scope">Descricao do escopo</Label>
              <Textarea
                id="scope"
                value={scopeDescription}
                onChange={(e) => setScopeDescription(e.target.value)}
                placeholder="Descreva o que o cliente precisa... Ex: Desenvolvimento de portal web para gestao de pedidos com integracao SAP, dashboard de indicadores e app mobile para vendedores."
                rows={4}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ============================================================ */}
      {/* STEP 2 - IA Sugere */}
      {/* ============================================================ */}
      {step === 2 && (
        <>
          {aiLoading && (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-16">
                <Loader2 className="size-8 animate-spin text-primary" />
                <div className="text-center">
                  <p className="font-medium">Analisando historico e calculando...</p>
                  <p className="text-sm text-muted-foreground">
                    Buscando propostas similares e consultando IA...
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {aiError && !aiLoading && (
            <Card className="border-red-500/30">
              <CardContent className="flex flex-col items-center gap-3 py-12">
                <AlertTriangle className="size-8 text-red-500" />
                <p className="text-sm text-red-500">{aiError}</p>
                <Button variant="outline" onClick={() => { calledRef.current = false; setAiError(null); callBuilder() }}>
                  Tentar novamente
                </Button>
              </CardContent>
            </Card>
          )}

          {aiResult && !aiLoading && (
            <div className="space-y-4">
              {/* Valor sugerido */}
              <Card className="border-primary/30">
                <CardContent className="py-6">
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Valor Sugerido</p>
                    <p className="text-4xl font-bold text-primary">
                      {formatCurrency(aiResult.suggestion.suggested_value)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Faixa: {formatCurrency(aiResult.suggestion.value_range.min)} - {formatCurrency(aiResult.suggestion.value_range.max)}
                    </p>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <div className="rounded-lg bg-muted/50 p-3 text-center">
                      <Target className="mx-auto mb-1 size-4 text-amber-500" />
                      <p className="text-lg font-bold">{Math.round(aiResult.suggestion.win_probability * 100)}%</p>
                      <p className="text-[10px] text-muted-foreground">Prob. ganho</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3 text-center">
                      <FileText className="mx-auto mb-1 size-4 text-blue-500" />
                      <p className="text-lg font-bold">{aiResult.stats.similarWonCount}</p>
                      <p className="text-[10px] text-muted-foreground">Similares ganhas</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3 text-center">
                      <TrendingUp className={`mx-auto mb-1 size-4 ${getScoreColor(aiResult.clientContext.healthScore)}`} />
                      <p className="text-lg font-bold">{aiResult.clientContext.healthScore}</p>
                      <p className="text-[10px] text-muted-foreground">Health Score</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Escopo + Prazo + Equipe */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Escopo Sugerido</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-line text-sm text-muted-foreground">
                      {aiResult.suggestion.scope_suggestion}
                    </p>
                  </CardContent>
                </Card>
                <div className="space-y-4">
                  <Card>
                    <CardContent className="flex items-center gap-3 py-4">
                      <Clock className="size-5 text-blue-500" />
                      <div>
                        <p className="text-sm font-medium">{aiResult.suggestion.timeline}</p>
                        <p className="text-xs text-muted-foreground">Prazo estimado</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="flex items-center gap-3 py-4">
                      <Users className="size-5 text-violet-500" />
                      <div>
                        <p className="text-sm font-medium">{aiResult.suggestion.team_suggestion}</p>
                        <p className="text-xs text-muted-foreground">Equipe sugerida</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Alertas */}
              {aiResult.suggestion.alerts && aiResult.suggestion.alerts.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Lightbulb className="size-4 text-amber-500" />
                      Alertas e Insights
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {aiResult.suggestion.alerts.map((alert, i) => (
                      <div key={i} className="flex items-start gap-2 rounded-lg bg-amber-500/5 p-2.5">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
                        <p className="text-sm">{alert}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Raciocinio */}
              {aiResult.suggestion.reasoning && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Info className="size-4 text-muted-foreground" />
                      Como a IA calculou
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{aiResult.suggestion.reasoning}</p>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded bg-muted/50 p-2">
                        <span className="text-muted-foreground">Media ganhas (tags): </span>
                        <span className="font-medium">{formatCurrency(aiResult.stats.avgWonValue)}</span>
                      </div>
                      <div className="rounded bg-muted/50 p-2">
                        <span className="text-muted-foreground">Media setor: </span>
                        <span className="font-medium">{formatCurrency(aiResult.stats.sectorAvgWon)}</span>
                      </div>
                      <div className="rounded bg-muted/50 p-2">
                        <span className="text-muted-foreground">Media cliente: </span>
                        <span className="font-medium">{formatCurrency(aiResult.stats.clientAvgWon)}</span>
                      </div>
                      <div className="rounded bg-muted/50 p-2">
                        <span className="text-muted-foreground">Conversao setor: </span>
                        <span className="font-medium">{aiResult.stats.sectorConversionRate}%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Propostas similares de referencia */}
              {aiResult.similarProposals.won.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Propostas similares (referencia)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {aiResult.similarProposals.won.map(p => (
                      <div key={p.id} className="flex items-center justify-between rounded bg-muted/30 px-3 py-1.5 text-sm">
                        <div className="min-w-0">
                          <span className="truncate font-medium">{p.title}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{p.client_name}</span>
                        </div>
                        <Badge variant="secondary" className="text-xs">{formatCurrency(p.value)}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </>
      )}

      {/* ============================================================ */}
      {/* STEP 3 - Revisar e Criar */}
      {/* ============================================================ */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="size-5" />
              Revisar e Criar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="final-title">Titulo *</Label>
              <Input
                id="final-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Titulo da proposta"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="final-desc">Descricao</Label>
              <Textarea
                id="final-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="final-value">Valor (R$)</Label>
                <Input
                  id="final-value"
                  type="number"
                  step="0.01"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
                {aiResult && (
                  <p className="text-[10px] text-muted-foreground">
                    Sugerido: {formatCurrency(aiResult.suggestion.suggested_value)} (faixa {formatCurrency(aiResult.suggestion.value_range.min)} - {formatCurrency(aiResult.suggestion.value_range.max)})
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label>Cliente</Label>
                <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                  <Building2 className="size-4 text-blue-500" />
                  {selectedClient?.name}
                </div>
              </div>
            </div>

            <div>
              <Label>Tags selecionadas</Label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {allTags.filter(t => selectedTags.has(t.id)).map(tag => (
                  <Badge
                    key={tag.id}
                    variant="secondary"
                    className="text-xs"
                    style={{ borderColor: tag.color || undefined, color: tag.color || undefined }}
                  >
                    {tag.name}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ============================================================ */}
      {/* Navigation */}
      {/* ============================================================ */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setStep(s => s - 1)}
          disabled={step === 0}
        >
          <ChevronLeft className="size-4" />
          Voltar
        </Button>

        {step < 3 ? (
          <Button
            onClick={() => setStep(s => s + 1)}
            disabled={!canAdvance()}
          >
            Proximo
            <ChevronRight className="size-4" />
          </Button>
        ) : (
          <Button onClick={handleCreate} disabled={creating || !title.trim()}>
            {creating ? (
              <><Loader2 className="size-4 animate-spin" /> Criando...</>
            ) : (
              <><Sparkles className="size-4" /> Criar Proposta</>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
