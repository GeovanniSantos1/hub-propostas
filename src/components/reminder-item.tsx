"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  formatDistanceToNow,
  isPast,
  isToday,
  parseISO,
  format,
} from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  Building2,
  FileText,
  User,
  Loader2,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ReminderItemProps {
  id: string
  title: string
  description: string | null
  dueDate: string
  clientName: string | null
  proposalTitle: string | null
  assignedTo: string | null
  completed: boolean
}

function getDueDateInfo(dueDate: string) {
  const date = parseISO(dueDate)
  const overdue = isPast(date) && !isToday(date)
  const today = isToday(date)

  let relativeText: string
  if (overdue) {
    relativeText = `atrasado ${formatDistanceToNow(date, { locale: ptBR })}`
  } else if (today) {
    relativeText = "vence hoje"
  } else {
    relativeText = `em ${formatDistanceToNow(date, { locale: ptBR })}`
  }

  return { overdue, today, relativeText }
}

export function ReminderItem({
  id,
  title,
  description,
  dueDate,
  clientName,
  proposalTitle,
  assignedTo,
  completed,
}: ReminderItemProps) {
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)

  const { overdue, today, relativeText } = getDueDateInfo(dueDate)
  const formattedDate = format(parseISO(dueDate), "dd/MM/yyyy", {
    locale: ptBR,
  })

  async function handleComplete() {
    setLoading(true)
    try {
      const supabase = createClient()
      await supabase
        .from("reminders")
        .update({
          completed: true,
          completed_at: new Date().toISOString(),
        })
        .eq("id", id)

      router.refresh()
    } catch (err) {
      console.error("Erro ao concluir lembrete:", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card
      className={cn(
        "transition-colors",
        !completed && overdue && "ring-red-500/30 ring-2",
        !completed && today && "ring-amber-500/30 ring-2",
        completed && "opacity-70"
      )}
      size="sm"
    >
      <CardContent className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center gap-2">
            {completed ? (
              <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
            ) : overdue ? (
              <AlertTriangle className="size-4 shrink-0 text-red-500" />
            ) : (
              <Clock className="size-4 shrink-0 text-muted-foreground" />
            )}
            <span
              className={cn(
                "font-medium",
                completed && "line-through text-muted-foreground"
              )}
            >
              {title}
            </span>
          </div>

          {description && (
            <p className="text-sm text-muted-foreground pl-6">{description}</p>
          )}

          <div className="flex flex-wrap items-center gap-3 pl-6 text-xs text-muted-foreground">
            <span
              className={cn(
                "inline-flex items-center gap-1",
                !completed && overdue && "text-red-500 font-medium",
                !completed && today && "text-amber-500 font-medium"
              )}
            >
              <Clock className="size-3" />
              {formattedDate} ({relativeText})
            </span>

            {clientName && (
              <span className="inline-flex items-center gap-1">
                <Building2 className="size-3" />
                {clientName}
              </span>
            )}

            {proposalTitle && (
              <span className="inline-flex items-center gap-1">
                <FileText className="size-3" />
                {proposalTitle}
              </span>
            )}

            {assignedTo && (
              <span className="inline-flex items-center gap-1">
                <User className="size-3" />
                {assignedTo}
              </span>
            )}
          </div>
        </div>

        {!completed && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleComplete}
            disabled={loading}
            className="shrink-0"
          >
            {loading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="size-3.5" />
            )}
            Concluir
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
