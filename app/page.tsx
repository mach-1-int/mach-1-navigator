"use client"

import dynamic from "next/dynamic"
import { RoleProvider, useRole, type ViewType } from "@/lib/role-context"
import { DemoDataProvider } from "@/lib/demo-data-context"
import { RoleSelector } from "@/components/role-selector"
import { DashboardSidebar } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/header"
import { ExecutiveDashboard } from "@/components/dashboards/executive-dashboard"
import { SupervisorDashboard } from "@/components/dashboards/supervisor-dashboard"
import { NavigatorDashboard } from "@/components/dashboards/navigator-dashboard"
import { PatientDashboard } from "@/components/dashboards/patient-dashboard"
import { PatientProfile } from "@/components/patient-detail/patient-profile"
import { PatientAppointments } from "@/components/patient/patient-appointments"
import { PatientMedications } from "@/components/patient/patient-medications"
import { PatientProfile as PatientPortalProfile } from "@/components/patient/patient-profile"
import { NavigatorDirectory } from "@/components/supervisor/navigator-directory"
import { NavigatorDetailView } from "@/components/supervisor/navigator-detail-view"
import { ComplianceView } from "@/components/supervisor/compliance-view"
import { AdverseEventsView } from "@/components/supervisor/adverse-events-view"
import { NavigatorSchedule } from "@/components/navigator/navigator-schedule"
import { NavigatorPatients } from "@/components/navigator/navigator-patients"
import { ClinicalFeed } from "@/components/navigator/clinical-feed"
import { AssessmentWizard } from "@/components/navigator/assessment-wizard"
import { ReferralReviewView } from "@/components/supervisor/referral-review-view"
import { IntakeWorkspace } from "@/components/supervisor/intake-workspace"
import { JourneyBoard } from "@/components/supervisor/journey-board"
import { PerformanceView } from "@/components/executive/performance-view"
import { RevenueAnalyticsView } from "@/components/executive/revenue-analytics-view"
import { PatientInsightsView } from "@/components/executive/patient-insights-view"
import { ChatInterface } from "@/components/messaging/chat-interface"
import { AdminDashboard } from "@/components/dashboards/admin-dashboard"
import { SchedulingView } from "@/components/schedule/scheduling-view"
import { NavigatorSafetyMap } from "@/components/supervisor/navigator-safety-map"
import { TemplateEditorView } from "@/components/admin/template-editor-view"
import { TasksView } from "@/components/tasks/tasks-view"
import { WallboardView } from "@/components/wallboard/wallboard-view"
import { InDevelopment } from "@/components/in-development"
import { Toaster } from "@/components/ui/sonner"

// Claims Manager (billing/EDI/CSV export) is only reachable behind the biller
// dashboard or the admin/executive "revenue-cycle" view, so it's split into
// its own chunk instead of loading for every role up front.
const ClaimsManager = dynamic(
  () => import("@/components/billing/claims-manager").then((mod) => mod.ClaimsManager),
  {
    loading: () => (
      <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
        Loading revenue cycle manager…
      </div>
    ),
  },
)

// Define which views are implemented for each role
const implementedViews: Record<string, ViewType[]> = {
  executive: ["dashboard", "revenue-cycle", "revenue", "performance", "patients", "wallboard"],
  supervisor: ["dashboard", "safety-map", "referrals", "journey-board", "navigators", "navigator-detail", "team-schedule", "compliance", "events", "patient-detail", "messages", "intake-workspace", "wallboard"],
  navigator: ["dashboard", "patients", "patient-detail", "schedule", "notes", "messages", "assessment-wizard", "tasks"],
  patient: ["dashboard", "appointments", "medications", "profile", "messages"],
  admin: ["dashboard", "admin-payer-rates", "admin-audit-log", "revenue-cycle", "template-editor"],
  biller: ["dashboard"],
}

