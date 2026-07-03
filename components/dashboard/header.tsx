"use client"

import { useState } from "react"
import { useRole } from "@/lib/role-context"
import { useDemoData } from "@/lib/demo-data-context"
import { Bell, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

// Roles whose sidebar includes a Messages view (see components/dashboard/sidebar.tsx)
const MESSAGING_ROLES = ["supervisor", "navigator", "patient"]

interface DashboardHeaderProps {
  title: string
  subtitle?: string
}

export function DashboardHeader({ title, subtitle }: DashboardHeaderProps) {
  const { currentUser, navigateTo } = useRole()
  const { patients, getUnreadCount } = useDemoData()
  const [query, setQuery] = useState("")
  const [searchFocused, setSearchFocused] = useState(false)

  if (!currentUser) return null

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  const hasMessaging = MESSAGING_ROLES.includes(currentUser.role)
  const canSearch = currentUser.role === "supervisor" || currentUser.role === "navigator"
  const unreadCount = hasMessaging ? getUnreadCount(currentUser.id) : 0

  // Navigators only search their own patients; supervisors search all
  const searchablePatients = currentUser.role === "navigator"
    ? patients.filter(p => p.assignedNavigator === currentUser.id)
    : patients
  const trimmedQuery = query.trim().toLowerCase()
  const results = trimmedQuery
    ? searchablePatients
        .filter(p =>
          p.name.toLowerCase().includes(trimmedQuery) ||
          p.chartNumber.toLowerCase().includes(trimmedQuery)
        )
        .slice(0, 8)
    : []

  const handleSelectPatient = (patientId: string) => {
    setQuery("")
    navigateTo("patient-detail", { patientId })
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center justify-between px-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle || today}</p>
        </div>

        <div className="flex items-center gap-4">
          {canSearch && (
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search patients..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                className="w-64 bg-secondary pl-9"
              />
              {searchFocused && trimmedQuery && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-border bg-popover shadow-md">
                  {results.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-muted-foreground">No patients found</p>
                  ) : (
                    results.map((patient) => (
                      <button
                        key={patient.id}
                        type="button"
                        onMouseDown={() => handleSelectPatient(patient.id)}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted"
                      >
                        <span className="truncate font-medium text-popover-foreground">{patient.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{patient.chartNumber}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {hasMessaging && (
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              onClick={() => navigateTo("messages")}
            >
              <Bell className="h-5 w-5 text-muted-foreground" />
              {unreadCount > 0 && (
                <Badge
                  className="absolute -right-1 -top-1 h-5 w-5 justify-center rounded-full p-0 text-xs"
                  variant="destructive"
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Badge>
              )}
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
