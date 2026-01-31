# HANDOVER_CONTEXT.md
# Mach 1 Care Navigator (Gellert Health) - Development Handover

---

## 1. Product Requirement Document (PRD)

### Elevator Pitch
A multi-role healthcare navigation platform that enables care coordinators (Navigators) to manage high-risk patients through home visits, medication tracking, and adverse event monitoring, while Supervisors oversee team performance and Executives track business KPIs.

### Core User Flows

**Supervisor Flow:**
1. Login as Supervisor > View team dashboard with compliance gauges and KPIs
2. Review New Referrals queue > Assign patient to Navigator > Patient becomes active in system
3. Navigate to Navigator Directory > Click Navigator row > View detailed performance and patient roster
4. Access Compliance drill-down > Identify at-risk patients > Send "Nudge" to Navigator
5. Monitor Adverse Events > Expand event cards > View care team and patient details

**Navigator Flow:**
1. Login as Navigator > View daily dashboard with appointments, alerts, and patient list
2. Click patient in "My Patients" > Add quick note > Save to patient record
3. View Profile > Access full patient detail with Timeline, Notes, and Care Team tabs
4. Navigate to Schedule > View weekly calendar > Add new appointments
5. Navigate to Clinical Feed > Review all notes across patients > Filter by type

**Patient Flow:**
1. Login as Patient (or continue as newly assigned patient) > View health portal
2. See care navigator contact, upcoming appointments, and medication list
3. Track enrollment duration and health metrics

**Executive Flow:**
1. Login as Executive > View revenue KPIs, patient census, and billing trends
2. Monitor daily billing units chart, revenue by health plan, and referral sources
3. See recent enrollment activity from demo flow

### Key Features

