"use client"

import * as React from "react"
import { Plus, X, Tag as TagIcon, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { TagCategory } from "@/types/database"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface Tag {
  id: string
  name: string
  category: TagCategory
  color: string | null
}

const categoryLabels: Record<TagCategory, string> = {
  service: "Servico",
  technology: "Tecnologia",
  area: "Area",
}

interface ProposalTagsProps {
  proposalId: string
  initialTags?: Tag[]
  editable?: boolean
}

export function ProposalTags({
  proposalId,
  initialTags = [],
  editable = true,
}: ProposalTagsProps) {
  const [tags, setTags] = React.useState<Tag[]>(initialTags)
  const [allTags, setAllTags] = React.useState<Tag[]>([])
  const [loading, setLoading] = React.useState(false)
  const [open, setOpen] = React.useState(false)

  // Load all tags when popover opens
  React.useEffect(() => {
    if (!open || allTags.length > 0) return

    async function loadTags() {
      const supabase = createClient()
      const { data } = await supabase
        .from("tags")
        .select("*")
        .order("category")
        .order("name")

      if (data) setAllTags(data)
    }

    loadTags()
  }, [open, allTags.length])

  async function toggleTag(tag: Tag) {
    const isSelected = tags.some((t) => t.id === tag.id)
    const newTags = isSelected
      ? tags.filter((t) => t.id !== tag.id)
      : [...tags, tag]

    setTags(newTags)
    setLoading(true)

    await fetch(`/api/proposals/${proposalId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: newTags.map((t) => t.id) }),
    })

    setLoading(false)
  }

  async function removeTag(tagId: string) {
    const newTags = tags.filter((t) => t.id !== tagId)
    setTags(newTags)

    await fetch(`/api/proposals/${proposalId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: newTags.map((t) => t.id) }),
    })
  }

  // Agrupar por categoria
  const grouped = allTags.reduce(
    (acc, tag) => {
      if (!acc[tag.category]) acc[tag.category] = []
      acc[tag.category].push(tag)
      return acc
    },
    {} as Record<TagCategory, Tag[]>
  )

  const selectedIds = new Set(tags.map((t) => t.id))

  return (
    <div className="flex flex-wrap items-center gap-1">
      {tags.map((tag) => (
        <Badge
          key={tag.id}
          variant="secondary"
          className="gap-1 text-[10px]"
          style={{
            borderColor: tag.color || undefined,
            color: tag.color || undefined,
          }}
        >
          {tag.name}
          {editable && (
            <button
              type="button"
              onClick={() => removeTag(tag.id)}
              className="ml-0.5 hover:opacity-70"
            >
              <X className="size-2.5" />
            </button>
          )}
        </Badge>
      ))}

      {editable && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <Button variant="ghost" size="icon-sm" className="size-5">
                {loading ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Plus className="size-3" />
                )}
              </Button>
            }
          />
          <PopoverContent className="w-64 p-2" align="start">
            <div className="space-y-3">
              {(Object.entries(grouped) as [TagCategory, Tag[]][]).map(
                ([category, categoryTags]) => (
                  <div key={category}>
                    <p className="mb-1 px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {categoryLabels[category]}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {categoryTags.map((tag) => {
                        const isSelected = selectedIds.has(tag.id)
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => toggleTag(tag)}
                            className={`rounded-md border px-2 py-0.5 text-xs transition-colors ${
                              isSelected
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border hover:bg-muted"
                            }`}
                            style={
                              isSelected
                                ? {
                                    borderColor: tag.color || undefined,
                                    color: tag.color || undefined,
                                    backgroundColor: tag.color
                                      ? `${tag.color}15`
                                      : undefined,
                                  }
                                : undefined
                            }
                          >
                            {tag.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              )}

              {allTags.length === 0 && (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  Carregando tags...
                </p>
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
