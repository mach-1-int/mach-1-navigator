"use client"

import { cn } from "@/lib/utils"
import { useRole, type ViewType } from "@/lib/role-context"
import { useDemoData } from "@/lib/demo-data-context"
import {
  LayoutDashboard,
  Users,
  Activity,
  Calendar,
  CalendarDays,
  FileText,
  Settings,
  LogOut,
  Heart,
  TrendingUp,
  AlertTriangle,
  UserCircle,
  Pill,
  ClipboardList,
  MessageSquare,
  Shield,
  DollarSign,
  History,
  UserPlus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const roleNavItems: Record<string, { name: string; view: ViewType; icon: typeof LayoutDashboard; showBadge?: boolean }[]> = {
  executive: [
    { name: "Overview", view: "dashboard", icon: LayoutDashboard },
    { name: "Revenue Cycle Manager", view: "revenue-cycle", icon: DollarSign },
    { name: "Revenue", view: "revenue", icon: TrendingUp },
    { name: "Performance", view: "performance", icon: Activity },
    { name: "Patients", view: "patients", icon: Users },
  ],
  supervisor: [
    { name: "Overview", view: "dashboard", icon: LayoutDashboard },
    { name: "Referrals", view: "referrals", icon: UserPlus },
    { name: "Navigators", view: "navigators", icon: Users },
    { name: "Team Schedule", view: "team-schedule", icon: CalendarDays },
    { name: "Compliance", view: "compliance", icon: ClipboardList },
    { name: "Adverse Events", view: "events", icon: AlertTriangle },
    { name: "Messages", view: "messages", icon: MessageSquare, showBadge: true },
  ],
  navigator: [
    { name: "Overview", view: "dashboard", icon: LayoutDashboard },
    { name: "My Patients", view: "patients", icon: Users },
    { name: "Schedule", view: "schedule", icon: Calendar },
    { name: "Notes", view: "notes", icon: FileText },
    { name: "Messages", view: "messages", icon: MessageSquare, showBadge: true },
  ],
  patient: [
    { name: "My Health", view: "dashboard", icon: Heart },
    { name: "Appointments", view: "appointments", icon: Calendar },
    { name: "Medications", view: "medications", icon: Pill },
    { name: "Messages", view: "messages", icon: MessageSquare, showBadge: true },
    { name: "My Profile", view: "profile", icon: UserCircle },
  ],
  admin: [
    { name: "Overview", view: "dashboard", icon: Shield },
    { name: "Revenue Cycle Manager", view: "revenue-cycle", icon: DollarSign },
    { name: "Payer Rates", view: "admin-payer-rates", icon: Settings },
    { name: "Audit Log", view: "admin-audit-log", icon: History },
  ],
}

export function DashboardSidebar() {
  const { currentUser, navigation, navigateTo, logout } = useRole()
  const { getUnreadCount } = useDemoData()

  if (!currentUser) return null

  const navItems = roleNavItems[currentUser.role]
  const unreadCount = getUnreadCount(currentUser.id)

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-sidebar">
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center border-b border-sidebar-border px-6">
          <button 
            type="button"
            onClick={() => navigateTo("dashboard")} 
            className="flex items-center gap-2"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Heart className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold text-sidebar-foreground">Gellert Health</span>
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {currentUser.role === "executive" && "Business Intelligence"}
            {currentUser.role === "supervisor" && "Clinical Oversight"}
            {currentUser.role === "navigator" && "Care Management"}
            {currentUser.role === "patient" && "My Care"}
            {currentUser.role === "admin" && "System Admin"}
          </p>
          {navItems.map((item) => {
            const isActive = navigation.view === item.view
            const showUnreadBadge = item.showBadge && unreadCount > 0
            return (
              <button
                type="button"
                key={item.name}
                onClick={() => navigateTo(item.view)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left",
                  isActive
                    ? "bg-sidebar-accent text-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                <span className="flex-1">{item.name}</span>
                {showUnreadBadge && (
                  <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Badge>
                )}
              </button>
            )
          })}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <div className="mb-3 flex items-center gap-3 px-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary">
              <UserCircle className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-sidebar-foreground">{currentUser.name}</p>
              <p className="truncate text-xs capitalize text-muted-foreground">{currentUser.role}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="flex-1 justify-start text-muted-foreground hover:text-sidebar-foreground">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
            <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground hover:text-destructive">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </aside>
  )
}
