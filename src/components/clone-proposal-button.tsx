"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Copy, Loader2, Check } from "lucide-react"
import { Button } from "@/components/ui/button"

interface CloneProposalButtonProps {
  proposalId: string
  proposalTitle: string
}

export function CloneProposalButton({ proposalId, proposalTitle }: CloneProposalButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)
  const [done, setDone] = React.useState(false)

  async function handleClone() {
    setLoading(true)
    try {
      const res = await fetch(`/api/proposals/${proposalId}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })

      if (res.ok) {
        setDone(true)
        setTimeout(() => {
          router.refresh()
          setDone(false)
        }, 1500)
      }
    } catch {
      // silenciar
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
      onClick={handleClone}
      disabled={loading || done}
      title={`Clonar: ${proposalTitle}`}
    >
      {loading ? (
        <Loader2 className="size-3 animate-spin" />
      ) : done ? (
        <Check className="size-3 text-emerald-500" />
      ) : (
        <Copy className="size-3" />
      )}
    </Button>
  )
}
