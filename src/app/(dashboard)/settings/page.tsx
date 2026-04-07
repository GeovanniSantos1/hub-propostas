import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Upload, Users } from "lucide-react"
import { SettingsProfileForm } from "@/components/settings-profile-form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export default async function SettingsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let profile: {
    full_name: string | null
    role: string
    avatar_url: string | null
  } | null = null

  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, role, avatar_url")
      .eq("id", user.id)
      .single()
    profile = data
  }

  const { data: teamMembers } = await supabase
    .from("profiles")
    .select("id, full_name, role, avatar_url")
    .order("full_name", { ascending: true })

  const displayName = profile?.full_name || user?.email?.split("@")[0] || ""
  const displayEmail = user?.email || ""
  const displayRole = profile?.role || "member"

  const initials = displayName
    ? displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "US"

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuracoes</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie seu perfil e configuracoes da equipe
        </p>
      </div>

      {/* Profile section */}
      <Card>
        <CardHeader>
          <CardTitle>Perfil</CardTitle>
          <CardDescription>Suas informacoes pessoais</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <Avatar>
              <AvatarImage src={profile?.avatar_url || ""} alt={displayName} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="font-medium">{displayName || "Usuario"}</span>
              <span className="text-sm text-muted-foreground">
                {displayEmail}
              </span>
              <Badge variant="secondary" className="mt-1 w-fit text-xs">
                {displayRole === "admin" ? "Administrador" : "Membro"}
              </Badge>
            </div>
          </div>

          <Separator />

          <SettingsProfileForm
            userId={user?.id || ""}
            currentName={displayName}
          />
        </CardContent>
      </Card>

      {/* Import section */}
      <Card>
        <CardHeader>
          <CardTitle>Importar Hub Propostas</CardTitle>
          <CardDescription>
            Importe dados de uma planilha ou sistema existente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button variant="outline" disabled>
                    <Upload className="size-4" />
                    Importar Dados
                  </Button>
                }
              />
              <TooltipContent>Em breve</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardContent>
      </Card>

      {/* Team section */}
      <Card>
        <CardHeader>
          <CardTitle>Equipe</CardTitle>
          <CardDescription>Membros com acesso ao sistema</CardDescription>
        </CardHeader>
        <CardContent>
          {teamMembers && teamMembers.length > 0 ? (
            <div className="flex flex-col gap-3">
              {teamMembers.map((member) => {
                const memberInitials = member.full_name
                  ? member.full_name
                      .split(" ")
                      .map((n: string) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)
                  : "US"

                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
                  >
                    <Avatar size="sm">
                      <AvatarImage
                        src={member.avatar_url || ""}
                        alt={member.full_name || ""}
                      />
                      <AvatarFallback>{memberInitials}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-sm font-medium truncate">
                        {member.full_name || "Sem nome"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {member.role === "admin" ? "Administrador" : "Membro"}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              <Users className="size-8 opacity-40" />
              <span>Nenhum membro encontrado</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
