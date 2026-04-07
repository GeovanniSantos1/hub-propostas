"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Building2,
  FileText,
  Bell,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  Upload,
  Kanban,
  Radar,
  TrendingUp,
  GitCompareArrows,
  History,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet"
import { ThemeToggle } from "@/components/theme-toggle"

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pipeline", label: "Pipeline", icon: Kanban },
  { href: "/clients", label: "Clientes", icon: Building2 },
  { href: "/proposals", label: "Propostas", icon: FileText },
  { href: "/proposals/new", label: "Nova Proposta", icon: Sparkles },
  { href: "/opportunities", label: "Oportunidades", icon: Radar },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/forecast", label: "Forecast", icon: TrendingUp },
  { href: "/compare", label: "Comparar", icon: GitCompareArrows },
  { href: "/reminders", label: "Lembretes", icon: Bell },
  { href: "/reports", label: "Relatórios", icon: BarChart3 },
  { href: "/activity", label: "Atividades", icon: History },
  { href: "/settings", label: "Configurações", icon: Settings },
]

function SidebarNav() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-1 flex-col gap-0.5 px-3">
      {navItems.map((item) => {
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href)

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
              isActive
                ? "bg-sidebar-primary/20 text-sidebar-primary shadow-sm shadow-sidebar-primary/10"
                : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            )}
          >
            <item.icon className={cn("size-4 shrink-0", isActive && "text-sidebar-primary")} />
            {item.label}
            {isActive && (
              <div className="ml-auto size-1.5 rounded-full bg-sidebar-primary" />
            )}
          </Link>
        )
      })}
    </nav>
  )
}

function SidebarUser() {
  const [user, setUser] = React.useState<{
    email: string
    fullName: string
    avatarUrl: string | null
    initials: string
  } | null>(null)

  React.useEffect(() => {
    async function loadUser() {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()

      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", authUser.id)
        .single()

      const fullName = profile?.full_name || authUser.user_metadata?.full_name || authUser.email?.split("@")[0] || "Usuario"
      const initials = fullName
        .split(" ")
        .slice(0, 2)
        .map((w: string) => w[0]?.toUpperCase())
        .join("")

      setUser({
        email: authUser.email || "",
        fullName,
        avatarUrl: profile?.avatar_url || null,
        initials,
      })
    }
    loadUser()
  }, [])

  async function handleLogout() {
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = "/auth/login"
  }

  return (
    <div className="px-3 pb-4">
      <Separator className="mb-3 bg-sidebar-border" />
      <div className="flex items-center gap-3 rounded-lg px-2 py-2">
        <Avatar size="sm">
          <AvatarImage src={user?.avatarUrl || ""} alt={user?.fullName || "Usuario"} />
          <AvatarFallback className="bg-sidebar-primary/20 text-sidebar-primary text-xs font-semibold">
            {user?.initials || "US"}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium text-sidebar-foreground">
            {user?.fullName || "Carregando..."}
          </p>
          <p className="truncate text-xs text-sidebar-foreground/50">
            {user?.email || ""}
          </p>
        </div>
        <div className="flex items-center gap-0.5">
          <ThemeToggle className="text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent" />
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={handleLogout}
          >
            <LogOut className="size-4" />
            <span className="sr-only">Sair</span>
          </Button>
        </div>
      </div>
    </div>
  )
}

function SidebarContent() {
  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-14 items-center px-4">
        <Image
          src="/logo.svg"
          alt="IVORY."
          width={100}
          height={28}
          className="invert"
          priority
        />
      </div>

      <Separator className="mb-2 bg-sidebar-border" />

      <SidebarNav />

      <SidebarUser />
    </div>
  )
}

export function Sidebar() {
  return (
    <aside className="hidden h-screen w-60 shrink-0 border-r border-sidebar-border bg-sidebar md:block">
      <SidebarContent />
    </aside>
  )
}

export function MobileSidebar() {
  const [open, setOpen] = React.useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon" className="md:hidden" />
        }
      >
        <Menu className="size-5" />
        <span className="sr-only">Abrir menu</span>
      </SheetTrigger>
      <SheetContent side="left" className="w-60 p-0 bg-sidebar" showCloseButton={false}>
        <SheetTitle className="sr-only">Menu de navegacao</SheetTitle>
        <SidebarContent />
      </SheetContent>
    </Sheet>
  )
}

