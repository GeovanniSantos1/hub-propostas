"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Check } from "lucide-react"

interface SettingsProfileFormProps {
  userId: string
  currentName: string
}

export function SettingsProfileForm({
  userId,
  currentName,
}: SettingsProfileFormProps) {
  const router = useRouter()
  const [name, setName] = React.useState(currentName)
  const [loading, setLoading] = React.useState(false)
  const [saved, setSaved] = React.useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!userId) return

    setLoading(true)
    setSaved(false)

    try {
      const supabase = createClient()
      await supabase
        .from("profiles")
        .update({ full_name: name.trim() || null })
        .eq("id", userId)

      setSaved(true)
      router.refresh()
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error("Erro ao salvar perfil:", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="profile-name">Nome completo</Label>
        <Input
          id="profile-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Seu nome"
        />
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : saved ? (
            <Check className="size-4" />
          ) : null}
          {saved ? "Salvo" : "Salvar"}
        </Button>
      </div>
    </form>
  )
}
