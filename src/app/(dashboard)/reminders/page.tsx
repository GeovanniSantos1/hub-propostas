import { createClient } from "@/lib/supabase/server"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Bell } from "lucide-react"
import { ReminderItem } from "@/components/reminder-item"

export default async function RemindersPage() {
  const supabase = await createClient()

  const { data: pendingReminders } = await supabase
    .from("reminders")
    .select(
      `
      *,
      clients(name),
      proposals(title)
    `
    )
    .eq("completed", false)
    .order("due_date", { ascending: true })

  const { data: completedReminders } = await supabase
    .from("reminders")
    .select(
      `
      *,
      clients(name),
      proposals(title)
    `
    )
    .eq("completed", true)
    .order("completed_at", { ascending: false })
    .limit(50)

  const pending = pendingReminders || []
  const completed = completedReminders || []

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Lembretes</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe prazos e tarefas pendentes
        </p>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">
            Pendentes
            {pending.length > 0 && (
              <span className="ml-1.5 inline-flex size-5 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                {pending.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed">Concluidos</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          {pending.length > 0 ? (
            <div className="flex flex-col gap-3">
              {pending.map((reminder) => {
                const client = reminder.clients as unknown as { name: string } | null
                const proposal = reminder.proposals as unknown as { title: string } | null

                return (
                  <ReminderItem
                    key={reminder.id}
                    id={reminder.id}
                    title={reminder.title}
                    description={reminder.description}
                    dueDate={reminder.due_date}
                    clientName={client?.name || null}
                    proposalTitle={proposal?.title || null}
                    assignedTo={reminder.assigned_to}
                    completed={false}
                  />
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
              <Bell className="size-8 opacity-40" />
              <span>Nenhum lembrete pendente</span>
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed">
          {completed.length > 0 ? (
            <div className="flex flex-col gap-3">
              {completed.map((reminder) => {
                const client = reminder.clients as unknown as { name: string } | null
                const proposal = reminder.proposals as unknown as { title: string } | null

                return (
                  <ReminderItem
                    key={reminder.id}
                    id={reminder.id}
                    title={reminder.title}
                    description={reminder.description}
                    dueDate={reminder.due_date}
                    clientName={client?.name || null}
                    proposalTitle={proposal?.title || null}
                    assignedTo={reminder.assigned_to}
                    completed={true}
                  />
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
              <Bell className="size-8 opacity-40" />
              <span>Nenhum lembrete concluido</span>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
