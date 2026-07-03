"use client"

import { createContext, useContext, useState, type ReactNode } from "react"
import type { UserRole, User } from "./types"
import { initialUsers as users } from "./initial-data"

export type ViewType =
  | "dashboard"
  | "patient-detail"
  | "navigator-detail"
  | "revenue"
  | "performance"
  | "patients"
  | "navigators"
  | "compliance"
  | "events"
  | "schedule"
  | "team-schedule"
  | "notes"
  | "appointments"
  | "medications"
  | "profile"
  | "settings"
  | "messages"
  | "referrals"
  | "referral-intake"
  | "intake-workspace"
  | "assessment-wizard"
  | "admin-payer-rates"
  | "admin-audit-log"
  | "revenue-cycle"
  | "safety-map"

interface NavigationState {
  view: ViewType
  params?: Record<string, string>
}

interface DraftMessage {
  recipientId: string
  content: string
}

interface RoleContextType {
  currentUser: User | null
  navigation: NavigationState
  demoPatientId: string | null
  draftMessage: DraftMessage | null
  setRole: (role: UserRole) => void
  loginAsUser: (userId: string) => void
  loginAsPatient: (patientId: string, patientName: string) => void
  logout: () => void
  navigateTo: (view: ViewType, params?: Record<string, string>) => void
  goBack: () => void
  setDraftMessage: (draft: DraftMessage | null) => void
}

const RoleContext = createContext<RoleContextType | undefined>(undefined)

export function RoleProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [navigation, setNavigation] = useState<NavigationState>({ view: "dashboard" })
  const [history, setHistory] = useState<NavigationState[]>([])
  const [demoPatientId, setDemoPatientId] = useState<string | null>(null)
  const [draftMessage, setDraftMessage] = useState<DraftMessage | null>(null)

  const setRole = (role: UserRole) => {
    const user = users.find((u) => u.role === role)
    if (user) {
      setCurrentUser(user)
      setNavigation({ view: "dashboard" })
      setHistory([])
      setDemoPatientId(null)
    }
  }

  const loginAsUser = (userId: string) => {
    const user = users.find((u) => u.id === userId)
    if (user) {
      setCurrentUser(user)
      setNavigation({ view: "dashboard" })
      setHistory([])
      setDemoPatientId(null)
    }
  }

  const loginAsPatient = (patientId: string, patientName: string) => {
    // Create a dynamic patient user for the demo
    const patientUser: User = {
      id: patientId,
      name: patientName,
      role: "patient",
      email: `${patientName.toLowerCase().replace(" ", ".")}@demo.com`
    }
    setCurrentUser(patientUser)
    setDemoPatientId(patientId)
    setNavigation({ view: "dashboard" })
    setHistory([])
  }

  const logout = () => {
    setCurrentUser(null)
    setNavigation({ view: "dashboard" })
    setHistory([])
    setDemoPatientId(null)
  }

  const navigateTo = (view: ViewType, params?: Record<string, string>) => {
    setHistory((prev) => [...prev, navigation])
    setNavigation({ view, params })
  }

  const goBack = () => {
    if (history.length > 0) {
      const previousState = history[history.length - 1]
      setHistory((prev) => prev.slice(0, -1))
      setNavigation(previousState)
    } else {
      setNavigation({ view: "dashboard" })
    }
  }

  return (
    <RoleContext.Provider value={{ currentUser, navigation, demoPatientId, draftMessage, setRole, loginAsUser, loginAsPatient, logout, navigateTo, goBack, setDraftMessage }}>
      {children}
    </RoleContext.Provider>
  )
}

export function useRole() {
  const context = useContext(RoleContext)
  if (context === undefined) {
    throw new Error("useRole must be used within a RoleProvider")
  }
  return context
}
