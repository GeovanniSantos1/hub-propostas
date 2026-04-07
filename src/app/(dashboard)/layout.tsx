import { Sidebar, MobileSidebar } from "@/components/sidebar"
import { SearchBar } from "@/components/search-bar"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-background/80 backdrop-blur-sm px-4 md:px-6">
          <MobileSidebar />
          <SearchBar />
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-background">
          {children}
        </main>
      </div>
    </div>
  )
}