// View titles for the header
const viewTitles: Record<ViewType, { title: string; subtitle: string }> = {
  dashboard: { title: "", subtitle: "" }, // Will be overridden by role-specific titles
  "patient-detail": { title: "Patient Profile", subtitle: "Comprehensive patient information" },
  "navigator-detail": { title: "Navigator Profile", subtitle: "Performance and patient roster" },
  revenue: { title: "Revenue Analytics", subtitle: "Financial performance metrics" },
  performance: { title: "Performance Metrics", subtitle: "Team and organizational KPIs" },
  patients: { title: "Patient Management", subtitle: "View and manage your patients" },
  navigators: { title: "Navigator Directory", subtitle: "Team oversight and performance metrics" },
  compliance: { title: "Compliance Dashboard", subtitle: "Medication and PCP compliance tracking" },
  events: { title: "Adverse Events", subtitle: "Track and manage active adverse events" },
  schedule: { title: "My Schedule", subtitle: "Weekly appointments and calendar" },
  "team-schedule": { title: "Team Schedule", subtitle: "Navigator shifts and team calendar" },
  notes: { title: "Clinical Feed", subtitle: "Recent notes across all patients" },
  appointments: { title: "My Appointments", subtitle: "Upcoming and past visits" },
  medications: { title: "My Medications", subtitle: "Current prescriptions and refills" },
  profile: { title: "My Profile", subtitle: "Personal information and preferences" },
  settings: { title: "Settings", subtitle: "Application preferences" },
  messages: { title: "Messages", subtitle: "Communicate with your care team" },
  referrals: { title: "Referral CRM", subtitle: "Eligibility, outreach, and conversion — the full referral pipeline" },
  "journey-board": { title: "Journey Board", subtitle: "Every patient across the WorkFlow2025 phases" },
  "intake-workspace": { title: "Match & Assign", subtitle: "Ranked navigator matching by distance, language, and load" },
  "assessment-wizard": { title: "Risk Assessment", subtitle: "Initial home visit assessment" },
  "admin-payer-rates": { title: "Payer Rates", subtitle: "Configure revenue rates by payer" },
  "admin-audit-log": { title: "Audit Log", subtitle: "System activity and user actions" },
  "revenue-cycle": { title: "Revenue Cycle Manager", subtitle: "Claims validation and CSV export" },
  "safety-map": { title: "Navigator Safety Map", subtitle: "Real-time field team location tracking" },
  "template-editor": { title: "Note Templates", subtitle: "Create and edit note templates — fields, narrative, encounter mapping" },
  tasks: { title: "My Tasks", subtitle: "Confirmations, follow-ups, and response tasks" },
  wallboard: { title: "Wallboard", subtitle: "Daily KPI board — playbook §9.1" },
}

// Role-specific dashboard titles
const dashboardTitles: Record<string, { title: string; subtitle: string }> = {
  executive: { title: "Executive Dashboard", subtitle: "Business Intelligence Overview" },
  supervisor: { title: "Supervisor Dashboard", subtitle: "Clinical Oversight & Team Performance" },
  navigator: { title: "Navigator Dashboard", subtitle: "Patient Care Management" },
  patient: { title: "My Health Portal", subtitle: "Your personalized care dashboard" },
  admin: { title: "Admin Dashboard", subtitle: "System Governance & Configuration" },
  biller: { title: "Revenue Cycle Manager", subtitle: "Claims validation and CSV export" },
}