**Implemented:**
- Role-based authentication (4 roles: Executive, Supervisor, Navigator, Patient)
- Referral queue with assignment workflow (converts referrals to full patient records)
- Navigator Directory with drill-down to individual Navigator profiles
- Compliance Dashboard with Medication Risks and PCP Follow-up tracking
- Adverse Events master list with expandable detail cards
- "Nudge" feature for Supervisors to message Navigators about specific patients
- Weekly Scheduler with drag-and-drop appointment creation
- Clinical Feed showing all notes with search and filter
- Enhanced Patient List showing Last Contact and Next Visit columns
- Patient Profile with Overview, Timeline, Notes, and Care Team tabs
- AMD Source Indicators showing data provenance from Epic EHR
- Demo flow persistence (assigned patients appear in Navigator's roster and can be logged in as)

**Planned/Mocked:**
- Real authentication with session management
- Database persistence (currently using React Context with ephemeral state)
- Revenue, Performance, Appointments, Medications, Profile, and Settings views
- Message notification system for Navigators
- Calendar integration and recurring appointment scheduling
- Patient portal messaging to care team

---

## 2. Technical Specifications

### Tech Stack
- **Framework:** Next.js 16 (App Router)
- **UI Library:** Shadcn UI (Radix primitives)
- **Styling:** Tailwind CSS v4 with CSS custom properties
- **Icons:** Lucide React
- **Charts:** Recharts (via Shadcn chart components)
- **Typography:** Geist and Geist Mono (Google Fonts)
- **Analytics:** Vercel Analytics
- **Runtime:** Next.js "next-lite" (browser-based, no server required)

### Data Model

```
User
├── id: string
├── name: string
├── role: "executive" | "supervisor" | "navigator" | "patient"
└── email: string

Patient
├── id: string
├── name: string
├── dob: string
├── chartNumber: string
├── riskLevel: 1 | 2 | 3
├── survivalStatus: "active" | "inactive"
├── assignedNavigator: string (FK → Navigator.id)
├── assignedSupervisor: string (FK → Supervisor.id)
├── healthPlan: string
├── enrollmentDate: string
├── lastContactDate: string
├── medicationCompliance: Medication[]
└── adverseEvents: AdverseEvent[]

Navigator
├── id: string
├── name: string
├── supervisorId: string (FK → Supervisor.id)
├── monthlyUnits: number
├── mtdUnits: number
├── adverseEventCount: number
├── cancellations: number
├── medicationCompliance: number
├── pcpCompliance: number
├── highFivePercentage: number
├── engagementScore: number
├── lengthOfService: number (months)
└── patientCount: number

Referral (becomes Patient when assigned)
├── id: string
├── patientName: string
├── dob: string
├── referralSource: string
├── riskScore: 1 | 2 | 3
├── referralDate: string
├── diagnosis: string
├── healthPlan: string
├── status: "pending" | "assigned" | "rejected"
└── assignedNavigator?: string

AdverseEvent
├── id: string
├── patientId: string
├── type: "fall" | "infection" | "chronic_exacerbation" | "other"
├── diagnosis: string
├── status: "pending" | "completed" | "scheduled"

Appointment
├── id: string
├── patientId: string
├── navigatorId: string
├── date: string
├── time: string
├── type: "home_visit" | "phone_call" | "video_call" | "clinic"
├── status: "scheduled" | "completed" | "cancelled" | "no_show"
└── notes?: string

PatientNote
├── id: string
├── patientId: string
├── authorId: string
├── authorName: string
├── authorRole: UserRole
├── content: string
├── type: "clinical" | "follow-up" | "general" | "phone" | "visit"
└── createdAt: string (ISO timestamp)

SupervisorMessage (Nudges)
├── id: string
├── fromSupervisorId: string
├── fromSupervisorName: string
├── toNavigatorId: string
├── patientId: string
├── patientName: string
├── content: string
├── type: "nudge" | "instruction" | "alert"
├── createdAt: string
└── read: boolean
```

### State Management

**RoleContext (`/lib/role-context.tsx`):**
- Manages current user role and authentication state
- Handles navigation between views
- Tracks history for back button functionality
- Supports demo flow
- ViewType enum defines all possible views

**DemoDataContext (`/lib/demo-data-context.tsx`):**
- Wraps all mutable demo data (patients, notes, navigators, events, referrals, messages)
- Provides CRUD operations: addNote, assignReferral, sendNudge, etc.
- Tracks lastAssignedPatientId for demo flow continuity
- Includes reset function to restore initial state

**Data Flow:**
```
RoleProvider
└── DemoDataProvider
    └── DashboardContent
        ├── Sidebar (navigation)
        ├── Header (title, user info)
        └── View Components (consume context data)
```

---

## 3. Design System & Styling

### Color Palette

**Primary Colors:**
- Primary (Teal): `oklch(0.55 0.18 162)` - Main brand color for actions, links, accents
- Primary Foreground: `oklch(0.99 0 0)` - White text on primary

**Semantic Colors:**
- Destructive (Red): `oklch(0.55 0.22 25)` - Errors, high-risk indicators
- Warning (Amber): `oklch(0.75 0.18 80)` - Warnings, medium-risk indicators
- Success: Green - Positive states

**Chart Colors:**
- Chart-1: Teal (primary)
- Chart-2: Blue `oklch(0.55 0.18 250)`
- Chart-3: Amber `oklch(0.65 0.18 80)`
- Chart-4: Red `oklch(0.55 0.22 25)`
- Chart-5: Purple `oklch(0.6 0.15 300)`

**Neutrals:**
- Background: Near-white `oklch(0.99 0 0)`
- Card: Pure white
- Muted: Light gray `oklch(0.96 0.005 260)`
- Border: `oklch(0.91 0.005 260)`
- Foreground: Near-black `oklch(0.15 0.01 260)`

**Dark Mode:**
- Full dark mode support with inverted palette
- Sidebar: `oklch(0.11 0.01 260)`
- Cards: `oklch(0.17 0.01 260)`

### Component Library

**Shadcn Components Used:**
- Layout: Card, Separator, Tabs, ScrollArea
- Forms: Input, Textarea, Select, Button, Checkbox, Label
- Feedback: Badge, Progress, Toast, Alert
- Overlays: Dialog, Popover, Tooltip, Sheet
- Navigation: Sidebar (custom), Breadcrumb
- Data Display: Table, Avatar, Collapsible
- Charts: AreaChart, BarChart, PieChart (via Recharts)

**Custom Components:**
- `StatCard` - KPI display card with icon, value, trend
- `ComplianceGauge` - Circular progress for compliance %
- `AMDSourceIndicator` - Tooltip showing EHR data source
- `RoleSelector` - Login screen with role cards
- `InDevelopment` - Placeholder for unbuilt features

### Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│  Sidebar (fixed, w-64)  │  Main Content Area            │
│                         │                               │
│  ┌─────────────────┐   │  ┌─────────────────────────┐  │
│  │ Logo + Brand    │   │  │ Header (sticky)         │  │
│  ├─────────────────┤   │  │ Title + Subtitle + User │  │
│  │ Navigation      │   │  └─────────────────────────┘  │
│  │ - Overview      │   │  ┌─────────────────────────┐  │
│  │ - Patients      │   │  │ Content Area            │  │
│  │ - Schedule      │   │  │ Cards / Data Tables     │  │
│  │ - etc.          │   │  │                         │  │
│  └─────────────────┘   │  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Navigation Pattern:**
- Sidebar is always visible when logged in
- Logo click returns to dashboard
- Back button appears in detail views
- History stack enables proper back navigation

---

## 4. Implementation Status

### Completed (Fully Functional)

**Core Infrastructure:**
- [x] Role-based login/logout system
- [x] Navigation with history and back button support
- [x] Responsive sidebar with role-specific menu items
- [x] Header with dynamic titles and user info
- [x] Theme system with light/dark mode support
- [x] Demo data context with full CRUD operations

**Executive Role:**
- [x] Revenue KPIs (Total Revenue, Patient Census, Growth)
- [x] Daily Billing Units chart (Area chart)
- [x] Revenue by Health Plan (Bar chart)
- [x] Referral Sources breakdown (Pie chart)
- [x] Recent Enrollment Activity card (demo flow)

**Supervisor Role:**
- [x] Team stats cards (Size, Patients, Events, High-Risk)
- [x] Referral Queue with assignment dialog
- [x] Compliance gauges (Medication, PCP)
- [x] Navigator Scorecards table
- [x] Adverse Events panel
- [x] Navigator Directory with metrics table
- [x] Navigator Detail View (roster, compliance gaps, messages)
- [x] Compliance Drill-Down (Medication Risks, PCP Missed)
- [x] Adverse Events View with expandable cards
- [x] Nudge feature on patient profiles

**Navigator Role:**
- [x] Performance stats (MTD Units, Patients, Progress)
- [x] Upcoming Appointments list
- [x] Medication Alerts with AMD indicators
- [x] Enhanced Patient List (Last Contact, Next Visit columns)
- [x] Quick Notes panel with patient selection
- [x] Patient Profile (Overview, Timeline, Notes, Care Team tabs)
- [x] Weekly Scheduler with appointment creation
- [x] Clinical Feed with search and filter
- [x] New patient badge for recently assigned

**Patient Role:**
- [x] Welcome banner with personalized greeting
- [x] Health stats cards
- [x] Care Navigator contact card
- [x] Upcoming Appointments display
- [x] Medications list with AMD indicators
- [x] Dynamic login for demo flow patients

**Cross-Cutting Features:**
- [x] AMD Source Indicator tooltips on all medical data
- [x] Demo flow persistence (referral → patient → all roles)
- [x] Note persistence within session
- [x] Appointment creation within session

### In Progress / Mocked

**Using Mock Data:**
- Chart data is static (monthlyBillingData, performanceData, etc.)
- KPI calculations are hardcoded
- Some compliance percentages are mocked
- Navigator performance metrics are static

**Placeholder Pages (InDevelopment component):**
- Revenue Analytics (Executive)
- Performance Metrics (Executive)
- Settings (All roles)
- Profile (All roles)
- Appointments detail (Patient)
- Medications detail (Patient)

### Known Issues & Limitations

1. **Data Persistence:** All data resets on page refresh (ephemeral React Context state)
2. **No Real Authentication:** Role selection is for demo purposes only
3. **Sidebar Logo Navigation:** Confirmed working across all roles
4. **Chart Responsiveness:** Some charts may need width adjustments on smaller screens
5. **Calendar Navigation:** Week navigation is functional but dates are relative to demo date
6. **Message Notifications:** Nudges are saved but no notification badge on Navigator dashboard yet
7. **Appointment Conflicts:** No validation for double-booking time slots
8. **Mobile Responsiveness:** Sidebar is fixed at w-64, not optimized for mobile

---

## 5. File Structure

```
/
├── app/
│   ├── globals.css          # Tailwind + theme variables
│   ├── layout.tsx           # Root layout with fonts
│   └── page.tsx             # Main app entry point
│
├── components/
│   ├── dashboard/
│   │   ├── compliance-gauge.tsx
│   │   ├── header.tsx
│   │   ├── sidebar.tsx
│   │   └── stat-card.tsx
│   │
│   ├── dashboards/
│   │   ├── executive-dashboard.tsx
│   │   ├── navigator-dashboard.tsx
│   │   ├── patient-dashboard.tsx
│   │   ├── referral-queue.tsx
│   │   └── supervisor-dashboard.tsx
│   │
│   ├── navigator/
│   │   ├── clinical-feed.tsx
│   │   └── navigator-schedule.tsx
│   │
│   ├── patient-detail/
│   │   └── patient-profile.tsx
│   │
│   ├── supervisor/
│   │   ├── adverse-events-view.tsx
│   │   ├── compliance-view.tsx
│   │   ├── navigator-detail-view.tsx
│   │   └── navigator-directory.tsx
│   │
│   ├── ui/                   # Shadcn components
│   │
│   ├── amd-source-indicator.tsx
│   ├── in-development.tsx
│   ├── role-selector.tsx
│   └── theme-provider.tsx
│
├── lib/
│   ├── demo-data-context.tsx # Mutable demo state
│   ├── mock-data.ts          # Static mock data
│   ├── role-context.tsx      # Auth & navigation
│   ├── types.ts              # TypeScript interfaces
│   └── utils.ts              # Helper functions
│
└── public/                   # Static assets
```

---

## 6. Testing Checklist

Complete walkthrough scenario in the chat history, covering:
1. Supervisor: Referral assignment, Navigator Directory, Compliance, Adverse Events, Nudge
2. Navigator: Schedule, Clinical Feed, Patient List, Notes, Patient Profile
3. Patient: Demo flow login, portal views
4. Executive: Dashboard, enrollment activity
5. Cross-role persistence verification

---

## 7. Next Steps for Production

1. **Database Integration:** Replace DemoDataContext with Supabase/Neon
2. **Authentication:** Implement proper auth with Supabase Auth or custom JWT
3. **API Routes:** Create Next.js API routes for data operations
4. **Real-time Updates:** Add WebSocket or polling for live updates
5. **Mobile Optimization:** Make sidebar collapsible, add responsive breakpoints
6. **Notification System:** Implement push notifications for nudges
7. **Audit Logging:** Track all patient data access for HIPAA compliance
8. **Testing:** Add unit tests for context providers and integration tests for flows