function DashboardContent() {
  const { currentUser, navigation } = useRole()

  if (!currentUser) {
    return <RoleSelector />
  }

  const isViewImplemented = implementedViews[currentUser.role]?.includes(navigation.view)
  
  // Get the appropriate title
  const getHeaderTitle = () => {
    if (navigation.view === "dashboard") {
      return dashboardTitles[currentUser.role]
    }
    return viewTitles[navigation.view]
  }

  const { title, subtitle } = getHeaderTitle()

  // Render the appropriate content
  const renderContent = () => {
    // Handle unimplemented views
    if (!isViewImplemented) {
      return <InDevelopment title={viewTitles[navigation.view]?.title || "This Feature"} />
    }

    // Handle dashboard views by role
    if (navigation.view === "dashboard") {
      switch (currentUser.role) {
        case "executive":
          return <ExecutiveDashboard />
        case "supervisor":
          return <SupervisorDashboard />
        case "navigator":
          return <NavigatorDashboard />
        case "patient":
          return <PatientDashboard />
        case "admin":
          return <AdminDashboard />
        case "biller":
          return <ClaimsManager />
      }
    }

    // Handle wallboard (supervisor + executive)
    if (navigation.view === "wallboard" && (currentUser.role === "supervisor" || currentUser.role === "executive")) {
      return <WallboardView />
    }

    // Handle admin-specific views
    if (currentUser.role === "admin") {
      if (navigation.view === "admin-payer-rates" || navigation.view === "admin-audit-log") {
        return <AdminDashboard />
      }
      if (navigation.view === "revenue-cycle") {
        return <ClaimsManager />
      }
      if (navigation.view === "template-editor") {
        return <TemplateEditorView />
      }
    }

    // Handle executive Revenue Cycle Manager (CFO demo)
    if (currentUser.role === "executive" && navigation.view === "revenue-cycle") {
      return <ClaimsManager />
    }

    // Handle executive analytics views (Gellert blitz - B-B fills these)
    if (currentUser.role === "executive") {
      if (navigation.view === "revenue") {
        return <RevenueAnalyticsView />
      }
      if (navigation.view === "performance") {
        return <PerformanceView />
      }
      if (navigation.view === "patients") {
        return <PatientInsightsView />
      }
    }

    // Handle patient detail view
    if (navigation.view === "patient-detail" && navigation.params?.patientId) {
      return <PatientProfile patientId={navigation.params.patientId} />
    }

    // Handle patients list for navigator (dedicated roster + quick-note view)
    if (navigation.view === "patients" && currentUser.role === "navigator") {
      return <NavigatorPatients />
    }

    // Handle navigator-specific views
    if (currentUser.role === "navigator") {
      if (navigation.view === "tasks") {
        return <TasksView />
      }
      if (navigation.view === "schedule") {
        return <NavigatorSchedule />
      }
      if (navigation.view === "notes") {
        return <ClinicalFeed />
      }
      if (navigation.view === "assessment-wizard" && navigation.params?.patientId) {
        return <AssessmentWizard patientId={navigation.params.patientId} />
      }
    }

    // Handle supervisor-specific views
    if (currentUser.role === "supervisor") {
      if (navigation.view === "safety-map") {
        return <NavigatorSafetyMap />
      }
      if (navigation.view === "referrals") {
        return <ReferralReviewView />
      }
      if (navigation.view === "journey-board") {
        return <JourneyBoard />
      }
      if (navigation.view === "navigators") {
        return <NavigatorDirectory />
      }
      if (navigation.view === "navigator-detail" && navigation.params?.navigatorId) {
        return <NavigatorDetailView navigatorId={navigation.params.navigatorId} />
      }
      if (navigation.view === "compliance") {
        return <ComplianceView />
      }
      if (navigation.view === "events") {
        return <AdverseEventsView />
      }
      if (navigation.view === "team-schedule") {
        return <SchedulingView supervisorId={currentUser.id} />
      }
      if (navigation.view === "intake-workspace" && navigation.params?.referralId) {
        return <IntakeWorkspace referralId={navigation.params.referralId} />
      }
    }

    // Handle patient-specific views
    if (currentUser.role === "patient") {
      if (navigation.view === "appointments") {
        return <PatientAppointments />
      }
      if (navigation.view === "medications") {
        return <PatientMedications />
      }
      if (navigation.view === "profile") {
        return <PatientPortalProfile />
      }
    }

    // Handle messages view (available for supervisor, navigator, patient)
    if (navigation.view === "messages") {
      return <ChatInterface />
    }

    // Fallback for unhandled cases
    return <InDevelopment title={viewTitles[navigation.view]?.title || "This Feature"} />
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar />
      <main className="pl-64">
        <DashboardHeader title={title} subtitle={subtitle} />
        <div className="p-6">
          {renderContent()}
        </div>
      </main>
    </div>
  )
}

export default function HomePage() {
  return (
    <RoleProvider>
      <DemoDataProvider>
        <DashboardContent />
        <Toaster richColors position="top-right" />
      </DemoDataProvider>
    </RoleProvider>
  )
}
