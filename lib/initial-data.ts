/**
 * Initial seed data for the Mach 1 Care Navigator demo.
 * This file contains all the mock data used to bootstrap the local store.
 */

import type {
  Patient,
  Navigator,
  Supervisor,
  AdverseEvent,
  PatientNote,
  Referral,
  ReferralRawData,
  OutreachAttempt,
  Appointment,
  User,
  Message,
  CareTemplate,
  CarePlan,
  Payer,
  RemarkCode,
  OrganizationSettings,
  AuditLog,
  NoteTemplate,
  // CMS Billing Types (Phase 2.1)
  CPTDefinition,
  ZCode,
  IntakeRecord,
  // Navigator Safety Map
  NavigatorLocation,
  // Gellert blitz (journey / notes / billing)
  JourneyEvent,
  Provider,
  StandingPatientFacts,
  ChargeSlip,
  Zone,
} from "./types"
import { gellertNoteTemplates } from "./gellert-templates"

// ============================================================================
// USERS
// ============================================================================

export const initialUsers: User[] = [
  { id: "exec1", name: "Dr. Sarah Chen", role: "executive", email: "sarah.chen@gellert.health", phone: "(602) 555-0101" },
  { id: "sup1", name: "Marcus Williams", role: "supervisor", email: "marcus.williams@gellert.health", phone: "(602) 555-0102" },
  { id: "pt1", name: "James Thompson", role: "patient", email: "james.t@email.com", phone: "(602) 555-0177" },
  { id: "pt-elena", name: "Elena Rodriguez", role: "patient", email: "elena.rodriguez@email.com", phone: "(623) 555-0189" }, // Patient Portal demo
  { id: "admin1", name: "Alex Rivera", role: "admin", email: "alex.rivera@gellert.health", phone: "(602) 555-0103" },
  { id: "biller1", name: "Revenue Cycle Manager", role: "biller", email: "billing@gellert.health", phone: "(602) 555-0104" },
  // Navigators - every navigator has a User row with matching-engine attributes.
  // IDs join 1:1 with initialNavigators; currentCaseload mirrors Navigator.patientCount.
  {
    id: "nav1",
    name: "Emily Rodriguez",
    role: "navigator",
    email: "emily.rodriguez@gellert.health",
    phone: "(602) 555-0111",
    attributes: {
      homeZipCode: "85008", // East Phoenix
      zoneId: "zone-tempe-scottsdale",
      homeLat: 33.4655,
      homeLng: -111.9963,
      serviceAreaRadius: 20,
      languages: ["en", "es"],
      currentCaseload: 45,
      maxCaseload: 50,
      acuityCapabilities: ["L1", "L2", "L3"], // Senior navigator (24 months)
    },
  },
  {
    id: "nav2",
    name: "David Chen",
    role: "navigator",
    email: "david.chen@gellert.health",
    phone: "(480) 555-0112",
    attributes: {
      homeZipCode: "85281", // Tempe
      zoneId: "zone-tempe-scottsdale",
      homeLat: 33.4255,
      homeLng: -111.94,
      serviceAreaRadius: 20,
      languages: ["en", "zh"],
      currentCaseload: 52,
      maxCaseload: 55,
      acuityCapabilities: ["L1", "L2", "L3"],
    },
  },
  {
    id: "nav3",
    name: "Maria Santos",
    role: "navigator",
    email: "maria.santos@gellert.health",
    phone: "(602) 555-0113",
    attributes: {
      homeZipCode: "85021", // North Phoenix
      zoneId: "zone-north-phoenix",
      homeLat: 33.5595,
      homeLng: -112.0937,
      serviceAreaRadius: 15,
      languages: ["en", "es"],
      currentCaseload: 38,
      maxCaseload: 50,
      acuityCapabilities: ["L1", "L2"],
    },
  },
  // Matching Engine Test Navigators
  {
    id: "nav-maria",
    name: "Maria Gonzalez",
    role: "navigator",
    email: "maria.gonzalez@gellert.health",
    phone: "(623) 555-0114",
    attributes: {
      homeZipCode: "85301", // Glendale - West Valley
      zoneId: "zone-west-valley",
      homeLat: 33.5387,
      homeLng: -112.1859,
      serviceAreaRadius: 15,
      languages: ["en", "es"],
      currentCaseload: 35,
      maxCaseload: 50,
      acuityCapabilities: ["L1", "L2"],
    },
  },
  {
    id: "nav-john",
    name: "John Mitchell",
    role: "navigator",
    email: "john.mitchell@gellert.health",
    phone: "(480) 555-0115",
    attributes: {
      homeZipCode: "85201", // Mesa - East Valley
      zoneId: "zone-east-valley",
      homeLat: 33.4152,
      homeLng: -111.8315,
      serviceAreaRadius: 20,
      languages: ["en"],
      currentCaseload: 48, // Almost full
      maxCaseload: 50,
      acuityCapabilities: ["L1", "L2"],
    },
  },
  {
    id: "nav-sarah",
    name: "Sarah Thompson",
    role: "navigator",
    email: "sarah.thompson@gellert.health",
    phone: "(602) 555-0116",
    attributes: {
      homeZipCode: "85001", // Central Phoenix
      zoneId: "zone-central-phoenix",
      homeLat: 33.4484,
      homeLng: -112.074,
      serviceAreaRadius: 25,
      languages: ["en"],
      currentCaseload: 10, // Low caseload, lots of availability
      maxCaseload: 50,
      acuityCapabilities: ["L1", "L2", "L3"], // Can handle high risk (L3)
    },
  },
  {
    id: "nav4",
    name: "John Park",
    role: "navigator",
    email: "john.park@gellert.health",
    phone: "(520) 555-0117",
    attributes: {
      homeZipCode: "85701", // Downtown Tucson
      homeLat: 32.2217,
      homeLng: -110.9265,
      serviceAreaRadius: 25,
      languages: ["en", "ko"],
      currentCaseload: 42,
      maxCaseload: 50,
      acuityCapabilities: ["L1", "L2"],
    },
  },
  {
    id: "nav5",
    name: "Lisa Brown",
    role: "navigator",
    email: "lisa.brown@gellert.health",
    phone: "(520) 555-0118",
    attributes: {
      homeZipCode: "85710", // East Tucson
      homeLat: 32.214,
      homeLng: -110.8253,
      serviceAreaRadius: 25,
      languages: ["en"],
      currentCaseload: 40,
      maxCaseload: 50,
      acuityCapabilities: ["L1", "L2"],
    },
  },
  {
    id: "nav6",
    name: "Michael Lee",
    role: "navigator",
    email: "michael.lee@gellert.health",
    phone: "(480) 555-0119",
    attributes: {
      homeZipCode: "85204", // Mesa
      zoneId: "zone-east-valley",
      homeLat: 33.3942,
      homeLng: -111.7893,
      serviceAreaRadius: 20,
      languages: ["en"],
      currentCaseload: 48,
      maxCaseload: 55,
      acuityCapabilities: ["L1", "L2", "L3"],
    },
  },
  {
    id: "nav7",
    name: "Sarah Johnson",
    role: "navigator",
    email: "sarah.johnson@gellert.health",
    phone: "(480) 555-0120",
    attributes: {
      homeZipCode: "85296", // Gilbert
      zoneId: "zone-east-valley",
      homeLat: 33.3103,
      homeLng: -111.7431,
      serviceAreaRadius: 15,
      languages: ["en"],
      currentCaseload: 35,
      maxCaseload: 50,
      acuityCapabilities: ["L1"],
    },
  },
  {
    id: "nav8",
    name: "Kevin Martinez",
    role: "navigator",
    email: "kevin.martinez@gellert.health",
    phone: "(480) 555-0121",
    attributes: {
      homeZipCode: "85044", // Ahwatukee
      zoneId: "zone-south-phoenix",
      homeLat: 33.3062,
      homeLng: -112.0119,
      serviceAreaRadius: 20,
      languages: ["en", "es"],
      currentCaseload: 41,
      maxCaseload: 50,
      acuityCapabilities: ["L1", "L2"],
    },
  },
]

// ============================================================================
// SUPERVISORS (team membership derived from Navigator.supervisorId)
// ============================================================================

export const initialSupervisors: Supervisor[] = [
  { id: "sup1", name: "Marcus Williams", region: "Phoenix Metro" },
  { id: "sup2", name: "Jennifer Adams", region: "Tucson" },
  { id: "sup3", name: "Robert Kim", region: "Mesa/Tempe" },
]

// ============================================================================
// NAVIGATORS
// ============================================================================

export const initialNavigators: Navigator[] = [
  { id: "nav1", name: "Emily Rodriguez", level: 3, supervisorId: "sup1", monthlyUnits: 285, mtdUnits: 142, adverseEventCount: 2, cancellations: 3, medicationCompliance: 96, pcpCompliance: 94, highFivePercentage: 92, engagementScore: 88, lengthOfService: 24, patientCount: 45 },
  { id: "nav2", name: "David Chen", level: 3, supervisorId: "sup1", monthlyUnits: 312, mtdUnits: 156, adverseEventCount: 1, cancellations: 1, medicationCompliance: 98, pcpCompliance: 97, highFivePercentage: 95, engagementScore: 91, lengthOfService: 36, patientCount: 52 },
  { id: "nav3", name: "Maria Santos", level: 1, supervisorId: "sup1", monthlyUnits: 198, mtdUnits: 99, adverseEventCount: 4, cancellations: 6, medicationCompliance: 89, pcpCompliance: 85, highFivePercentage: 78, engagementScore: 72, lengthOfService: 8, patientCount: 38 },
  // Matching-engine test navigators (Geography, Language, Load QA)
  { id: "nav-maria", name: "Maria Gonzalez", level: 1, supervisorId: "sup1", monthlyUnits: 198, mtdUnits: 99, adverseEventCount: 2, cancellations: 4, medicationCompliance: 90, pcpCompliance: 86, highFivePercentage: 80, engagementScore: 75, lengthOfService: 8, patientCount: 35 },
  { id: "nav-john", name: "John Mitchell", level: 2, supervisorId: "sup1", monthlyUnits: 260, mtdUnits: 130, adverseEventCount: 1, cancellations: 2, medicationCompliance: 94, pcpCompliance: 92, highFivePercentage: 86, engagementScore: 82, lengthOfService: 14, patientCount: 48 },
  { id: "nav-sarah", name: "Sarah Thompson", level: 1, supervisorId: "sup1", monthlyUnits: 120, mtdUnits: 60, adverseEventCount: 0, cancellations: 1, medicationCompliance: 96, pcpCompliance: 94, highFivePercentage: 90, engagementScore: 88, lengthOfService: 4, patientCount: 10 },
  { id: "nav4", name: "John Park", level: 2, supervisorId: "sup2", monthlyUnits: 267, mtdUnits: 133, adverseEventCount: 2, cancellations: 2, medicationCompliance: 94, pcpCompliance: 92, highFivePercentage: 88, engagementScore: 85, lengthOfService: 18, patientCount: 42 },
  { id: "nav5", name: "Lisa Brown", level: 2, supervisorId: "sup2", monthlyUnits: 245, mtdUnits: 122, adverseEventCount: 3, cancellations: 4, medicationCompliance: 91, pcpCompliance: 89, highFivePercentage: 84, engagementScore: 80, lengthOfService: 12, patientCount: 40 },
  { id: "nav6", name: "Michael Lee", level: 3, supervisorId: "sup3", monthlyUnits: 298, mtdUnits: 149, adverseEventCount: 1, cancellations: 2, medicationCompliance: 97, pcpCompliance: 95, highFivePercentage: 93, engagementScore: 89, lengthOfService: 30, patientCount: 48 },
  { id: "nav7", name: "Sarah Johnson", level: 1, supervisorId: "sup3", monthlyUnits: 178, mtdUnits: 89, adverseEventCount: 5, cancellations: 7, medicationCompliance: 86, pcpCompliance: 82, highFivePercentage: 74, engagementScore: 68, lengthOfService: 6, patientCount: 35 },
  { id: "nav8", name: "Kevin Martinez", level: 2, supervisorId: "sup3", monthlyUnits: 256, mtdUnits: 128, adverseEventCount: 2, cancellations: 3, medicationCompliance: 93, pcpCompliance: 91, highFivePercentage: 86, engagementScore: 82, lengthOfService: 15, patientCount: 41 },
]

// ============================================================================
// PATIENTS
// ============================================================================

export const initialPatients: Patient[] = [
  {
    id: "pt1", name: "James Thompson", dob: "1952-03-15", chartNumber: "GH-2024-001", riskLevel: 3, survivalStatus: "active",
    journeyPhase: "active", zoneId: "zone-central-phoenix",
    assignedNavigator: "nav1", assignedSupervisor: "sup1", healthPlan: "United Healthcare", enrollmentDate: "2024-06-01",
    lastContactDate: "2026-01-24", medicationCompliance: 85, pcpCompliance: true,
    providerIds: ["prov-pcp-smith", "prov-cardio-patel", "prov-lab-labcorp", "prov-pharm-walgreens"],
    upcomingAppointments: [{ id: "apt1", patientId: "pt1", navigatorId: "nav1", date: "2026-01-30", time: "10:00", type: "home_visit", status: "scheduled", encounterType: "medical_appointment" }],
    medications: [
      { id: "med1", name: "Metformin", dosage: "500mg", frequency: "Twice daily", nextRefillDate: "2026-02-01", compliance: true },
      { id: "med2", name: "Lisinopril", dosage: "10mg", frequency: "Once daily", nextRefillDate: "2026-01-30", compliance: false },
    ],
    adverseEvents: [],
    // Phoenix Metro area coordinates
    lat: 33.5186, lng: -112.0611, // Central Phoenix
    // CMS Billing Track (Phase 2.1)
    billingTrack: "PIN", // Principal Illness Navigation - complex medical management
    primaryDiagnosis: "Type 2 Diabetes with complications (E11.65)",
    icdCodes: ["E11.65", "I10", "E78.5"], // Diabetes, Hypertension, Hyperlipidemia
    payerId: "payer-uhc",
    memberId: "UHC10023845",
  },
  {
    id: "pt2", name: "Dorothy Martinez", dob: "1948-07-22", chartNumber: "GH-2024-002", riskLevel: 2, survivalStatus: "active",
    journeyPhase: "active", zoneId: "zone-west-valley",
    assignedNavigator: "nav1", assignedSupervisor: "sup1", healthPlan: "Mercy Care", enrollmentDate: "2024-08-15",
    lastContactDate: "2026-01-22", medicationCompliance: 92, pcpCompliance: true,
    providerIds: ["prov-pcp-okafor", "prov-cardio-patel", "prov-pharm-cvs"],
    upcomingAppointments: [{ id: "apt2", patientId: "pt2", navigatorId: "nav1", date: "2026-01-29", time: "14:00", type: "phone_call", status: "scheduled", encounterType: "phone_call" }],
    medications: [
      { id: "med3", name: "Atorvastatin", dosage: "20mg", frequency: "Once daily", nextRefillDate: "2026-02-10", compliance: true },
    ],
    adverseEvents: [],
    lat: 33.4942, lng: -112.1401, // West Phoenix
    // CMS Billing Track (Phase 2.1)
    billingTrack: "CHI", // Community Health Integration - SDOH focus
    primaryDiagnosis: "Congestive Heart Failure (I50.9)",
    icdCodes: ["I50.9", "I25.10", "Z96.1"], // CHF, CAD, Pacemaker
    payerId: "payer-mercy",
    memberId: "MC556677889",
  },
  {
    id: "pt3", name: "Robert Wilson", dob: "1945-11-08", chartNumber: "GH-2024-003", riskLevel: 3, survivalStatus: "active",
    journeyPhase: "active", zoneId: "zone-tempe-scottsdale",
    assignedNavigator: "nav2", assignedSupervisor: "sup1", healthPlan: "United Healthcare", enrollmentDate: "2024-05-20",
    lastContactDate: "2026-01-20", medicationCompliance: 78, pcpCompliance: false,
    providerIds: ["prov-pcp-smith", "prov-cardio-patel", "prov-lab-labcorp"],
    upcomingAppointments: [],
    medications: [
      { id: "med4", name: "Warfarin", dosage: "5mg", frequency: "Once daily", nextRefillDate: "2026-01-27", compliance: false },
      { id: "med5", name: "Metoprolol", dosage: "25mg", frequency: "Twice daily", nextRefillDate: "2026-02-05", compliance: true },
    ],
    adverseEvents: [],
    lat: 33.4255, lng: -111.9400, // Tempe
    billingTrack: "PIN", // Principal Illness Navigation - complex medical management
    primaryDiagnosis: "Atrial Fibrillation (I48.91)",
    icdCodes: ["I48.91", "I25.10", "Z79.01"], // AFib, CAD, Anticoagulant therapy
    payerId: "payer-uhc",
    memberId: "UHC10077234",
  },
  {
    id: "pt4", name: "Helen Garcia", dob: "1950-04-30", chartNumber: "GH-2024-004", riskLevel: 1, survivalStatus: "active",
    // Graduated to telenavigation; lastCheckInAt 35 days before anchor -> OVERDUE on load
    journeyPhase: "telenavigation", zoneId: "zone-tempe-scottsdale",
    telenavigation: { startedAt: "2025-12-24", cadenceDays: 30, lastCheckInAt: "2025-12-26" },
    assignedNavigator: "nav2", assignedSupervisor: "sup1", healthPlan: "Molina", enrollmentDate: "2024-09-01",
    lastContactDate: "2026-01-25", medicationCompliance: 98, pcpCompliance: true,
    providerIds: ["prov-pcp-okafor"],
    upcomingAppointments: [{ id: "apt3", patientId: "pt4", navigatorId: "nav2", date: "2026-02-01", time: "09:00", type: "video_call", status: "scheduled", encounterType: "phone_call" }],
    medications: [
      { id: "med6", name: "Amlodipine", dosage: "5mg", frequency: "Once daily", nextRefillDate: "2026-02-15", compliance: true },
    ],
    adverseEvents: [],
    lat: 33.5091, lng: -111.8987, // Scottsdale
    billingTrack: "CHI", // Community Health Integration - lower acuity
    primaryDiagnosis: "Essential Hypertension (I10)",
    icdCodes: ["I10", "E78.0"], // Hypertension, Pure hypercholesterolemia
    payerId: "payer-molina",
    memberId: "MOL44821067",
  },
  {
    id: "pt5", name: "Frank Anderson", dob: "1943-09-12", chartNumber: "GH-2024-005", riskLevel: 3, survivalStatus: "active",
    journeyPhase: "active", zoneId: "zone-east-valley",
    assignedNavigator: "nav3", assignedSupervisor: "sup1", healthPlan: "United Healthcare", enrollmentDate: "2024-04-10",
    lastContactDate: "2026-01-18", medicationCompliance: 72, pcpCompliance: false,
    providerIds: ["prov-pcp-okafor", "prov-psych-nguyen", "prov-pharm-walgreens"],
    upcomingAppointments: [],
    medications: [
      { id: "med7", name: "Insulin Glargine", dosage: "20 units", frequency: "Once daily", nextRefillDate: "2026-01-28", compliance: false },
      { id: "med8", name: "Gabapentin", dosage: "300mg", frequency: "Three times daily", nextRefillDate: "2026-02-03", compliance: true },
    ],
    adverseEvents: [],
    lat: 33.4152, lng: -111.8315, // Mesa
    billingTrack: "PIN", // Principal Illness Navigation - complex medical management
    securityRisk: "High", // Command Center: safety badge on calendar without clicking
    primaryDiagnosis: "Type 2 Diabetes with neuropathy (E11.42)",
    icdCodes: ["E11.42", "G62.9", "I10"], // Diabetes with neuropathy, Polyneuropathy, Hypertension
    payerId: "payer-uhc",
    memberId: "UHC10091456",
  },
  // Billing Bridge test patient: single 45-min note → Needs Attention (Test A); add 30+30 mins in app for Test B/C
  {
    id: "pt-billing",
    name: "Sam Underwood",
    dob: "1960-05-14",
    chartNumber: "GH-2026-BILL",
    riskLevel: 2,
    survivalStatus: "active",
    journeyPhase: "active",
    zoneId: "zone-east-valley",
    assignedNavigator: "nav-john",
    assignedSupervisor: "sup1",
    healthPlan: "Mercy Care",
    enrollmentDate: "2026-01-01",
    lastContactDate: "2026-01-20",
    medicationCompliance: 90,
    pcpCompliance: true,
    upcomingAppointments: [],
    medications: [],
    adverseEvents: [],
    primaryDiagnosis: "Type 2 diabetes (E11.9)",
    icdCodes: ["E11.9", "Z79.4"],
    billingTrack: "PIN",
    payerId: "payer-mercy",
    memberId: "MC998812345",
  },
  // Validation test patient: MISSING ICD codes → should appear in "Needs Attention"
  {
    id: "pt-validation-test",
    name: "Mary Jenkins",
    dob: "1955-03-22",
    chartNumber: "GH-2026-VAL",
    riskLevel: 2,
    survivalStatus: "active",
    journeyPhase: "active",
    zoneId: "zone-west-valley",
    assignedNavigator: "nav-maria",
    assignedSupervisor: "sup1",
    healthPlan: "United Healthcare",
    enrollmentDate: "2026-01-05",
    lastContactDate: "2026-01-25",
    medicationCompliance: 85,
    pcpCompliance: true,
    upcomingAppointments: [],
    medications: [],
    adverseEvents: [],
    // NOTE: Intentionally NO primaryDiagnosis and NO icdCodes to test validation
    billingTrack: "CHI",
    payerId: "payer-uhc",
    memberId: "UHC10055991",
  },
  // ============================================================================
  // PATIENT PORTAL DEMO: Elena Rodriguez
  // Converted from referral to active patient for Golden Thread demo
  // ============================================================================
  {
    id: "pt-elena",
    name: "Elena Rodriguez",
    dob: "1958-06-12",
    chartNumber: "GH-2026-ELENA",
    riskLevel: 2,
    survivalStatus: "active",
    journeyPhase: "active",
    zoneId: "zone-west-valley",
    assignedNavigator: "nav-maria", // Maria Gonzalez - Spanish-speaking navigator
    assignedSupervisor: "sup1",
    healthPlan: "Mercy Care",
    enrollmentDate: "2026-01-28",
    lastContactDate: "2026-01-30",
    medicationCompliance: 88,
    pcpCompliance: true,
    upcomingAppointments: [
      {
        id: "apt-elena-pharmacy",
        patientId: "pt-elena",
        navigatorId: "nav-maria",
        date: "2026-02-02", // Today/Tomorrow for demo
        time: "14:00",
        type: "clinic", // Using clinic type for pharmacy visit
        status: "scheduled",
        notes: "Pharmacy Pickup - CVS on Glendale Ave",
        encounterType: "medication_assistance"
      }
    ],
    medications: [
      { id: "med-elena-1", name: "Metformin", dosage: "500mg", frequency: "Twice daily", nextRefillDate: "2026-02-02", compliance: true },
      { id: "med-elena-2", name: "Gabapentin", dosage: "300mg", frequency: "Three times daily", nextRefillDate: "2026-02-10", compliance: true },
    ],
    adverseEvents: [],
    address: {
      street: "2145 W Glendale Ave",
      city: "Phoenix",
      state: "AZ",
      zip: "85303"
    },
    phone: "(623) 555-0189",
    email: "elena.rodriguez@email.com",
    lat: 33.5387,
    lng: -112.1859, // West Valley - Glendale
    billingTrack: "PIN",
    primaryDiagnosis: "Type 2 Diabetes with peripheral neuropathy (E11.42)",
    icdCodes: ["E11.42", "G63.2"], // Diabetes with neuropathy
    payerId: "payer-mercy",
    memberId: "MC789456123", // Matches referral IN1 member ID
  },
  // ============================================================================
  // JOURNEY ENGINE DEMO PATIENTS (Gellert WorkFlow2025)
  // CRITICAL: these three patients have NO time logs so verify:billing /
  // verify:claims seed integrity is untouched.
  // ============================================================================
  // Intake 1 scheduled in 2 days, checklist empty, PCP due-by countdown visible
  {
    id: "pt-journey-intake1",
    name: "Rosa Delgado",
    dob: "1954-02-09",
    chartNumber: "GH-2026-J001",
    riskLevel: 2,
    survivalStatus: "active",
    journeyPhase: "intake",
    zoneId: "zone-central-phoenix",
    assignedNavigator: "nav-sarah",
    assignedSupervisor: "sup1",
    healthPlan: "Mercy Care",
    enrollmentDate: "2026-01-28",
    lastContactDate: "2026-01-28",
    medicationCompliance: 0,
    pcpCompliance: false,
    upcomingAppointments: [
      { id: "apt-journey-intake1", patientId: "pt-journey-intake1", navigatorId: "nav-sarah", date: "2026-02-01", time: "10:00", type: "home_visit", status: "scheduled", notes: "Intake 1 — onboarding visit" },
    ],
    medications: [],
    adverseEvents: [],
    address: { street: "812 N 3rd Ave", city: "Phoenix", state: "AZ", zip: "85001" },
    phone: "(602) 555-0311",
    lat: 33.4531,
    lng: -112.0782,
    billingTrack: "CHI",
    primaryDiagnosis: "Essential Hypertension (I10)",
    icdCodes: ["I10"],
    referralSource: "St. Joseph's Hospital",
    payerId: "payer-mercy",
    memberId: "MC311244780",
  },
  // Intake 1 complete, Intake 2 scheduled with TWO no-shows already (live tension:
  // one more no-show triggers the 3-no-show MIA closure protocol)
  {
    id: "pt-journey-intake2",
    name: "Walter Briggs",
    dob: "1949-08-17",
    chartNumber: "GH-2026-J002",
    riskLevel: 2,
    survivalStatus: "active",
    journeyPhase: "intake",
    zoneId: "zone-north-phoenix",
    assignedNavigator: "nav3",
    assignedSupervisor: "sup1",
    healthPlan: "AHCCCS",
    enrollmentDate: "2026-01-15",
    lastContactDate: "2026-01-20",
    medicationCompliance: 0,
    pcpCompliance: false,
    upcomingAppointments: [
      { id: "apt-journey-intake2", patientId: "pt-journey-intake2", navigatorId: "nav3", date: "2026-02-02", time: "13:30", type: "home_visit", status: "scheduled", notes: "Intake 2 — survey + navigation contract (third scheduling attempt)" },
    ],
    medications: [],
    adverseEvents: [],
    address: { street: "9235 N 7th St", city: "Phoenix", state: "AZ", zip: "85021" },
    phone: "(602) 555-0322",
    lat: 33.5701,
    lng: -112.0653,
    billingTrack: "CHI",
    primaryDiagnosis: "COPD (J44.9)",
    icdCodes: ["J44.9", "F17.210"],
    referralSource: "St. Joseph's Hospital",
    payerId: "payer-ahcccs",
    memberId: "AHC220987465",
  },
  // Exited via the patient-initiated pathway with supervisor confirmation recorded
  {
    id: "pt-journey-exited",
    name: "Gloria Sandoval",
    dob: "1957-12-03",
    chartNumber: "GH-2026-J003",
    riskLevel: 1,
    survivalStatus: "inactive",
    journeyPhase: "exited",
    zoneId: "zone-south-phoenix",
    exit: {
      pathway: "patient_initiated",
      exitedAt: "2026-01-18T16:00:00Z",
      documentedBy: "nav8",
      supervisorConfirmedBy: "sup1",
      providerNotifiedAt: "2026-01-19T09:00:00Z",
      notes: "Patient stated she is relocating to Albuquerque to live with her daughter and no longer wishes to receive navigation services. Supervisor confirmed the patient-initiated exit per protocol; referring provider notified.",
    },
    assignedNavigator: "nav8",
    assignedSupervisor: "sup1",
    healthPlan: "Mercy Care",
    enrollmentDate: "2025-12-10",
    lastContactDate: "2026-01-18",
    medicationCompliance: 74,
    pcpCompliance: true,
    upcomingAppointments: [],
    medications: [],
    adverseEvents: [],
    address: { street: "4419 S 12th St", city: "Phoenix", state: "AZ", zip: "85044" },
    phone: "(602) 555-0333",
    lat: 33.3089,
    lng: -112.0154,
    billingTrack: "CHI",
    primaryDiagnosis: "Type 2 Diabetes (E11.9)",
    icdCodes: ["E11.9"],
    referralSource: "Mercy Care",
    payerId: "payer-mercy",
    memberId: "MC556711098",
  },
]

// ============================================================================
// APPOINTMENTS (Standalone collection - synced with patient.upcomingAppointments)
// ============================================================================

export const initialAppointments: Appointment[] = [
  { id: "apt1", patientId: "pt1", navigatorId: "nav1", date: "2026-01-30", time: "10:00", type: "home_visit", status: "scheduled", encounterType: "medical_appointment" },
  { id: "apt2", patientId: "pt2", navigatorId: "nav1", date: "2026-01-29", time: "14:00", type: "phone_call", status: "scheduled", encounterType: "phone_call" },
  { id: "apt3", patientId: "pt4", navigatorId: "nav2", date: "2026-02-01", time: "09:00", type: "video_call", status: "scheduled", encounterType: "phone_call" },
  // Elena's pharmacy pickup for Patient Portal demo
  { id: "apt-elena-pharmacy", patientId: "pt-elena", navigatorId: "nav-maria", date: "2026-02-02", time: "14:00", type: "clinic", status: "scheduled", notes: "Pharmacy Pickup - CVS on Glendale Ave", encounterType: "medication_assistance" },
  // Journey engine demo: intake visits for the two in-intake patients
  { id: "apt-journey-intake1", patientId: "pt-journey-intake1", navigatorId: "nav-sarah", date: "2026-02-01", time: "10:00", type: "home_visit", status: "scheduled", notes: "Intake 1 — onboarding visit" },
  { id: "apt-journey-intake2", patientId: "pt-journey-intake2", navigatorId: "nav3", date: "2026-02-02", time: "13:30", type: "home_visit", status: "scheduled", notes: "Intake 2 — survey + navigation contract (third scheduling attempt)" },
]

// ============================================================================
// ADVERSE EVENTS
// ============================================================================

export const initialAdverseEvents: AdverseEvent[] = [
  { id: "ae1", patientId: "pt3", type: "chronic_exacerbation", diagnosis: "COPD Exacerbation", startDate: "2026-01-15", status: "currently_inpatient", rightCareFlag: true, followUpStatus: "pending" },
  { id: "ae2", patientId: "pt5", type: "fall", diagnosis: "Fall at home - hip contusion", startDate: "2026-01-20", endDate: "2026-01-22", status: "ended", rightCareFlag: true, followUpStatus: "completed" },
  { id: "ae3", patientId: "pt1", type: "chronic_exacerbation", diagnosis: "Hyperglycemia", startDate: "2026-01-23", status: "monitoring", rightCareFlag: false, followUpStatus: "scheduled" },
  { id: "ae4", patientId: "pt2", type: "infection", diagnosis: "UTI", startDate: "2026-01-10", endDate: "2026-01-18", status: "ended", rightCareFlag: true, followUpStatus: "completed" },
]

// ============================================================================
// REFERRALS (Pending assignment) - With AMD Integration Raw Data
// ============================================================================

// Compact builders so the 20-referral pipeline seed stays readable.
// Plain data comes out; rebaseToToday deep-clones and shifts every date.
function refRawData(o: {
  name: string; dob: string; gender: "M" | "F"; street: string; city: string; zip: string
  phone: string; dx: string; icd: string[]; dxDate: string
  payerName: string; payerId: string; memberId: string
  physician: string; facility: string
}): ReferralRawData {
  return {
    PID: {
      patientName: o.name,
      dob: o.dob,
      gender: o.gender,
      address: { street: o.street, city: o.city, state: "AZ", zip: o.zip },
      phone: o.phone,
    },
    DG1: { primaryDiagnosis: o.dx, icdCodes: o.icd, diagnosisDate: o.dxDate },
    IN1: { payerName: o.payerName, payerId: o.payerId, memberId: o.memberId },
    PV1: { referringPhysician: o.physician, facilityName: o.facility },
  }
}

/** n outreach attempts spaced 2 days apart from startIso, last disposition wins */
function mkAttempts(
  refId: string,
  startIso: string,
  dispositions: OutreachAttempt["disposition"][],
  channels?: OutreachAttempt["channel"][]
): OutreachAttempt[] {
  return dispositions.map((disposition, i) => {
    const at = new Date(`${startIso}T10:00:00Z`)
    at.setUTCDate(at.getUTCDate() + i * 2)
    return {
      id: `${refId}-att-${i + 1}`,
      attemptNumber: i + 1,
      at: at.toISOString().replace(/\.\d{3}Z$/, "Z"),
      by: "sup1",
      byName: "Marcus Williams",
      channel: channels?.[i] ?? "phone",
      disposition,
    }
  })
}

const ELIGIBLE_CHECK = {
  insuranceVerified: true,
  inServiceArea: true,
  medicalNeedConfirmed: true,
  levelOfCareAppropriate: true,
  ageEligible: true,
  outcome: "eligible" as const,
}

export const initialReferrals: Referral[] = [
  // ==========================================================================
  // ACTIVE PIPELINE (every working state demoable on load)
  // ==========================================================================
  // CONVERTED - Elena Rodriguez (golden-thread history; patient pt-elena)
  {
    id: "ref-elena",
    receivedAt: "2026-01-28T09:00:00Z",
    source: "Banner Health",
    rawData: refRawData({
      name: "Elena Rodriguez", dob: "1958-06-12", gender: "F",
      street: "2145 W Glendale Ave", city: "Phoenix", zip: "85303",
      phone: "(623) 555-0189", dx: "Type 2 Diabetes with peripheral neuropathy",
      icd: ["E11.42", "G63.2"], dxDate: "2026-01-25",
      payerName: "Mercy Care", payerId: "MC-AZ", memberId: "MC789456123",
      physician: "Dr. Ana Martinez", facility: "Banner Estrella Medical Center",
    }),
    status: "converted",
    eligibility: { ...ELIGIBLE_CHECK, checkedAt: "2026-01-28T10:00:00Z", checkedBy: "sup1" },
    acceptedAt: "2026-01-28T10:30:00Z",
    outreachAttempts: mkAttempts("ref-elena", "2026-01-28", ["agreed"]),
    agreedAt: "2026-01-28T14:30:00Z",
    patientId: "pt-elena",
    patientName: "Elena Rodriguez",
    dob: "1958-06-12",
    referralSource: "Banner Health",
    riskScore: 2,
    referralDate: "2026-01-28",
    diagnosis: "Type 2 Diabetes with neuropathy",
    healthPlan: "Mercy Care",
    zipCode: "85303",
    language: "es",
    requiredAcuity: "L2",
  },
  // RECEIVED (fresh today) - Mike Smith, awaiting eligibility review
  {
    id: "ref-mike",
    receivedAt: "2026-01-30T08:10:00Z",
    source: "HonorHealth",
    rawData: refRawData({
      name: "Mike Smith", dob: "1962-09-23", gender: "M",
      street: "4567 E Main St", city: "Mesa", zip: "85201",
      phone: "(480) 555-0234", dx: "Essential Hypertension",
      icd: ["I10"], dxDate: "2026-01-26",
      payerName: "United Healthcare", payerId: "UHC-AZ", memberId: "UHC456789123",
      physician: "Dr. Robert Chen", facility: "HonorHealth Scottsdale",
    }),
    status: "received",
    outreachAttempts: [],
    patientName: "Mike Smith",
    dob: "1962-09-23",
    referralSource: "HonorHealth",
    riskScore: 1,
    referralDate: "2026-01-30",
    diagnosis: "Essential Hypertension",
    healthPlan: "United Healthcare",
    zipCode: "85201",
    language: "en",
    requiredAcuity: "L1",
  },
  // AGREED - David Jones (Match & Assign golden-thread entry, L3 -> Sarah)
  {
    id: "ref-david",
    receivedAt: "2026-01-28T11:45:00Z",
    source: "Valleywise Health",
    rawData: refRawData({
      name: "David Jones", dob: "1945-02-14", gender: "M",
      street: "789 N Central Ave", city: "Phoenix", zip: "85001",
      phone: "(602) 555-0345", dx: "End Stage Renal Disease on Hemodialysis with CHF",
      icd: ["N18.6", "I50.9", "Z99.2"], dxDate: "2026-01-20",
      payerName: "AHCCCS", payerId: "AHCCCS-AZ", memberId: "AHC987654321",
      physician: "Dr. James Park", facility: "Valleywise Medical Center",
    }),
    status: "agreed",
    eligibility: { ...ELIGIBLE_CHECK, checkedAt: "2026-01-28T13:00:00Z", checkedBy: "sup1" },
    acceptedAt: "2026-01-28T13:05:00Z",
    outreachAttempts: mkAttempts("ref-david", "2026-01-29", ["agreed"]),
    agreedAt: "2026-01-29T10:00:00Z",
    patientName: "David Jones",
    dob: "1945-02-14",
    referralSource: "Valleywise Health",
    riskScore: 3,
    referralDate: "2026-01-28",
    diagnosis: "ESRD on Dialysis, CHF",
    healthPlan: "AHCCCS",
    zipCode: "85001",
    language: "en",
    requiredAcuity: "L3",
  },
  // ACCEPTED + SLA BREACHED - William Anderson (accepted 3 days ago, no contact yet)
  {
    id: "ref1",
    receivedAt: "2026-01-25T14:32:00Z",
    source: "St. Joseph's Hospital",
    rawData: refRawData({
      name: "William Anderson", dob: "1948-03-15", gender: "M",
      street: "4521 W Camelback Rd", city: "Phoenix", zip: "85031",
      phone: "(602) 555-0147", dx: "Congestive Heart Failure with COPD and Type 2 Diabetes",
      icd: ["I50.9", "J44.9", "E11.9"], dxDate: "2026-01-20",
      payerName: "United Healthcare", payerId: "UHC-AZ", memberId: "UHC987654321",
      physician: "Dr. Sarah Kim", facility: "Dignity Health St. Joseph's",
    }),
    status: "accepted",
    eligibility: { ...ELIGIBLE_CHECK, checkedAt: "2026-01-27T09:00:00Z", checkedBy: "sup1" },
    acceptedAt: "2026-01-27T09:00:00Z", // 3 days before anchor -> 48h SLA BREACHED on load
    outreachAttempts: [],
    patientName: "William Anderson",
    dob: "1948-03-15",
    referralSource: "St. Joseph's Hospital",
    riskScore: 3,
    referralDate: "2026-01-25",
    diagnosis: "CHF, COPD, Type 2 Diabetes",
    healthPlan: "United Healthcare",
    zipCode: "85031",
    language: "en",
    requiredAcuity: "L3",
  },
  // RECEIVED (yesterday) - Patricia Moore
  {
    id: "ref2",
    receivedAt: "2026-01-29T16:45:00Z",
    source: "Banner Health",
    rawData: refRawData({
      name: "Patricia Moore", dob: "1955-08-22", gender: "F",
      street: "789 E Indian School Rd", city: "Scottsdale", zip: "85251",
      phone: "(480) 555-0198", dx: "Essential Hypertension with Chronic Kidney Disease Stage 3",
      icd: ["I10", "N18.3"], dxDate: "2026-01-22",
      payerName: "Mercy Care", payerId: "MC-AZ", memberId: "MC123456789",
      physician: "Dr. James Chen", facility: "Banner Desert Medical Center",
    }),
    status: "received",
    outreachAttempts: [],
    patientName: "Patricia Moore",
    dob: "1955-08-22",
    referralSource: "Banner Health",
    riskScore: 2,
    referralDate: "2026-01-29",
    diagnosis: "Hypertension, CKD Stage 3",
    healthPlan: "Mercy Care",
    zipCode: "85251",
    language: "en",
    requiredAcuity: "L2",
  },
  // OUTREACH IN PROGRESS - George Taylor (3 of 7 attempts logged)
  {
    id: "ref3",
    receivedAt: "2026-01-23T16:45:00Z",
    source: "Valleywise Health",
    rawData: refRawData({
      name: "George Taylor", dob: "1942-11-08", gender: "M",
      street: "2340 S 24th St", city: "Phoenix", zip: "85034",
      phone: "(602) 555-0234", dx: "End Stage Renal Disease on Hemodialysis with Coronary Artery Disease",
      icd: ["N18.6", "I25.10", "Z99.2"], dxDate: "2026-01-15",
      payerName: "AHCCCS", payerId: "AHCCCS-AZ", memberId: "AHC567891234",
      physician: "Dr. Lisa Wong", facility: "Valleywise Medical Center",
    }),
    status: "outreach",
    eligibility: { ...ELIGIBLE_CHECK, checkedAt: "2026-01-26T10:00:00Z", checkedBy: "sup1" },
    acceptedAt: "2026-01-26T10:00:00Z",
    outreachAttempts: mkAttempts("ref3", "2026-01-27", ["no_answer", "voicemail", "no_answer"], ["phone", "phone", "text"]),
    patientName: "George Taylor",
    dob: "1942-11-08",
    referralSource: "Valleywise Health",
    riskScore: 3,
    referralDate: "2026-01-23",
    diagnosis: "ESRD on Dialysis, CAD",
    healthPlan: "AHCCCS",
    zipCode: "85034",
    language: "en",
    requiredAcuity: "L3",
  },
  // INTAKE SCHEDULED - Teresa Nguyen (agreed; Intake 1 on the books)
  {
    id: "ref-sjh-intake-sched",
    receivedAt: "2026-01-24T09:20:00Z",
    source: "St. Joseph's Hospital",
    rawData: refRawData({
      name: "Teresa Nguyen", dob: "1959-04-11", gender: "F",
      street: "1730 W Thomas Rd", city: "Phoenix", zip: "85012",
      phone: "(602) 555-0402", dx: "Congestive Heart Failure",
      icd: ["I50.9"], dxDate: "2026-01-21",
      payerName: "Mercy Care", payerId: "MC-AZ", memberId: "MC445120993",
      physician: "Dr. Priya Raman", facility: "Dignity Health St. Joseph's",
    }),
    status: "intake_scheduled",
    eligibility: { ...ELIGIBLE_CHECK, checkedAt: "2026-01-25T09:00:00Z", checkedBy: "sup1" },
    acceptedAt: "2026-01-25T09:00:00Z",
    outreachAttempts: mkAttempts("ref-sjh-intake-sched", "2026-01-26", ["voicemail", "agreed"]),
    agreedAt: "2026-01-28T10:00:00Z",
    patientName: "Teresa Nguyen",
    dob: "1959-04-11",
    referralSource: "St. Joseph's Hospital",
    riskScore: 2,
    referralDate: "2026-01-24",
    diagnosis: "Congestive Heart Failure",
    healthPlan: "Mercy Care",
    zipCode: "85012",
    language: "en",
    requiredAcuity: "L2",
  },
  // ==========================================================================
  // HISTORICAL - CONVERTED (4 more; conversion = 5/20 = 25%)
  // ==========================================================================
  {
    id: "ref-sjh-conv1",
    receivedAt: "2025-12-26T10:15:00Z",
    source: "St. Joseph's Hospital",
    rawData: refRawData({
      name: "Sam Underwood", dob: "1960-05-14", gender: "M",
      street: "4567 E University Dr", city: "Mesa", zip: "85201",
      phone: "(480) 555-0451", dx: "Type 2 diabetes",
      icd: ["E11.9", "Z79.4"], dxDate: "2025-12-22",
      payerName: "Mercy Care", payerId: "MC-AZ", memberId: "MC998812345",
      physician: "Dr. Owen Blake", facility: "Dignity Health St. Joseph's",
    }),
    status: "converted",
    eligibility: { ...ELIGIBLE_CHECK, checkedAt: "2025-12-27T09:00:00Z", checkedBy: "sup1" },
    acceptedAt: "2025-12-27T09:00:00Z",
    outreachAttempts: mkAttempts("ref-sjh-conv1", "2025-12-28", ["voicemail", "agreed"]),
    agreedAt: "2025-12-30T11:00:00Z",
    patientId: "pt-billing",
    patientName: "Sam Underwood",
    dob: "1960-05-14",
    referralSource: "St. Joseph's Hospital",
    riskScore: 2,
    referralDate: "2025-12-26",
    diagnosis: "Type 2 diabetes",
    healthPlan: "Mercy Care",
    zipCode: "85201",
    language: "en",
    requiredAcuity: "L2",
  },
  {
    id: "ref-sjh-conv2",
    receivedAt: "2026-01-22T13:40:00Z",
    source: "St. Joseph's Hospital",
    rawData: refRawData({
      name: "Rosa Delgado", dob: "1954-02-09", gender: "F",
      street: "812 N 3rd Ave", city: "Phoenix", zip: "85001",
      phone: "(602) 555-0311", dx: "Essential Hypertension",
      icd: ["I10"], dxDate: "2026-01-19",
      payerName: "Mercy Care", payerId: "MC-AZ", memberId: "MC311244780",
      physician: "Dr. Sarah Kim", facility: "Dignity Health St. Joseph's",
    }),
    status: "converted",
    eligibility: { ...ELIGIBLE_CHECK, checkedAt: "2026-01-23T09:30:00Z", checkedBy: "sup1" },
    acceptedAt: "2026-01-23T09:30:00Z",
    outreachAttempts: mkAttempts("ref-sjh-conv2", "2026-01-24", ["no_answer", "agreed"]),
    agreedAt: "2026-01-26T10:00:00Z",
    patientId: "pt-journey-intake1",
    patientName: "Rosa Delgado",
    dob: "1954-02-09",
    referralSource: "St. Joseph's Hospital",
    riskScore: 2,
    referralDate: "2026-01-22",
    diagnosis: "Essential Hypertension",
    healthPlan: "Mercy Care",
    zipCode: "85001",
    language: "es",
    requiredAcuity: "L2",
  },
  {
    id: "ref-sjh-conv3",
    receivedAt: "2026-01-09T08:55:00Z",
    source: "St. Joseph's Hospital",
    rawData: refRawData({
      name: "Walter Briggs", dob: "1949-08-17", gender: "M",
      street: "9235 N 7th St", city: "Phoenix", zip: "85021",
      phone: "(602) 555-0322", dx: "COPD",
      icd: ["J44.9", "F17.210"], dxDate: "2026-01-06",
      payerName: "AHCCCS", payerId: "AHCCCS-AZ", memberId: "AHC220987465",
      physician: "Dr. Owen Blake", facility: "Dignity Health St. Joseph's",
    }),
    status: "converted",
    eligibility: { ...ELIGIBLE_CHECK, checkedAt: "2026-01-10T10:00:00Z", checkedBy: "sup1" },
    acceptedAt: "2026-01-10T10:00:00Z",
    outreachAttempts: mkAttempts("ref-sjh-conv3", "2026-01-11", ["voicemail", "agreed"]),
    agreedAt: "2026-01-13T15:00:00Z",
    patientId: "pt-journey-intake2",
    patientName: "Walter Briggs",
    dob: "1949-08-17",
    referralSource: "St. Joseph's Hospital",
    riskScore: 2,
    referralDate: "2026-01-09",
    diagnosis: "COPD",
    healthPlan: "AHCCCS",
    zipCode: "85021",
    language: "en",
    requiredAcuity: "L2",
  },
  {
    id: "ref-mercy-conv",
    receivedAt: "2025-12-05T11:25:00Z",
    source: "Mercy Care",
    rawData: refRawData({
      name: "Gloria Sandoval", dob: "1957-12-03", gender: "F",
      street: "4419 S 12th St", city: "Phoenix", zip: "85044",
      phone: "(602) 555-0333", dx: "Type 2 Diabetes",
      icd: ["E11.9"], dxDate: "2025-12-01",
      payerName: "Mercy Care", payerId: "MC-AZ", memberId: "MC556711098",
      physician: "Dr. Hannah Ortiz", facility: "Mercy Care Plan",
    }),
    status: "converted",
    eligibility: { ...ELIGIBLE_CHECK, checkedAt: "2025-12-06T09:00:00Z", checkedBy: "sup1" },
    acceptedAt: "2025-12-06T09:00:00Z",
    outreachAttempts: mkAttempts("ref-mercy-conv", "2025-12-07", ["agreed"]),
    agreedAt: "2025-12-07T10:00:00Z",
    patientId: "pt-journey-exited",
    patientName: "Gloria Sandoval",
    dob: "1957-12-03",
    referralSource: "Mercy Care",
    riskScore: 1,
    referralDate: "2025-12-05",
    diagnosis: "Type 2 Diabetes",
    healthPlan: "Mercy Care",
    zipCode: "85044",
    language: "en",
    requiredAcuity: "L1",
  },
  // ==========================================================================
  // HISTORICAL - INELIGIBLE (4 of the 5 documented reasons)
  // ==========================================================================
  {
    id: "ref-sjh-inelig",
    receivedAt: "2026-01-12T10:05:00Z",
    source: "St. Joseph's Hospital",
    rawData: refRawData({
      name: "Harold Finch", dob: "1951-07-30", gender: "M",
      street: "2201 W Bethany Home Rd", city: "Phoenix", zip: "85021",
      phone: "(602) 555-0361", dx: "Chronic Kidney Disease Stage 2",
      icd: ["N18.2"], dxDate: "2026-01-08",
      payerName: "Aetna PPO", payerId: "AETNA", memberId: "AET99120034",
      physician: "Dr. Sarah Kim", facility: "Dignity Health St. Joseph's",
    }),
    status: "ineligible",
    eligibility: {
      checkedAt: "2026-01-13T09:00:00Z", checkedBy: "sup1",
      insuranceVerified: false, inServiceArea: true, medicalNeedConfirmed: true,
      levelOfCareAppropriate: true, ageEligible: true,
      outcome: "ineligible", ineligibilityReason: "insurance",
      notes: "Commercial PPO not contracted; no Medicaid/Medicare coverage on file.",
    },
    outreachAttempts: [],
    closedAt: "2026-01-13T09:10:00Z",
    closeReason: "ineligible",
    providerNotifiedAt: "2026-01-13T09:30:00Z",
    patientName: "Harold Finch",
    dob: "1951-07-30",
    referralSource: "St. Joseph's Hospital",
    riskScore: 1,
    referralDate: "2026-01-12",
    diagnosis: "CKD Stage 2",
    healthPlan: "Aetna PPO",
    zipCode: "85021",
    language: "en",
    requiredAcuity: "L1",
  },
  {
    id: "ref-vw-inelig",
    receivedAt: "2026-01-06T14:50:00Z",
    source: "Valleywise Health",
    rawData: refRawData({
      name: "Doris Whitfield", dob: "1946-10-18", gender: "F",
      street: "355 N San Francisco St", city: "Flagstaff", zip: "86001",
      phone: "(928) 555-0142", dx: "Congestive Heart Failure",
      icd: ["I50.9"], dxDate: "2026-01-03",
      payerName: "AHCCCS", payerId: "AHCCCS-AZ", memberId: "AHC334561278",
      physician: "Dr. Lisa Wong", facility: "Valleywise Medical Center",
    }),
    status: "ineligible",
    eligibility: {
      checkedAt: "2026-01-07T09:00:00Z", checkedBy: "sup1",
      insuranceVerified: true, inServiceArea: false, medicalNeedConfirmed: true,
      levelOfCareAppropriate: true, ageEligible: true,
      outcome: "ineligible", ineligibilityReason: "out_of_service_area",
      notes: "Patient resides in Flagstaff — outside the Phoenix-metro service area.",
    },
    outreachAttempts: [],
    closedAt: "2026-01-07T09:15:00Z",
    closeReason: "ineligible",
    providerNotifiedAt: "2026-01-07T10:00:00Z",
    patientName: "Doris Whitfield",
    dob: "1946-10-18",
    referralSource: "Valleywise Health",
    riskScore: 2,
    referralDate: "2026-01-06",
    diagnosis: "Congestive Heart Failure",
    healthPlan: "AHCCCS",
    zipCode: "86001",
    language: "en",
    requiredAcuity: "L2",
  },
  {
    id: "ref-mercy-inelig",
    receivedAt: "2025-12-18T09:35:00Z",
    source: "Mercy Care",
    rawData: refRawData({
      name: "Kyle Beaumont", dob: "1971-03-27", gender: "M",
      street: "1509 E Osborn Rd", city: "Phoenix", zip: "85012",
      phone: "(602) 555-0374", dx: "Seasonal allergic rhinitis",
      icd: ["J30.2"], dxDate: "2025-12-15",
      payerName: "Mercy Care", payerId: "MC-AZ", memberId: "MC220419865",
      physician: "Dr. Hannah Ortiz", facility: "Mercy Care Plan",
    }),
    status: "ineligible",
    eligibility: {
      checkedAt: "2025-12-19T09:00:00Z", checkedBy: "sup1",
      insuranceVerified: true, inServiceArea: true, medicalNeedConfirmed: false,
      levelOfCareAppropriate: true, ageEligible: true,
      outcome: "ineligible", ineligibilityReason: "no_medical_need",
      notes: "No qualifying chronic condition or navigation need documented.",
    },
    outreachAttempts: [],
    closedAt: "2025-12-19T09:05:00Z",
    closeReason: "ineligible",
    providerNotifiedAt: "2025-12-19T09:45:00Z",
    patientName: "Kyle Beaumont",
    dob: "1971-03-27",
    referralSource: "Mercy Care",
    riskScore: 1,
    referralDate: "2025-12-18",
    diagnosis: "Seasonal allergic rhinitis",
    healthPlan: "Mercy Care",
    zipCode: "85012",
    language: "en",
    requiredAcuity: "L1",
  },
  {
    id: "ref-uhc-inelig",
    receivedAt: "2026-01-15T15:20:00Z",
    source: "United Healthcare",
    rawData: refRawData({
      name: "Marcus Tillman", dob: "1958-06-02", gender: "M",
      street: "740 E Broadway Rd", city: "Mesa", zip: "85204",
      phone: "(480) 555-0388", dx: "Schizoaffective disorder, acute inpatient level of care",
      icd: ["F25.9"], dxDate: "2026-01-10",
      payerName: "United Healthcare", payerId: "UHC-AZ", memberId: "UHC10088452",
      physician: "Dr. Neil Vaswani", facility: "UHC Care Coordination",
    }),
    status: "ineligible",
    eligibility: {
      checkedAt: "2026-01-16T09:00:00Z", checkedBy: "sup1",
      insuranceVerified: true, inServiceArea: true, medicalNeedConfirmed: true,
      levelOfCareAppropriate: false, ageEligible: true,
      outcome: "ineligible", ineligibilityReason: "level_of_care",
      notes: "Requires acute inpatient behavioral health — above community-navigation level of care.",
    },
    outreachAttempts: [],
    closedAt: "2026-01-16T09:10:00Z",
    closeReason: "ineligible",
    providerNotifiedAt: "2026-01-16T09:40:00Z",
    patientName: "Marcus Tillman",
    dob: "1958-06-02",
    referralSource: "United Healthcare",
    riskScore: 3,
    referralDate: "2026-01-15",
    diagnosis: "Schizoaffective disorder",
    healthPlan: "United Healthcare",
    zipCode: "85204",
    language: "en",
    requiredAcuity: "L3",
  },
  // ==========================================================================
  // HISTORICAL - UNREACHABLE (exactly 7 attempts each; provider informed)
  // ==========================================================================
  {
    id: "ref-sjh-unreach",
    receivedAt: "2025-12-15T10:45:00Z",
    source: "St. Joseph's Hospital",
    rawData: refRawData({
      name: "Angela Torres", dob: "1963-01-22", gender: "F",
      street: "3018 W McDowell Rd", city: "Phoenix", zip: "85031",
      phone: "(602) 555-0395", dx: "Type 2 Diabetes with CKD",
      icd: ["E11.22", "N18.3"], dxDate: "2025-12-10",
      payerName: "Mercy Care", payerId: "MC-AZ", memberId: "MC661200457",
      physician: "Dr. Sarah Kim", facility: "Dignity Health St. Joseph's",
    }),
    status: "unreachable",
    eligibility: { ...ELIGIBLE_CHECK, checkedAt: "2025-12-16T09:00:00Z", checkedBy: "sup1" },
    acceptedAt: "2025-12-16T09:00:00Z",
    outreachAttempts: mkAttempts(
      "ref-sjh-unreach", "2025-12-17",
      ["no_answer", "voicemail", "no_answer", "wrong_number", "voicemail", "no_answer", "no_answer"],
      ["phone", "phone", "text", "phone", "phone", "text", "in_person"]
    ),
    closedAt: "2025-12-30T09:00:00Z",
    closeReason: "unreachable",
    providerNotifiedAt: "2025-12-30T10:00:00Z",
    patientName: "Angela Torres",
    dob: "1963-01-22",
    referralSource: "St. Joseph's Hospital",
    riskScore: 2,
    referralDate: "2025-12-15",
    diagnosis: "Type 2 Diabetes with CKD",
    healthPlan: "Mercy Care",
    zipCode: "85031",
    language: "es",
    requiredAcuity: "L2",
  },
  {
    id: "ref-vw-unreach",
    receivedAt: "2026-01-02T09:15:00Z",
    source: "Valleywise Health",
    rawData: refRawData({
      name: "Dennis Kowalski", dob: "1950-09-05", gender: "M",
      street: "6210 S Central Ave", city: "Phoenix", zip: "85339",
      phone: "(602) 555-0407", dx: "COPD with recent exacerbation",
      icd: ["J44.1"], dxDate: "2025-12-29",
      payerName: "AHCCCS", payerId: "AHCCCS-AZ", memberId: "AHC778102934",
      physician: "Dr. Lisa Wong", facility: "Valleywise Medical Center",
    }),
    status: "unreachable",
    eligibility: { ...ELIGIBLE_CHECK, checkedAt: "2026-01-03T09:00:00Z", checkedBy: "sup1" },
    acceptedAt: "2026-01-03T09:00:00Z",
    outreachAttempts: mkAttempts(
      "ref-vw-unreach", "2026-01-04",
      ["no_answer", "no_answer", "voicemail", "no_answer", "voicemail", "no_answer", "no_answer"],
      ["phone", "text", "phone", "phone", "phone", "text", "phone"]
    ),
    closedAt: "2026-01-16T09:00:00Z",
    closeReason: "unreachable",
    providerNotifiedAt: "2026-01-16T09:30:00Z",
    patientName: "Dennis Kowalski",
    dob: "1950-09-05",
    referralSource: "Valleywise Health",
    riskScore: 2,
    referralDate: "2026-01-02",
    diagnosis: "COPD with recent exacerbation",
    healthPlan: "AHCCCS",
    zipCode: "85339",
    language: "en",
    requiredAcuity: "L2",
  },
  {
    id: "ref-mercy-unreach",
    receivedAt: "2025-12-08T13:05:00Z",
    source: "Mercy Care",
    rawData: refRawData({
      name: "Yolanda Reyes", dob: "1966-05-19", gender: "F",
      street: "8402 N 61st Ave", city: "Glendale", zip: "85301",
      phone: "(623) 555-0418", dx: "Uncontrolled hypertension",
      icd: ["I10"], dxDate: "2025-12-04",
      payerName: "Mercy Care", payerId: "MC-AZ", memberId: "MC190087236",
      physician: "Dr. Hannah Ortiz", facility: "Mercy Care Plan",
    }),
    status: "unreachable",
    eligibility: { ...ELIGIBLE_CHECK, checkedAt: "2025-12-09T09:00:00Z", checkedBy: "sup1" },
    acceptedAt: "2025-12-09T09:00:00Z",
    outreachAttempts: mkAttempts(
      "ref-mercy-unreach", "2025-12-10",
      ["no_answer", "voicemail", "wrong_number", "no_answer", "no_answer", "voicemail", "no_answer"],
      ["phone", "phone", "phone", "text", "phone", "phone", "in_person"]
    ),
    closedAt: "2025-12-22T09:00:00Z",
    closeReason: "unreachable",
    providerNotifiedAt: "2025-12-22T10:15:00Z",
    patientName: "Yolanda Reyes",
    dob: "1966-05-19",
    referralSource: "Mercy Care",
    riskScore: 1,
    referralDate: "2025-12-08",
    diagnosis: "Uncontrolled hypertension",
    healthPlan: "Mercy Care",
    zipCode: "85301",
    language: "es",
    requiredAcuity: "L1",
  },
  // ==========================================================================
  // HISTORICAL - DECLINED (2)
  // ==========================================================================
  {
    id: "ref-sjh-decl",
    receivedAt: "2026-01-05T11:30:00Z",
    source: "St. Joseph's Hospital",
    rawData: refRawData({
      name: "Raymond Holt", dob: "1953-11-14", gender: "M",
      street: "5045 N 19th Ave", city: "Phoenix", zip: "85021",
      phone: "(602) 555-0429", dx: "Coronary artery disease",
      icd: ["I25.10"], dxDate: "2026-01-02",
      payerName: "United Healthcare", payerId: "UHC-AZ", memberId: "UHC10066120",
      physician: "Dr. Owen Blake", facility: "Dignity Health St. Joseph's",
    }),
    status: "declined",
    eligibility: { ...ELIGIBLE_CHECK, checkedAt: "2026-01-06T09:00:00Z", checkedBy: "sup1" },
    acceptedAt: "2026-01-06T09:00:00Z",
    outreachAttempts: mkAttempts("ref-sjh-decl", "2026-01-07", ["callback_requested", "declined"]),
    closedAt: "2026-01-09T10:00:00Z",
    closeReason: "declined",
    providerNotifiedAt: "2026-01-09T10:30:00Z",
    patientName: "Raymond Holt",
    dob: "1953-11-14",
    referralSource: "St. Joseph's Hospital",
    riskScore: 2,
    referralDate: "2026-01-05",
    diagnosis: "Coronary artery disease",
    healthPlan: "United Healthcare",
    zipCode: "85021",
    language: "en",
    requiredAcuity: "L2",
  },
  {
    id: "ref-uhc-decl",
    receivedAt: "2025-12-18T16:10:00Z",
    source: "United Healthcare",
    rawData: refRawData({
      name: "Beverly Chandler", dob: "1949-02-28", gender: "F",
      street: "1120 E Southern Ave", city: "Tempe", zip: "85281",
      phone: "(480) 555-0436", dx: "Osteoarthritis with mobility limitation",
      icd: ["M19.90"], dxDate: "2025-12-12",
      payerName: "United Healthcare", payerId: "UHC-AZ", memberId: "UHC10071583",
      physician: "Dr. Neil Vaswani", facility: "UHC Care Coordination",
    }),
    status: "declined",
    eligibility: { ...ELIGIBLE_CHECK, checkedAt: "2025-12-19T10:00:00Z", checkedBy: "sup1" },
    acceptedAt: "2025-12-19T10:00:00Z",
    outreachAttempts: mkAttempts("ref-uhc-decl", "2025-12-20", ["no_answer", "voicemail", "declined"]),
    closedAt: "2025-12-24T11:00:00Z",
    closeReason: "declined",
    providerNotifiedAt: "2025-12-24T11:30:00Z",
    patientName: "Beverly Chandler",
    dob: "1949-02-28",
    referralSource: "United Healthcare",
    riskScore: 1,
    referralDate: "2025-12-18",
    diagnosis: "Osteoarthritis",
    healthPlan: "United Healthcare",
    zipCode: "85281",
    language: "en",
    requiredAcuity: "L1",
  },
]

// ============================================================================
// PATIENT NOTES
// ============================================================================

export const initialNotes: PatientNote[] = [
  {
    id: "note1",
    patientId: "pt1",
    authorId: "nav1",
    authorName: "Emily Rodriguez",
    authorRole: "navigator",
    content: "Patient reports feeling better after medication adjustment. Blood sugar levels stabilizing. Will continue monitoring.",
    type: "clinical",
    createdAt: "2026-01-24T14:30:00Z"
  },
  {
    id: "note2",
    patientId: "pt1",
    authorId: "nav1",
    authorName: "Emily Rodriguez",
    authorRole: "navigator",
    content: "Called to confirm home visit appointment for 1/28. Patient confirmed availability.",
    type: "phone",
    createdAt: "2026-01-23T10:15:00Z"
  },
  {
    id: "note3",
    patientId: "pt2",
    authorId: "nav1",
    authorName: "Emily Rodriguez",
    authorRole: "navigator",
    content: "UTI follow-up complete. Patient reports no recurring symptoms. Encouraged hydration.",
    type: "follow-up",
    createdAt: "2026-01-22T16:00:00Z"
  },
  {
    id: "note4",
    patientId: "pt3",
    authorId: "nav2",
    authorName: "David Chen",
    authorRole: "navigator",
    content: "Patient admitted to Banner Desert. COPD exacerbation. Family notified. Will visit tomorrow.",
    type: "clinical",
    createdAt: "2026-01-15T09:00:00Z"
  },
  // ==========================================================================
  // GELLERT MANUAL-FORMAT NOTES (templateId + responses + manual-perfect
  // content: third person, H:MMAM/PM times, closing presence + day total).
  // No TimeLogs are seeded for these — billing seed integrity is untouched.
  // ==========================================================================
  // pt1 James Thompson — PCP visit with transit (the repeat-visit recall source)
  {
    id: "note-g-pt1-pcp1",
    patientId: "pt1",
    authorId: "nav1",
    authorName: "Emily Rodriguez",
    authorRole: "navigator",
    type: "visit",
    createdAt: "2026-01-05T18:20:00Z",
    templateId: "template-gellert-medical",
    templateName: "Medical Appointment ± Transit",
    duration: 50,
    carriesDayTotal: true,
    responses: {
      "transport-provided": true,
      "pickup-time": "9:40AM",
      "pickup-location": "Patient's home",
      "arrival-time": "10:05AM",
      "office-provider": "prov-pcp-smith",
      "provider-guidance": "Continue metformin 500mg twice daily with meals, check fasting blood sugar each morning, and log the readings for review at the next visit.",
      "patient-response": "asked how to handle a missed dose, stated, \"I check my sugar before breakfast every day now,\" and repeated the medication instructions back correctly.",
      "follow-up-date": "January 16",
      "follow-up-time": "10:00AM",
      "follow-up-address": "4045 W Main St, Phoenix, AZ 85004",
      "with-patient-until": "11:15AM",
      "duration": 50,
    },
    content:
      "Navigator provided transport, picking the patient up at 9:40AM from Patient's home. Navigator and patient arrived at the office at 10:05AM. Patient was seen by Dr. Jane Smith, MD at Desert Family Medicine, 4045 W Main St, Phoenix, AZ 85004. The provider advised: Continue metformin 500mg twice daily with meals, check fasting blood sugar each morning, and log the readings for review at the next visit. Patient asked how to handle a missed dose, stated, \"I check my sugar before breakfast every day now,\" and repeated the medication instructions back correctly. A follow-up appointment was scheduled for January 16 at 10:00AM at 4045 W Main St, Phoenix, AZ 85004. Navigator was with the patient until 11:15AM. Total = 50 minutes.",
  },
  // pt1 — multidisciplinary day, PRIMARY note (transit + carries the day total)
  {
    id: "note-g-pt1-pcp2",
    patientId: "pt1",
    authorId: "nav1",
    authorName: "Emily Rodriguez",
    authorRole: "navigator",
    type: "visit",
    createdAt: "2026-01-16T19:05:00Z",
    templateId: "template-gellert-medical",
    templateName: "Medical Appointment ± Transit",
    duration: 110,
    carriesDayTotal: true,
    responses: {
      "transport-provided": true,
      "pickup-time": "9:35AM",
      "pickup-location": "Patient's home",
      "arrival-time": "10:00AM",
      "office-provider": "prov-pcp-smith",
      "provider-guidance": "Blood pressure readings are improving; continue lisinopril each morning, reduce dietary sodium, and repeat fasting labs before the next visit.",
      "patient-response": "told Dr. Smith, \"I've been walking to the mailbox every day like you asked,\" asked about the swelling in his ankles, and confirmed the plan for repeat labs.",
      "follow-up-date": "February 13",
      "follow-up-time": "9:30AM",
      "follow-up-address": "4045 W Main St, Phoenix, AZ 85004",
      "with-patient-until": "2:45PM",
      "duration": 110,
    },
    content:
      "Navigator provided transport, picking the patient up at 9:35AM from Patient's home. Navigator and patient arrived at the office at 10:00AM. Patient was seen by Dr. Jane Smith, MD at Desert Family Medicine, 4045 W Main St, Phoenix, AZ 85004. The provider advised: Blood pressure readings are improving; continue lisinopril each morning, reduce dietary sodium, and repeat fasting labs before the next visit. Patient told Dr. Smith, \"I've been walking to the mailbox every day like you asked,\" asked about the swelling in his ankles, and confirmed the plan for repeat labs. A follow-up appointment was scheduled for February 13 at 9:30AM at 4045 W Main St, Phoenix, AZ 85004. Navigator was with the patient until 2:45PM. Total = 110 minutes.",
  },
  // pt1 — multidisciplinary day, CONTINUATION (linked, non-billable, no transit)
  {
    id: "note-g-pt1-multi",
    patientId: "pt1",
    authorId: "nav1",
    authorName: "Emily Rodriguez",
    authorRole: "navigator",
    type: "visit",
    createdAt: "2026-01-16T21:30:00Z",
    templateId: "template-gellert-multidisciplinary",
    templateName: "Multidisciplinary Continuation",
    linkedNoteId: "note-g-pt1-pcp2",
    billable: false,
    responses: {
      "arrival-time": "1:15PM",
      "office-provider": "prov-cardio-patel",
      "provider-guidance": "Echocardiogram results were stable; continue current medications and return in six months.",
      "patient-response": "asked whether his palpitations were related to his blood sugar and stated, \"That puts my mind at ease.\"",
      "follow-up-date": "July 17",
      "with-patient-until": "2:45PM",
    },
    content:
      "Navigator and patient arrived at the appointment at 1:15PM. Patient was seen by Dr. Anita Patel, MD at Heart & Vascular Institute of Arizona, 1331 N 7th St, Suite 375, Phoenix, AZ 85006. The provider advised: Echocardiogram results were stable; continue current medications and return in six months. Patient asked whether his palpitations were related to his blood sugar and stated, \"That puts my mind at ease.\" A follow-up appointment was scheduled for July 17. Navigator was with the patient until 2:45PM.",
  },
  // pt1 — phone call (the colonoscopy-due thread from standing facts)
  {
    id: "note-g-pt1-phone",
    patientId: "pt1",
    authorId: "nav1",
    authorName: "Emily Rodriguez",
    authorRole: "navigator",
    type: "phone",
    createdAt: "2026-01-24T17:15:00Z",
    templateId: "template-gellert-phone",
    templateName: "Phone Call",
    duration: 10,
    carriesDayTotal: true,
    responses: {
      "call-time": "10:15AM",
      "spoke-with": "patient",
      "call-purpose": "to confirm the home visit scheduled for January 30 and review his morning glucose log",
      "patient-statements": "confirmed he will be home at 10:00AM on January 30 and stated, \"My sugar was 118 this morning.\"",
      "plan": "Navigator will complete the home visit on January 30 and bring the colonoscopy scheduling information discussed with Dr. Smith.",
      "call-end-time": "10:25AM",
      "duration": 10,
    },
    content:
      "Navigator placed a phone call at 10:15AM and spoke with the patient. The purpose of the call was to confirm the home visit scheduled for January 30 and review his morning glucose log. Patient confirmed he will be home at 10:00AM on January 30 and stated, \"My sugar was 118 this morning.\" Plan: Navigator will complete the home visit on January 30 and bring the colonoscopy scheduling information discussed with Dr. Smith. The call ended at 10:25AM. Total = 10 minutes.",
  },
  // pt2 Dorothy Martinez — SDOH / resource navigation
  {
    id: "note-g-pt2-sdoh",
    patientId: "pt2",
    authorId: "nav1",
    authorName: "Emily Rodriguez",
    authorRole: "navigator",
    type: "visit",
    createdAt: "2026-01-16T20:00:00Z",
    templateId: "template-gellert-sdoh",
    templateName: "SDOH / Resource Navigation",
    duration: 35,
    carriesDayTotal: true,
    responses: {
      "arrival-time": "11:30AM",
      "need-category": "Food security",
      "resource-connected": "St. Mary's Food Bank weekly home-delivery program; Navigator dialed the intake line and the patient completed the enrollment questions herself.",
      "unite-us-referral": "Submitted",
      "patient-response": "answered every intake question, chose the Thursday delivery window, and stated, \"This takes a real worry off my plate.\"",
      "with-patient-until": "12:05PM",
      "duration": 35,
    },
    content:
      "Navigator met with the patient at 11:30AM. Navigator assisted the patient with a Food security need. Resource connected: St. Mary's Food Bank weekly home-delivery program; Navigator dialed the intake line and the patient completed the enrollment questions herself. Unite Us referral: Submitted. Patient answered every intake question, chose the Thursday delivery window, and stated, \"This takes a real worry off my plate.\" Navigator was with the patient until 12:05PM. Total = 35 minutes.",
  },
  // pt2 — medication assistance with the verbatim no-touch attestation
  {
    id: "note-g-pt2-med-assist",
    patientId: "pt2",
    authorId: "nav1",
    authorName: "Emily Rodriguez",
    authorRole: "navigator",
    type: "visit",
    createdAt: "2026-01-19T22:10:00Z",
    templateId: "template-gellert-med-assist",
    templateName: "Medication Assistance",
    duration: 40,
    carriesDayTotal: true,
    responses: {
      "arrival-time": "3:00PM",
      "pillbox-activity": "Patient filled all seven compartments of her weekly pillbox with atorvastatin while Navigator read each label aloud and gave verbal direction only; she double-checked each compartment when finished.",
      "no-touch-attestation": true,
      "pharmacy": "prov-pharm-cvs",
      "patient-response": "filled every compartment herself, called CVS to request her atorvastatin refill, and stated, \"This is so much easier when we do it together.\"",
      "with-patient-until": "3:40PM",
      "duration": 40,
    },
    content:
      "Navigator arrived at the patient's home at 3:00PM. Patient filled all seven compartments of her weekly pillbox with atorvastatin while Navigator read each label aloud and gave verbal direction only; she double-checked each compartment when finished. Patient refilled medication containers independently with verbal direction only; Navigator never touched the medications. Refills were coordinated with CVS Pharmacy at CVS #08842, 5940 W Glendale Ave, Glendale, AZ 85301. Patient filled every compartment herself, called CVS to request her atorvastatin refill, and stated, \"This is so much easier when we do it together.\" Navigator was with the patient until 3:40PM. Total = 40 minutes.",
  },
  // pt3 Robert Wilson — cardiology appointment, no transit
  {
    id: "note-g-pt3-cardio",
    patientId: "pt3",
    authorId: "nav2",
    authorName: "David Chen",
    authorRole: "navigator",
    type: "visit",
    createdAt: "2026-01-15T21:00:00Z",
    templateId: "template-gellert-medical",
    templateName: "Medical Appointment ± Transit",
    duration: 45,
    carriesDayTotal: true,
    responses: {
      "transport-provided": false,
      "arrival-time": "1:30PM",
      "office-provider": "prov-cardio-patel",
      "provider-guidance": "INR was in range; continue warfarin 5mg daily, keep vitamin K intake consistent, and return for a recheck in four weeks.",
      "patient-response": "confirmed his pill routine, asked whether he could restart his evening walks, and stated, \"I feel steadier than I did last month.\"",
      "follow-up-date": "February 12",
      "follow-up-time": "1:30PM",
      "follow-up-address": "1331 N 7th St, Suite 375, Phoenix, AZ 85006",
      "with-patient-until": "2:15PM",
      "duration": 45,
    },
    content:
      "Navigator and patient arrived at the office at 1:30PM. Patient was seen by Dr. Anita Patel, MD at Heart & Vascular Institute of Arizona, 1331 N 7th St, Suite 375, Phoenix, AZ 85006. The provider advised: INR was in range; continue warfarin 5mg daily, keep vitamin K intake consistent, and return for a recheck in four weeks. Patient confirmed his pill routine, asked whether he could restart his evening walks, and stated, \"I feel steadier than I did last month.\" A follow-up appointment was scheduled for February 12 at 1:30PM at 1331 N 7th St, Suite 375, Phoenix, AZ 85006. Navigator was with the patient until 2:15PM. Total = 45 minutes.",
  },
  // pt3 — lab draw with transit
  {
    id: "note-g-pt3-lab",
    patientId: "pt3",
    authorId: "nav2",
    authorName: "David Chen",
    authorRole: "navigator",
    type: "visit",
    createdAt: "2026-01-27T16:30:00Z",
    templateId: "template-gellert-lab",
    templateName: "Lab / Imaging",
    duration: 30,
    carriesDayTotal: true,
    responses: {
      "transport-provided": true,
      "pickup-time": "7:50AM",
      "pickup-location": "Patient's home",
      "arrival-time": "8:15AM",
      "facility": "prov-lab-labcorp",
      "orders-completed": "INR draw and complete metabolic panel collected as ordered by Dr. Patel.",
      "results-follow-up": "Dr. Patel's office will call the patient with results within two business days; Navigator will confirm at the February 12 appointment",
      "patient-response": "checked in at the front desk himself, presented his insurance card, and stated, \"That was quicker than I expected.\"",
      "with-patient-until": "8:45AM",
      "duration": 30,
    },
    content:
      "Navigator provided transport, picking the patient up at 7:50AM from Patient's home. Navigator and patient arrived at the facility at 8:15AM. Services were completed at LabCorp Patient Service Center at LabCorp — Phoenix Central, 1300 N 12th St, Suite 300, Phoenix, AZ 85006. Orders completed: INR draw and complete metabolic panel collected as ordered by Dr. Patel. Results follow-up: Dr. Patel's office will call the patient with results within two business days; Navigator will confirm at the February 12 appointment. Patient checked in at the front desk himself, presented his insurance card, and stated, \"That was quicker than I expected.\" Navigator was with the patient until 8:45AM. Total = 30 minutes.",
  },
  // pt3 — supervision note (authored by the supervisor, never billed)
  {
    id: "note-g-pt3-supervision",
    patientId: "pt3",
    authorId: "sup1",
    authorName: "Marcus Williams",
    authorRole: "supervisor",
    type: "supervision",
    createdAt: "2026-01-24T23:00:00Z",
    templateId: "template-gellert-supervision",
    templateName: "Supervision Note",
    billable: false,
    subjectNavigatorId: "nav2",
    responses: {
      "navigator-discussed": "David Chen",
      "concerns": "Patient's warfarin adherence dipped after the January INR scare; navigator flagged missed evening doses and transportation strain for morning lab draws.",
      "directives": "Supervisor directed the navigator to schedule INR draws with transport support, complete a medication-barriers assessment at the next visit, and escalate any missed dose immediately.",
      "follow-up-date": "next 1:1 on February 7",
    },
    content:
      "Supervisor discussed this patient's care with Navigator David Chen. Concerns discussed: Patient's warfarin adherence dipped after the January INR scare; navigator flagged missed evening doses and transportation strain for morning lab draws. Directives given: Supervisor directed the navigator to schedule INR draws with transport support, complete a medication-barriers assessment at the next visit, and escalate any missed dose immediately. Supervision follow-up scheduled for next 1:1 on February 7.",
  },
  // pt5 Frank Anderson — behavioral health with transit + SI/HI/AH/VH screen
  {
    id: "note-g-pt5-bh",
    patientId: "pt5",
    authorId: "nav3",
    authorName: "Maria Santos",
    authorRole: "navigator",
    type: "visit",
    createdAt: "2026-01-21T21:30:00Z",
    templateId: "template-gellert-bh",
    templateName: "Behavioral Health ± Transit",
    duration: 65,
    carriesDayTotal: true,
    responses: {
      "transport-provided": true,
      "pickup-time": "12:35PM",
      "pickup-location": "Patient's home",
      "arrival-time": "1:05PM",
      "bh-provider": "prov-psych-nguyen",
      "safety-screen": [
        "Suicidal ideation (SI)",
        "Homicidal ideation (HI)",
        "Auditory hallucinations (AH)",
        "Visual hallucinations (VH)",
      ],
      "med-changes": "Dr. Nguyen increased sertraline from 50mg to 100mg daily and reviewed side effects to watch for during the first two weeks.",
      "patient-response": "asked whether the higher dose would make him drowsy, agreed to the change, and stated, \"I finally feel like someone is listening to me.\"",
      "follow-up-date": "February 18",
      "with-patient-until": "2:10PM",
      "duration": 65,
    },
    content:
      "Navigator provided transport, picking the patient up at 12:35PM from Patient's home. Navigator and patient arrived at the office at 1:05PM. Patient was seen by Dr. Robert Nguyen, MD at Copper Sky Behavioral Health, 2222 E Thomas Rd, Phoenix, AZ 85016. Patient denied: Suicidal ideation (SI), Homicidal ideation (HI), Auditory hallucinations (AH), Visual hallucinations (VH). Medication changes discussed: Dr. Nguyen increased sertraline from 50mg to 100mg daily and reviewed side effects to watch for during the first two weeks. Patient asked whether the higher dose would make him drowsy, agreed to the change, and stated, \"I finally feel like someone is listening to me.\" A follow-up appointment was scheduled for February 18. Navigator was with the patient until 2:10PM. Total = 65 minutes.",
  },
  // pt5 — supervision note (high-risk patient, zero-tolerance reminder)
  {
    id: "note-g-pt5-supervision",
    patientId: "pt5",
    authorId: "sup1",
    authorName: "Marcus Williams",
    authorRole: "supervisor",
    type: "supervision",
    createdAt: "2026-01-28T22:30:00Z",
    templateId: "template-gellert-supervision",
    templateName: "Supervision Note",
    billable: false,
    subjectNavigatorId: "nav3",
    responses: {
      "navigator-discussed": "Maria Santos",
      "concerns": "High-risk patient with a High security flag; navigator reported rising tension from the patient during the January 21 transport and two recent missed insulin refills.",
      "directives": "Supervisor directed the navigator to complete safety check-ins before each home visit, document any incident with the patient's exact words per the zero-tolerance policy, and coordinate an insulin refill with the pharmacy this week.",
      "follow-up-date": "next 1:1 on February 4",
    },
    content:
      "Supervisor discussed this patient's care with Navigator Maria Santos. Concerns discussed: High-risk patient with a High security flag; navigator reported rising tension from the patient during the January 21 transport and two recent missed insulin refills. Directives given: Supervisor directed the navigator to complete safety check-ins before each home visit, document any incident with the patient's exact words per the zero-tolerance policy, and coordinate an insulin refill with the pharmacy this week. Supervision follow-up scheduled for next 1:1 on February 4.",
  },
]

// ============================================================================
// CARE TEMPLATES (Phase 3)
// ============================================================================

export const initialCareTemplates: CareTemplate[] = [
  {
    id: "chf-pathway",
    name: "Post-Discharge Heart Failure",
    description: "Comprehensive care pathway for patients discharged with heart failure",
    condition: "CHF",
    goals: [
      {
        id: "chf-weight",
        description: "Daily weight monitoring",
        targetValue: 180,
        metricUnit: "lbs",
        direction: "below",
        warningThreshold: 185,
        frequency: "daily",
      },
      {
        id: "chf-bp-systolic",
        description: "Systolic blood pressure control",
        targetValue: 130,
        metricUnit: "mmHg",
        direction: "below",
        warningThreshold: 140,
        frequency: "daily",
      },
      {
        id: "chf-sodium",
        description: "Daily sodium intake",
        targetValue: 2000,
        metricUnit: "mg",
        direction: "below",
        warningThreshold: 2500,
        frequency: "daily",
      },
      {
        id: "chf-fluid",
        description: "Daily fluid intake",
        targetValue: 64,
        metricUnit: "oz",
        direction: "below",
        warningThreshold: 72,
        frequency: "daily",
      },
    ],
    tasks: [
      { id: "chf-task-1", description: "Check weight first thing in morning", frequency: "daily", category: "vitals" },
      { id: "chf-task-2", description: "Take all heart medications as prescribed", frequency: "daily", category: "medication" },
      { id: "chf-task-3", description: "Check for swelling in ankles and feet", frequency: "daily", category: "vitals" },
      { id: "chf-task-4", description: "30 minutes of light walking", frequency: "daily", category: "activity" },
      { id: "chf-task-5", description: "Review heart failure education materials", frequency: "weekly", category: "education" },
    ],
  },
  {
    id: "copd-pathway",
    name: "COPD Management",
    description: "Ongoing management pathway for chronic obstructive pulmonary disease",
    condition: "COPD",
    goals: [
      {
        id: "copd-o2sat",
        description: "Oxygen saturation level",
        targetValue: 92,
        metricUnit: "%",
        direction: "above",
        warningThreshold: 90,
        frequency: "daily",
      },
      {
        id: "copd-peak-flow",
        description: "Peak flow reading",
        targetValue: 350,
        metricUnit: "L/min",
        direction: "above",
        warningThreshold: 300,
        frequency: "daily",
      },
      {
        id: "copd-symptoms",
        description: "Symptom severity score (CAT)",
        targetValue: 10,
        metricUnit: "pts",
        direction: "below",
        warningThreshold: 20,
        frequency: "weekly",
      },
    ],
    tasks: [
      { id: "copd-task-1", description: "Use pulse oximeter to check O2 saturation", frequency: "daily", category: "vitals" },
      { id: "copd-task-2", description: "Use rescue inhaler as needed (log uses)", frequency: "as_needed", category: "medication" },
      { id: "copd-task-3", description: "Perform pursed lip breathing exercises", frequency: "daily", category: "activity" },
      { id: "copd-task-4", description: "Complete daily peak flow measurement", frequency: "daily", category: "vitals" },
      { id: "copd-task-5", description: "Avoid smoke and air pollutants", frequency: "daily", category: "education" },
    ],
  },
  {
    id: "diabetes-pathway",
    name: "Type 2 Diabetes Control",
    description: "Blood sugar management pathway for Type 2 diabetic patients",
    condition: "Diabetes",
    goals: [
      {
        id: "dm-fasting-glucose",
        description: "Fasting blood glucose",
        targetValue: 130,
        metricUnit: "mg/dL",
        direction: "below",
        warningThreshold: 150,
        frequency: "daily",
      },
      {
        id: "dm-a1c",
        description: "HbA1c level",
        targetValue: 7.0,
        metricUnit: "%",
        direction: "below",
        warningThreshold: 8.0,
        frequency: "monthly",
      },
      {
        id: "dm-weight",
        description: "Weight management",
        targetValue: 200,
        metricUnit: "lbs",
        direction: "below",
        warningThreshold: 210,
        frequency: "weekly",
      },
      {
        id: "dm-steps",
        description: "Daily steps",
        targetValue: 5000,
        metricUnit: "steps",
        direction: "above",
        warningThreshold: 3000,
        frequency: "daily",
      },
    ],
    tasks: [
      { id: "dm-task-1", description: "Check fasting blood sugar each morning", frequency: "daily", category: "vitals" },
      { id: "dm-task-2", description: "Take diabetes medications with meals", frequency: "daily", category: "medication" },
      { id: "dm-task-3", description: "Log all meals and carbohydrate intake", frequency: "daily", category: "nutrition" },
      { id: "dm-task-4", description: "Inspect feet for sores or wounds", frequency: "daily", category: "vitals" },
      { id: "dm-task-5", description: "30 minutes of physical activity", frequency: "daily", category: "activity" },
      { id: "dm-task-6", description: "Review diabetes self-management education", frequency: "weekly", category: "education" },
    ],
  },
]

// ============================================================================
// CARE PLANS (Active plans for demo patients)
// ============================================================================

// Generate some sample history data for demo
function generateHistoryData(
  baseValue: number,
  variance: number,
  days: number,
  trend: "improving" | "stable" | "worsening" = "stable"
): { date: string; value: number; loggedBy: string }[] {
  const history = []
  const now = new Date()

  for (let i = days; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)

    let trendAdjustment = 0
    if (trend === "improving") trendAdjustment = -((days - i) * 0.5)
    if (trend === "worsening") trendAdjustment = (days - i) * 0.5

    const value = Math.round(
      baseValue + trendAdjustment + (Math.random() * variance * 2 - variance)
    )

    history.push({
      date: date.toISOString(),
      value,
      loggedBy: "nav1",
    })
  }

  return history
}

export const initialCarePlans: CarePlan[] = [
  {
    id: "cp-pt1",
    patientId: "pt1",
    templateId: "diabetes-pathway",
    templateName: "Type 2 Diabetes Control",
    startDate: "2026-01-15",
    activeGoals: [
      {
        id: "goal-pt1-glucose",
        goalDefinitionId: "dm-fasting-glucose",
        description: "Fasting blood glucose",
        targetValue: 130,
        metricUnit: "mg/dL",
        direction: "below",
        warningThreshold: 150,
        history: generateHistoryData(145, 15, 7, "improving"),
        status: "warning",
      },
      {
        id: "goal-pt1-a1c",
        goalDefinitionId: "dm-a1c",
        description: "HbA1c level",
        targetValue: 7.0,
        metricUnit: "%",
        direction: "below",
        warningThreshold: 8.0,
        history: [
          { date: "2026-01-01T10:00:00Z", value: 8.2, loggedBy: "nav1" },
          { date: "2026-01-15T10:00:00Z", value: 7.8, loggedBy: "nav1" },
        ],
        status: "warning",
      },
      {
        id: "goal-pt1-weight",
        goalDefinitionId: "dm-weight",
        description: "Weight management",
        targetValue: 200,
        metricUnit: "lbs",
        direction: "below",
        warningThreshold: 210,
        history: generateHistoryData(195, 3, 7, "stable"),
        status: "on_track",
      },
      {
        id: "goal-pt1-steps",
        goalDefinitionId: "dm-steps",
        description: "Daily steps",
        targetValue: 5000,
        metricUnit: "steps",
        direction: "above",
        warningThreshold: 3000,
        history: generateHistoryData(4200, 800, 7, "improving"),
        status: "warning",
      },
    ],
    activeTasks: [
      { id: "task-pt1-1", taskDefinitionId: "dm-task-1", description: "Check fasting blood sugar each morning", frequency: "daily", category: "vitals" },
      { id: "task-pt1-2", taskDefinitionId: "dm-task-2", description: "Take diabetes medications with meals", frequency: "daily", category: "medication", lastCompleted: "2026-01-27" },
      { id: "task-pt1-3", taskDefinitionId: "dm-task-3", description: "Log all meals and carbohydrate intake", frequency: "daily", category: "nutrition" },
      { id: "task-pt1-4", taskDefinitionId: "dm-task-4", description: "Inspect feet for sores or wounds", frequency: "daily", category: "vitals" },
      { id: "task-pt1-5", taskDefinitionId: "dm-task-5", description: "30 minutes of physical activity", frequency: "daily", category: "activity" },
    ],
    status: "active",
  },
]

// ============================================================================
// PAYER RATES (Phase 5 - Governance & Admin)
// ============================================================================

// Unified payer entities: identity + rate card + billing-rules link.
// Aliases cover every healthPlan string used by patients/referrals so
// name resolution only happens at data boundaries (referral acceptance).
export const initialPayers: Payer[] = [
  {
    id: "payer-uhc",
    name: "United Healthcare",
    aliases: ["UHC", "United"],
    payerType: "COMMERCIAL",
    payerConfigId: "medicare-pin", // UHC Medicare Advantage contract: G-code rules
    ratePerUnit: 150.0,
    ediPayerId: "87726",
    lastUpdated: "2026-01-15T10:00:00Z",
    updatedBy: "admin1",
  },
  {
    id: "payer-molina",
    name: "Molina Healthcare",
    aliases: ["Molina"],
    payerType: "MEDICAID",
    payerConfigId: "medicaid-bh",
    ratePerUnit: 125.0,
    ediPayerId: "20553",
    lastUpdated: "2026-01-15T10:00:00Z",
    updatedBy: "admin1",
  },
  {
    id: "payer-bcbs",
    name: "Blue Cross Blue Shield",
    aliases: ["BCBS", "Blue Cross"],
    payerType: "COMMERCIAL",
    payerConfigId: "medicare-chi",
    ratePerUnit: 175.0,
    ediPayerId: "53589",
    lastUpdated: "2026-01-15T10:00:00Z",
    updatedBy: "admin1",
  },
  {
    id: "payer-mercy",
    name: "Mercy Care",
    aliases: ["Mercy"],
    payerType: "MEDICAID",
    payerConfigId: "medicaid-bh",
    ratePerUnit: 140.0,
    ediPayerId: "86050",
    lastUpdated: "2026-01-15T10:00:00Z",
    updatedBy: "admin1",
  },
  {
    id: "payer-ahcccs",
    name: "AHCCCS",
    aliases: ["Arizona Medicaid"],
    payerType: "MEDICAID",
    payerConfigId: "medicaid-bh",
    ratePerUnit: 110.0,
    ediPayerId: "AZMCD",
    lastUpdated: "2026-01-15T10:00:00Z",
    updatedBy: "admin1",
  },
]

// ============================================================================
// REMARK CODE DICTIONARY (CARC/RARC) - remittance adjudication reference
// ============================================================================

// NOTE: deliberately NO CARC 144 / RARC N807 — their absence drives the DAP
// pend-and-review demo beat (unknown incentive codes pend instead of misposting).
export const initialRemarkCodes: RemarkCode[] = [
  { id: "carc-1", type: "CARC", code: "1", description: "Deductible amount", classification: "adjustment", lastUpdated: "2026-01-15T10:00:00Z" },
  { id: "carc-16", type: "CARC", code: "16", description: "Claim/service lacks information or has submission/billing error(s)", classification: "informational", lastUpdated: "2026-01-15T10:00:00Z" },
  { id: "carc-18", type: "CARC", code: "18", description: "Exact duplicate claim/service", classification: "denial", lastUpdated: "2026-01-15T10:00:00Z" },
  { id: "carc-29", type: "CARC", code: "29", description: "The time limit for filing has expired", classification: "denial", lastUpdated: "2026-01-15T10:00:00Z" },
  { id: "carc-45", type: "CARC", code: "45", description: "Charge exceeds fee schedule/maximum allowable or contracted fee arrangement", classification: "adjustment", lastUpdated: "2026-01-15T10:00:00Z" },
  { id: "carc-50", type: "CARC", code: "50", description: "Non-covered services: not deemed a medical necessity by the payer", classification: "denial", lastUpdated: "2026-01-15T10:00:00Z" },
  { id: "carc-96", type: "CARC", code: "96", description: "Non-covered charge(s)", classification: "denial", lastUpdated: "2026-01-15T10:00:00Z" },
  { id: "carc-97", type: "CARC", code: "97", description: "Benefit included in payment/allowance for another adjudicated service", classification: "adjustment", lastUpdated: "2026-01-15T10:00:00Z" },
  { id: "carc-109", type: "CARC", code: "109", description: "Claim/service not covered by this payer/contractor", classification: "denial", lastUpdated: "2026-01-15T10:00:00Z" },
  { id: "carc-197", type: "CARC", code: "197", description: "Precertification/authorization/notification absent", classification: "denial", lastUpdated: "2026-01-15T10:00:00Z" },
  { id: "rarc-n30", type: "RARC", code: "N30", description: "Patient ineligible for this service", classification: "denial", lastUpdated: "2026-01-15T10:00:00Z" },
  { id: "rarc-n56", type: "RARC", code: "N56", description: "Procedure code billed is not correct/valid for the services billed or date of service", classification: "denial", lastUpdated: "2026-01-15T10:00:00Z" },
  { id: "rarc-m15", type: "RARC", code: "M15", description: "Separately billed services have been bundled as components of the same procedure", classification: "informational", lastUpdated: "2026-01-15T10:00:00Z" },
  { id: "rarc-m25", type: "RARC", code: "M25", description: "Information furnished does not substantiate the need for this level of service", classification: "denial", lastUpdated: "2026-01-15T10:00:00Z" },
  { id: "rarc-ma04", type: "RARC", code: "MA04", description: "Secondary payment cannot be considered without primary payer information", classification: "informational", lastUpdated: "2026-01-15T10:00:00Z" },
  { id: "rarc-n130", type: "RARC", code: "N130", description: "Consult plan benefit documents for restrictions for this service", classification: "informational", lastUpdated: "2026-01-15T10:00:00Z" },
]

// ============================================================================
// ORGANIZATION SETTINGS (billing provider identity for claim exports)
// ============================================================================

export const initialOrganizationSettings: OrganizationSettings = {
  organizationName: "Gellert Health",
  npi: "1932547861",
  taxId: "86-1234567",
  taxonomyCode: "251B00000X", // Case Management agency
  submitterId: "GELLERT01",
  address: { street: "4041 N Central Ave, Suite 900", city: "Phoenix", state: "AZ", zip: "85012" },
  contactPhone: "(602) 555-0100",
  supervisingProvider: { name: "Dr. Anders Whitfield, MD", npi: "1487654329" },
  lastUpdated: "2026-01-15T10:00:00Z",
  updatedBy: "admin1",
}

// ============================================================================
// AUDIT LOGS (Phase 5 - Governance & Admin)
// ============================================================================

export const initialAuditLogs: AuditLog[] = [
  {
    id: "audit-1",
    userId: "admin1",
    userName: "Alex Rivera",
    userRole: "admin",
    action: "payer_rate_updated",
    timestamp: "2026-01-15T10:00:00Z",
    details: "Updated UHC rate from $145.00 to $150.00",
    entityType: "payer_rate",
    entityId: "payer-uhc",
  },
  {
    id: "audit-2",
    userId: "nav1",
    userName: "Emily Rodriguez",
    userRole: "navigator",
    action: "note_created",
    timestamp: "2026-01-24T14:30:00Z",
    details: "Added clinical note for James Thompson",
    entityType: "note",
    entityId: "note1",
  },
  {
    id: "audit-3",
    userId: "sup1",
    userName: "Marcus Williams",
    userRole: "supervisor",
    action: "referral_accepted",
    timestamp: "2026-01-25T09:15:00Z",
    details: "Accepted referral for William Anderson from Dignity Health",
    entityType: "referral",
    entityId: "ref1",
  },
]

// ============================================================================
// NOTE TEMPLATES (Phase 6 - Dynamic Narrative Engine)
// ============================================================================

export const initialNoteTemplates: NoteTemplate[] = [
  // Gellert Note-Taking Manual templates (lib/gellert-templates.ts)
  ...gellertNoteTemplates,
  // Primary compliance-focused template for standard patient navigation
  {
    id: "template-standard-navigation",
    name: "Standard Patient Navigation",
    description: "Core compliance template for documenting patient navigation encounters with structured fields matching regulatory requirements",
    noteType: "visit",
    fields: [
      {
        id: "contact-method",
        label: "Contact Method",
        type: "select",
        required: true,
        options: ["Face-to-Face", "Telehealth", "Phone"],
        narrativePrefix: "Patient seen via ",
        narrativeSuffix: ". ",
      },
      {
        id: "intervention",
        label: "Intervention",
        type: "select",
        required: true,
        options: ["Health Education", "Provider Coordination", "Resource Referral"],
        narrativePrefix: "Navigator provided ",
        narrativeSuffix: ". ",
      },
      {
        id: "patient-response",
        label: "Patient Response",
        type: "select",
        required: true,
        options: ["Receptive", "Resistant", "Confused"],
        narrativePrefix: "Patient response to intervention was ",
        narrativeSuffix: ". ",
      },
      {
        id: "plan-next-steps",
        label: "Plan/Next Steps",
        type: "textarea",
        required: true,
        placeholder: "Enter the plan for next contact...",
        narrativePrefix: "Plan for next contact: ",
        narrativeSuffix: "",
      },
      {
        id: "duration",
        label: "Visit Duration",
        type: "time-duration",
        required: true,
        narrativePrefix: " Total encounter time: ",
        narrativeSuffix: " minutes.",
      },
    ],
  },
  {
    id: "template-navigation-encounter",
    name: "Comprehensive Navigation Encounter",
    description: "Document a detailed home visit or navigation encounter with the patient",
    noteType: "visit",
    fields: [
      {
        id: "encounter-type",
        label: "Encounter Type",
        type: "select",
        required: true,
        options: ["Home Visit", "Phone Call", "Video Call", "Clinic Visit", "Community Visit"],
        narrativePrefix: "Navigator conducted a ",
        narrativeSuffix: " with the patient",
      },
      {
        id: "patient-status",
        label: "Patient Status",
        type: "select",
        required: true,
        options: ["Stable", "Improving", "Declining", "Acute Distress", "In Crisis"],
        narrativePrefix: ". Patient appeared ",
        narrativeSuffix: "",
      },
      {
        id: "interventions",
        label: "Interventions Performed",
        type: "multi-select",
        required: true,
        options: [
          "Medication Review",
          "Care Coordination",
          "Health Education",
          "Social Support Referral",
          "Transportation Assistance",
          "Food/Nutrition Support",
          "Housing Assistance",
          "Crisis Intervention",
          "Appointment Scheduling",
          "Insurance Navigation",
        ],
        narrativePrefix: ". Interventions performed included ",
        narrativeSuffix: "",
        narrativeJoiner: ", ",
      },
      {
        id: "medication-reviewed",
        label: "Medication Adherence Reviewed",
        type: "boolean",
        required: false,
        narrativePrefix: ". Medication adherence was ",
        narrativeSuffix: "",
      },
      {
        id: "barriers-identified",
        label: "Barriers Identified",
        type: "multi-select",
        required: false,
        options: [
          "Transportation",
          "Financial",
          "Language/Communication",
          "Health Literacy",
          "Social Support",
          "Mental Health",
          "Substance Use",
          "Housing Instability",
          "Food Insecurity",
        ],
        narrativePrefix: ". Barriers identified: ",
        narrativeSuffix: "",
        narrativeJoiner: ", ",
      },
      {
        id: "follow-up-plan",
        label: "Follow-up Plan",
        type: "textarea",
        required: true,
        placeholder: "Describe the follow-up plan and next steps...",
        narrativePrefix: ". Follow-up plan: ",
        narrativeSuffix: ".",
      },
      {
        id: "duration",
        label: "Visit Duration",
        type: "time-duration",
        required: true,
        narrativePrefix: " Total encounter time: ",
        narrativeSuffix: " minutes.",
      },
    ],
  },
  {
    id: "template-phone-outreach",
    name: "Phone Outreach",
    description: "Document a phone call with the patient or caregiver",
    noteType: "phone",
    fields: [
      {
        id: "contact-person",
        label: "Spoke With",
        type: "select",
        required: true,
        options: ["Patient", "Spouse/Partner", "Family Member", "Caregiver", "Voicemail Left", "No Answer"],
        narrativePrefix: "Navigator attempted phone contact. ",
        narrativeSuffix: "",
      },
      {
        id: "call-purpose",
        label: "Purpose of Call",
        type: "multi-select",
        required: true,
        options: [
          "Wellness Check",
          "Appointment Reminder",
          "Medication Reminder",
          "Follow-up from Visit",
          "Care Coordination",
          "Lab Results Discussion",
          "Referral Follow-up",
        ],
        narrativePrefix: "Call purpose: ",
        narrativeSuffix: "",
        narrativeJoiner: ", ",
      },
      {
        id: "patient-concerns",
        label: "Patient Concerns Raised",
        type: "textarea",
        required: false,
        placeholder: "Document any concerns raised during the call...",
        narrativePrefix: ". Patient concerns: ",
        narrativeSuffix: "",
      },
      {
        id: "actions-taken",
        label: "Actions Taken",
        type: "textarea",
        required: true,
        placeholder: "What actions were taken or scheduled?",
        narrativePrefix: ". Actions taken: ",
        narrativeSuffix: ".",
      },
      {
        id: "duration",
        label: "Call Duration",
        type: "time-duration",
        required: true,
        narrativePrefix: " Call duration: ",
        narrativeSuffix: " minutes.",
      },
    ],
  },
  {
    id: "template-care-coordination",
    name: "Care Coordination Note",
    description: "Document coordination with other providers or services",
    noteType: "clinical",
    fields: [
      {
        id: "coordination-type",
        label: "Coordination Type",
        type: "select",
        required: true,
        options: [
          "PCP Communication",
          "Specialist Referral",
          "Hospital Discharge Follow-up",
          "Home Health Coordination",
          "DME Arrangement",
          "Pharmacy Coordination",
          "Social Services Referral",
          "Behavioral Health Referral",
        ],
        narrativePrefix: "Care coordination activity: ",
        narrativeSuffix: "",
      },
      {
        id: "provider-contacted",
        label: "Provider/Organization Contacted",
        type: "text",
        required: true,
        placeholder: "Name of provider or organization",
        narrativePrefix: ". Contacted: ",
        narrativeSuffix: "",
      },
      {
        id: "communication-method",
        label: "Communication Method",
        type: "select",
        required: true,
        options: ["Phone", "Fax", "Secure Message", "In-Person", "Email"],
        narrativePrefix: " via ",
        narrativeSuffix: "",
      },
      {
        id: "information-shared",
        label: "Information Shared/Obtained",
        type: "textarea",
        required: true,
        placeholder: "What information was exchanged?",
        narrativePrefix: ". Information exchanged: ",
        narrativeSuffix: "",
      },
      {
        id: "outcome",
        label: "Outcome/Next Steps",
        type: "textarea",
        required: true,
        placeholder: "What was the outcome? What are the next steps?",
        narrativePrefix: ". Outcome: ",
        narrativeSuffix: ".",
      },
    ],
  },
  {
    id: "template-crisis-intervention",
    name: "Crisis Intervention",
    description: "Document a crisis situation and intervention",
    noteType: "clinical",
    fields: [
      {
        id: "crisis-type",
        label: "Crisis Type",
        type: "select",
        required: true,
        options: [
          "Medical Emergency",
          "Mental Health Crisis",
          "Safety Concern",
          "Housing Emergency",
          "Financial Crisis",
          "Caregiver Burnout",
          "Substance Use Related",
        ],
        narrativePrefix: "CRISIS INTERVENTION: ",
        narrativeSuffix: " identified",
      },
      {
        id: "severity",
        label: "Severity Level",
        type: "select",
        required: true,
        options: ["Low - Monitoring", "Moderate - Active Intervention", "High - Urgent Action", "Critical - Emergency Response"],
        narrativePrefix: ". Severity: ",
        narrativeSuffix: "",
      },
      {
        id: "immediate-actions",
        label: "Immediate Actions Taken",
        type: "multi-select",
        required: true,
        options: [
          "Called 911",
          "Contacted Family/Caregiver",
          "Arranged Emergency Transport",
          "Contacted PCP",
          "Contacted Behavioral Health",
          "Provided De-escalation",
          "Arranged Emergency Housing",
          "Provided Food/Resources",
          "Stayed with Patient",
        ],
        narrativePrefix: ". Immediate actions: ",
        narrativeSuffix: "",
        narrativeJoiner: "; ",
      },
      {
        id: "supervisor-notified",
        label: "Supervisor Notified",
        type: "boolean",
        required: true,
        narrativePrefix: ". Supervisor ",
        narrativeSuffix: "",
      },
      {
        id: "safety-plan",
        label: "Safety Plan/Resolution",
        type: "textarea",
        required: true,
        placeholder: "Describe the safety plan and resolution...",
        narrativePrefix: ". Safety plan: ",
        narrativeSuffix: ".",
      },
      {
        id: "follow-up-required",
        label: "Follow-up Required Within",
        type: "select",
        required: true,
        options: ["24 hours", "48 hours", "72 hours", "1 week", "As scheduled"],
        narrativePrefix: " Follow-up required within ",
        narrativeSuffix: ".",
      },
    ],
  },
  {
    id: "template-quick-note",
    name: "Quick Note",
    description: "Add a brief general note or observation",
    noteType: "general",
    fields: [
      {
        id: "note-category",
        label: "Category",
        type: "select",
        required: true,
        options: ["General Update", "Observation", "Reminder", "Communication Log", "Other"],
        narrativePrefix: "",
        narrativeSuffix: ": ",
      },
      {
        id: "note-content",
        label: "Note",
        type: "textarea",
        required: true,
        placeholder: "Enter your note...",
        narrativePrefix: "",
        narrativeSuffix: "",
      },
    ],
  },
]

// ============================================================================
// CMS BILLING - CPT/G-CODE DEFINITIONS (Phase 2.1)
// ============================================================================

/**
 * CMS G-codes for Patient Navigation Services
 * Effective January 2024 for Medicare reimbursement
 *
 * PIN (Principal Illness Navigation):
 * - G0023: Base code, first 60 minutes per calendar month
 * - G0024: Add-on code, each additional 30 minutes
 *
 * CHI (Community Health Integration):
 * - G0019: Base code, first 60 minutes per calendar month
 * - G0022: Add-on code, each additional 30 minutes
 */
export const initialCPTCodes: CPTDefinition[] = [
  // PIN - Principal Illness Navigation (oncology, serious illness)
  {
    code: "G0023",
    description: "Principal Illness Navigation - Base (first 60 min/month)",
    baseDuration: 60,
    isBaseCode: true,
    serviceType: "PIN",
  },
  {
    code: "G0024",
    description: "Principal Illness Navigation - Add-on (each additional 30 min)",
    baseDuration: 30,
    isBaseCode: false,
    serviceType: "PIN",
  },
  // CHI - Community Health Integration (SDOH-focused)
  {
    code: "G0019",
    description: "Community Health Integration - Base (first 60 min/month)",
    baseDuration: 60,
    isBaseCode: true,
    serviceType: "CHI",
  },
  {
    code: "G0022",
    description: "Community Health Integration - Add-on (each additional 30 min)",
    baseDuration: 30,
    isBaseCode: false,
    serviceType: "CHI",
  },
]

// ============================================================================
// CMS BILLING - ICD-10 Z-CODES FOR SDOH (Phase 2.1)
// ============================================================================

/**
 * ICD-10 Z-codes for Social Determinants of Health
 * Required for CHI billing to document barriers addressed
 * These codes supplement primary diagnosis codes
 */
export const initialZCodes: ZCode[] = [
  // Housing (Z59.x)
  {
    code: "Z59.0",
    description: "Homelessness",
    category: "Housing",
  },
  {
    code: "Z59.1",
    description: "Inadequate housing",
    category: "Housing",
  },
  {
    code: "Z59.4",
    description: "Lack of adequate food and safe drinking water",
    category: "Housing",
  },
  {
    code: "Z59.8",
    description: "Other problems related to housing and economic circumstances",
    category: "Housing",
  },
  // Food Insecurity (Z59.4x)
  {
    code: "Z59.41",
    description: "Food insecurity",
    category: "Food",
  },
  {
    code: "Z59.48",
    description: "Other specified lack of adequate food",
    category: "Food",
  },
  // Transportation (Z59.82)
  {
    code: "Z59.82",
    description: "Transportation insecurity",
    category: "Transport",
  },
  {
    code: "Z59.89",
    description: "Other problems related to housing and economic circumstances",
    category: "Transport",
  },
  // Financial (Z59.5-Z59.7)
  {
    code: "Z59.5",
    description: "Extreme poverty",
    category: "Financial",
  },
  {
    code: "Z59.6",
    description: "Low income",
    category: "Financial",
  },
  {
    code: "Z59.7",
    description: "Insufficient social insurance and welfare support",
    category: "Financial",
  },
  // Social Support (Z60.x)
  {
    code: "Z60.2",
    description: "Problems related to living alone",
    category: "Social",
  },
  {
    code: "Z60.4",
    description: "Social exclusion and rejection",
    category: "Social",
  },
  {
    code: "Z63.4",
    description: "Disappearance and death of family member",
    category: "Social",
  },
  {
    code: "Z63.7",
    description: "Other stressful life events affecting family and household",
    category: "Social",
  },
  // Employment (Z56.x)
  {
    code: "Z56.0",
    description: "Unemployment, unspecified",
    category: "Employment",
  },
  {
    code: "Z56.9",
    description: "Unspecified problems related to employment",
    category: "Employment",
  },
]

// ============================================================================
// SCHEDULE EVENTS (Phase 4 - Scheduling & Logistics)
// ============================================================================

import type { ScheduleEvent, NavigatorShift } from "./types"

/**
 * Seed schedule events for Maria Gonzalez (nav-maria)
 * Includes events to demonstrate travel conflict detection
 */
// ============================================================================
// INTAKE RECORDS (CMS billing prerequisites: consent, initiating visit, acuity)
// Every patient with seed time logs has an intake EXCEPT pt-validation-test,
// which is intentionally omitted so the consent guardrail is demoable.
// ============================================================================

export const initialIntakeRecords: IntakeRecord[] = [
  {
    id: "intake-pt1",
    patientId: "pt1",
    date: "2025-12-01",
    initiatingVisitDate: "2025-12-01",
    consentObtained: true,
    consentDate: "2025-12-01",
    serviceType: "PIN",
    acuity: { clinical: 3, psychosocial: 2, barriers: 2, literacy: 2, totalScore: 9, level: "High" },
    identifiedBarriers: [
      { code: "Z59.82", description: "Transportation insecurity", category: "Transport" },
    ],
    primaryNavigatorId: "nav-maria",
  },
  {
    id: "intake-pt2",
    patientId: "pt2",
    date: "2025-12-05",
    initiatingVisitDate: "2025-12-05",
    consentObtained: true,
    consentDate: "2025-12-05",
    serviceType: "CHI",
    acuity: { clinical: 2, psychosocial: 2, barriers: 2, literacy: 1, totalScore: 7, level: "Moderate" },
    identifiedBarriers: [
      { code: "Z60.2", description: "Problems related to living alone", category: "Social" },
      { code: "Z59.41", description: "Food insecurity", category: "Food" },
    ],
    primaryNavigatorId: "nav-maria",
  },
  {
    id: "intake-pt3",
    patientId: "pt3",
    date: "2025-12-28",
    initiatingVisitDate: "2025-12-28",
    consentObtained: true,
    consentDate: "2025-12-28",
    serviceType: "PIN",
    acuity: { clinical: 3, psychosocial: 2, barriers: 2, literacy: 2, totalScore: 9, level: "High" },
    identifiedBarriers: [],
    primaryNavigatorId: "nav2",
  },
  {
    id: "intake-pt4",
    patientId: "pt4",
    date: "2025-12-20",
    initiatingVisitDate: "2025-12-20",
    consentObtained: true,
    consentDate: "2025-12-20",
    serviceType: "CHI",
    acuity: { clinical: 1, psychosocial: 1, barriers: 1, literacy: 0, totalScore: 3, level: "Low" },
    identifiedBarriers: [
      { code: "Z59.82", description: "Transportation insecurity", category: "Transport" },
    ],
    primaryNavigatorId: "nav2",
  },
  {
    id: "intake-pt5",
    patientId: "pt5",
    date: "2025-12-30",
    initiatingVisitDate: "2025-12-30",
    consentObtained: true,
    consentDate: "2025-12-30",
    serviceType: "PIN",
    acuity: { clinical: 3, psychosocial: 3, barriers: 2, literacy: 1, totalScore: 9, level: "High" },
    identifiedBarriers: [
      { code: "Z59.6", description: "Low income", category: "Financial" },
    ],
    primaryNavigatorId: "nav3",
  },
  {
    id: "intake-pt-billing",
    patientId: "pt-billing",
    date: "2026-01-10",
    initiatingVisitDate: "2026-01-10",
    consentObtained: true,
    consentDate: "2026-01-10",
    serviceType: "PIN",
    acuity: { clinical: 2, psychosocial: 1, barriers: 2, literacy: 1, totalScore: 6, level: "Moderate" },
    identifiedBarriers: [],
    primaryNavigatorId: "nav-john",
  },
  {
    id: "intake-pt-elena",
    patientId: "pt-elena",
    date: "2026-01-28",
    initiatingVisitDate: "2026-01-28",
    consentObtained: true,
    consentDate: "2026-01-28",
    serviceType: "PIN",
    acuity: { clinical: 2, psychosocial: 2, barriers: 1, literacy: 2, totalScore: 7, level: "Moderate" },
    identifiedBarriers: [
      { code: "Z59.82", description: "Transportation insecurity", category: "Transport" },
    ],
    primaryNavigatorId: "nav-maria",
  },
  // ==========================================================================
  // JOURNEY ENGINE: Gellert Intake 1 & 2 protocol records (no time logs)
  // ==========================================================================
  {
    id: "intake-pt-journey-intake1",
    patientId: "pt-journey-intake1",
    date: "2026-01-28",
    initiatingVisitDate: "2026-01-28",
    consentObtained: true,
    consentDate: "2026-01-28",
    serviceType: "CHI",
    acuity: { clinical: 1, psychosocial: 1, barriers: 2, literacy: 1, totalScore: 5, level: "Moderate" },
    identifiedBarriers: [
      { code: "Z59.82", description: "Transportation insecurity", category: "Transport" },
    ],
    primaryNavigatorId: "nav-sarah",
    // Intake 1 scheduled 2 days out; checklist untouched; PCP due-by counting down
    intake1: {
      scheduledDate: "2026-02-01",
      status: "scheduled",
      noShowCount: 0,
      checklist: [
        { key: "onboarding_packet", label: "Onboarding packet completed", done: false },
        { key: "roi_signed", label: "Release of Information signed", done: false },
        { key: "med_reconciliation", label: "Medication reconciliation", done: false },
        { key: "health_history", label: "Health history collected", done: false },
        { key: "provider_list", label: "Provider list compiled", done: false },
        { key: "risk_screening", label: "Risk screening completed", done: false },
        { key: "patient_photo", label: "Patient photo on file", done: false },
        { key: "pcp_scheduled", label: "PCP appointment scheduled", done: false },
      ],
    },
    intake2: { status: "not_scheduled", noShowCount: 0, checklist: [
      { key: "intake_survey", label: "Intake survey administered", done: false },
      { key: "navigation_contract_signed", label: "Navigation contract signed", done: false },
      { key: "risk_tier_confirmed", label: "Risk tier confirmed", done: false },
    ] },
    pcpDueBy: "2026-02-06", // conversion 2026-01-28 + 7 business days
    totalNoShows: 0,
  },
  {
    id: "intake-pt-journey-intake2",
    patientId: "pt-journey-intake2",
    date: "2026-01-15",
    initiatingVisitDate: "2026-01-15",
    consentObtained: true,
    consentDate: "2026-01-15",
    serviceType: "CHI",
    acuity: { clinical: 2, psychosocial: 2, barriers: 1, literacy: 2, totalScore: 7, level: "Moderate" },
    identifiedBarriers: [
      { code: "Z60.2", description: "Problems related to living alone", category: "Social" },
    ],
    primaryNavigatorId: "nav3",
    // Intake 1 complete; Intake 2 has TWO no-shows — one more triggers MIA closure
    intake1: {
      scheduledDate: "2026-01-17",
      completedDate: "2026-01-17",
      status: "completed",
      noShowCount: 0,
      checklist: [
        { key: "onboarding_packet", label: "Onboarding packet completed", done: true, doneAt: "2026-01-17", doneBy: "nav3" },
        { key: "roi_signed", label: "Release of Information signed", done: true, doneAt: "2026-01-17", doneBy: "nav3" },
        { key: "med_reconciliation", label: "Medication reconciliation", done: true, doneAt: "2026-01-17", doneBy: "nav3" },
        { key: "health_history", label: "Health history collected", done: true, doneAt: "2026-01-17", doneBy: "nav3" },
        { key: "provider_list", label: "Provider list compiled", done: true, doneAt: "2026-01-17", doneBy: "nav3" },
        { key: "risk_screening", label: "Risk screening completed", done: true, doneAt: "2026-01-17", doneBy: "nav3" },
        { key: "patient_photo", label: "Patient photo on file", done: true, doneAt: "2026-01-17", doneBy: "nav3" },
        { key: "pcp_scheduled", label: "PCP appointment scheduled", done: true, doneAt: "2026-01-17", doneBy: "nav3" },
      ],
    },
    intake2: {
      scheduledDate: "2026-02-02",
      status: "scheduled",
      noShowCount: 2, // 2026-01-22 and 2026-01-27 both missed
      checklist: [
        { key: "intake_survey", label: "Intake survey administered", done: false },
        { key: "navigation_contract_signed", label: "Navigation contract signed", done: false },
        { key: "risk_tier_confirmed", label: "Risk tier confirmed", done: false },
      ],
    },
    pcpApptDate: "2026-01-23",
    pcpDueBy: "2026-01-26", // conversion 2026-01-15 + 7 business days
    totalNoShows: 2,
  },
]

export const initialScheduleEvents: ScheduleEvent[] = [
  // Medical Visit - 10:00 AM to 11:00 AM, Central Phoenix (85001)
  {
    id: "evt-medical-1",
    patientId: "pt1",
    patientName: "James Thompson",
    navigatorId: "nav-maria",
    navigatorName: "Maria Gonzalez",
    type: "MEDICAL_VISIT",
    title: "Oncology Follow-up",
    description: "Post-treatment follow-up with Dr. Martinez",
    location: {
      name: "Banner Desert Medical Center",
      address: "1400 S Dobson Rd, Mesa, AZ 85202",
      zipCode: "85001", // Central Phoenix
      lat: 33.4484,
      lng: -111.8320,
    },
    startTime: "2026-01-30T10:00:00-07:00",
    endTime: "2026-01-30T11:00:00-07:00",
    isHighSafetyRisk: false,
    status: "SCHEDULED",
    estimatedTravelMinutes: 25,
  },
  // Navigator Visit - 09:30 AM to 10:00 AM, West Valley (85301)
  // This should trigger a travel conflict warning - only 0 min gap between
  // this event ending at 10:00 and the medical visit starting at 10:00
  // with different zip codes (85301 -> 85001, requires ~20 min travel)
  {
    id: "evt-nav-1",
    patientId: "pt2",
    patientName: "Dorothy Martinez",
    navigatorId: "nav-maria",
    navigatorName: "Maria Gonzalez",
    type: "NAVIGATOR_VISIT",
    title: "Pickup & Transport",
    description: "Transport patient to pharmacy for medication pickup",
    location: {
      name: "Patient Home",
      address: "5678 W Glendale Ave, Glendale, AZ 85301",
      zipCode: "85301", // Glendale - West Valley
      lat: 33.5387,
      lng: -112.1860,
    },
    startTime: "2026-01-30T09:30:00-07:00",
    endTime: "2026-01-30T10:00:00-07:00",
    isHighSafetyRisk: false,
    status: "SCHEDULED",
    estimatedTravelMinutes: 15,
    pickupLocation: {
      name: "Patient Residence",
      address: "5678 W Glendale Ave, Glendale, AZ 85301",
      zipCode: "85301",
      lat: 33.5387,
      lng: -112.1860,
    },
  },
  // High Risk Visit - 02:00 PM to 03:00 PM, West Valley (85301)
  {
    id: "evt-high-risk-1",
    patientId: "pt5",
    patientName: "Frank Anderson",
    navigatorId: "nav-maria",
    navigatorName: "Maria Gonzalez",
    type: "NAVIGATOR_VISIT",
    title: "High Risk Home Visit",
    description: "Comprehensive home assessment for high-risk patient with multiple chronic conditions",
    location: {
      name: "Patient Home",
      address: "2340 W Camelback Rd, Phoenix, AZ 85301",
      zipCode: "85301", // West Valley
      lat: 33.5092,
      lng: -112.1066,
    },
    startTime: "2026-01-30T14:00:00-07:00",
    endTime: "2026-01-30T15:00:00-07:00",
    isHighSafetyRisk: true, // High safety risk patient (pt5 has securityRisk: 'High')
    status: "SCHEDULED",
    estimatedTravelMinutes: 20,
  },
  // ============================================================================
  // NAV1 (Emily Rodriguez) - Default navigator: dual-track + travel conflict test
  // ============================================================================
  // Medical 09:00-10:00 in 85001 (Central Phoenix) — then 10:15 in 85301 triggers "Insufficient Travel Time"
  {
    id: "evt-nav1-medical-1",
    patientId: "pt1",
    patientName: "James Thompson",
    navigatorId: "nav1",
    navigatorName: "Emily Rodriguez",
    type: "MEDICAL_VISIT",
    title: "Oncology Follow-up",
    description: "Post-treatment follow-up with Dr. Martinez",
    location: {
      name: "Banner Desert Medical Center",
      address: "1400 S Dobson Rd, Mesa, AZ 85202",
      zipCode: "85001",
      lat: 33.4484,
      lng: -111.8320,
    },
    startTime: "2026-01-30T09:00:00-07:00",
    endTime: "2026-01-30T10:00:00-07:00",
    isHighSafetyRisk: false,
    status: "SCHEDULED",
    estimatedTravelMinutes: 25,
  },
  // Navigator Visit at 10:15 AM in 85301 (West Valley) — only 15 min after 10:00 in 85001; 20+ min travel needed
  {
    id: "evt-nav1-conflict",
    patientId: "pt2",
    patientName: "Dorothy Martinez",
    navigatorId: "nav1",
    navigatorName: "Emily Rodriguez",
    type: "NAVIGATOR_VISIT",
    title: "Home Visit - West Valley",
    description: "Medication reconciliation and care plan review",
    location: {
      name: "Patient Home",
      address: "5678 W Glendale Ave, Glendale, AZ 85301",
      zipCode: "85301",
      lat: 33.5387,
      lng: -112.1860,
    },
    startTime: "2026-01-30T10:15:00-07:00",
    endTime: "2026-01-30T10:45:00-07:00",
    isHighSafetyRisk: false,
    status: "SCHEDULED",
    estimatedTravelMinutes: 20,
  },
  // Navigator Visit - 2:00 PM (no conflict, for EVV test)
  {
    id: "evt-nav1-evv",
    patientId: "pt2",
    patientName: "Dorothy Martinez",
    navigatorId: "nav1",
    navigatorName: "Emily Rodriguez",
    type: "NAVIGATOR_VISIT",
    title: "Home Visit",
    description: "Routine home visit",
    location: {
      name: "Patient Home",
      address: "5678 W Glendale Ave, Glendale, AZ 85301",
      zipCode: "85301",
      lat: 33.5387,
      lng: -112.1860,
    },
    startTime: "2026-01-30T14:00:00-07:00",
    endTime: "2026-01-30T14:45:00-07:00",
    isHighSafetyRisk: false,
    status: "SCHEDULED",
    estimatedTravelMinutes: 15,
  },
  // High-risk visit for nav1 (Test D: safety badge visible without clicking)
  {
    id: "evt-nav1-high-risk",
    patientId: "pt5",
    patientName: "Frank Anderson",
    navigatorId: "nav1",
    navigatorName: "Emily Rodriguez",
    type: "NAVIGATOR_VISIT",
    title: "High Risk Home Visit",
    description: "Patient has securityRisk: High — safety badge visible on card",
    location: {
      name: "Patient Home",
      address: "2340 W Camelback Rd, Phoenix, AZ 85301",
      zipCode: "85301",
      lat: 33.5092,
      lng: -112.1066,
    },
    startTime: "2026-01-30T15:30:00-07:00",
    endTime: "2026-01-30T16:30:00-07:00",
    isHighSafetyRisk: true,
    status: "SCHEDULED",
    estimatedTravelMinutes: 20,
  },
]

// ============================================================================
// NAVIGATOR SHIFTS (Phase 4 - Staff Scheduling)
// ============================================================================

/**
 * Seed navigator shifts for demo
 * Demonstrates various shift patterns
 */
export const initialNavigatorShifts: NavigatorShift[] = [
  // Maria Gonzalez - Mon-Fri 9-5 (standard full-time)
  {
    id: "shift-maria-weekday",
    navigatorId: "nav-maria",
    navigatorName: "Maria Gonzalez",
    supervisorId: "sup1",
    startDate: "2026-01-01",
    endDate: undefined, // Ongoing
    days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    startTime: "09:00",
    endTime: "17:00",
    region: "west-valley",
    notes: "Primary West Valley coverage",
    isPublished: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  // John Mitchell - Mon-Thu 8-6 (4x10 schedule)
  {
    id: "shift-john-4x10",
    navigatorId: "nav-john",
    navigatorName: "John Mitchell",
    supervisorId: "sup1",
    startDate: "2026-01-01",
    endDate: undefined,
    days: ["Mon", "Tue", "Wed", "Thu"],
    startTime: "08:00",
    endTime: "18:00",
    region: "east-valley",
    notes: "4x10 schedule - East Valley",
    isPublished: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  // Sarah Thompson - Tue/Thu/Sat (part-time)
  {
    id: "shift-sarah-parttime",
    navigatorId: "nav-sarah",
    navigatorName: "Sarah Thompson",
    supervisorId: "sup1",
    startDate: "2026-01-01",
    endDate: undefined,
    days: ["Tue", "Thu", "Sat"],
    startTime: "10:00",
    endTime: "16:00",
    region: "central",
    notes: "Part-time L3 specialist - high-risk patients",
    isPublished: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  // Emily Rodriguez - Mon-Fri 7-3 (early shift)
  {
    id: "shift-emily-early",
    navigatorId: "nav1",
    navigatorName: "Emily Rodriguez",
    supervisorId: "sup1",
    startDate: "2026-01-01",
    endDate: undefined,
    days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    startTime: "07:00",
    endTime: "15:00",
    region: "phoenix-metro",
    notes: "Early shift for morning appointments",
    isPublished: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  // David Chen - Mon-Fri 11-7 (late shift)
  {
    id: "shift-david-late",
    navigatorId: "nav2",
    navigatorName: "David Chen",
    supervisorId: "sup1",
    startDate: "2026-01-01",
    endDate: undefined,
    days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    startTime: "11:00",
    endTime: "19:00",
    region: "phoenix-metro",
    notes: "Late shift for afternoon/evening coverage",
    isPublished: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
]

// ============================================================================
// TIME LOGS (Billing Bridge - Phase 2.1)
// ============================================================================

import type { TimeLog } from "./types"

/**
 * Sample time logs for demonstrating billing aggregation
 * These logs will be aggregated into BillableClaims by the billing-aggregator
 */
export const initialTimeLogs: TimeLog[] = [
  // James Thompson (pt1) - PIN patient, January 2026
  // Total: 135 min = 9 units under Medicaid H-codes (Rule of Eights)
  {
    id: "tl-001",
    patientId: "pt1",
    date: "2026-01-05",
    startTime: "2026-01-05T09:00:00-07:00",
    endTime: "2026-01-05T09:45:00-07:00",
    durationMinutes: 45,
    modality: "In-Person",
    serviceType: "PIN",
    navigatorId: "nav-maria",
    verified: true,
    verifiedBy: "sup-sarah",
    verifiedAt: "2026-01-05T17:00:00-07:00",
    billingPeriod: "2026-01",
    activityType: "HOME_VISIT", // -> H2015 (Community Support)
  },
  {
    id: "tl-002",
    patientId: "pt1",
    date: "2026-01-12",
    startTime: "2026-01-12T10:00:00-07:00",
    endTime: "2026-01-12T10:30:00-07:00",
    durationMinutes: 30,
    modality: "Phone",
    serviceType: "PIN",
    navigatorId: "nav-maria",
    verified: true,
    verifiedBy: "sup-sarah",
    verifiedAt: "2026-01-12T17:00:00-07:00",
    billingPeriod: "2026-01",
    activityType: "CHECK_IN", // -> H0038 (Peer Support)
  },
  {
    id: "tl-003",
    patientId: "pt1",
    date: "2026-01-19",
    startTime: "2026-01-19T14:00:00-07:00",
    endTime: "2026-01-19T14:30:00-07:00",
    durationMinutes: 30, // Changed from 60 to 30 for demo: James now has 105 min total (45+30+30)
    modality: "In-Person",
    serviceType: "PIN",
    navigatorId: "nav-maria",
    verified: true,
    verifiedBy: "sup-sarah",
    verifiedAt: "2026-01-19T17:00:00-07:00",
    billingPeriod: "2026-01",
    activityType: "HOME_VISIT", // -> H2015 (Community Support)
  },
  // Dorothy Martinez (pt2) - CHI patient, January 2026
  // Total: 105 min = 7 units under Medicaid H-codes (Rule of Eights)
  {
    id: "tl-004",
    patientId: "pt2",
    date: "2026-01-03",
    startTime: "2026-01-03T11:00:00-07:00",
    endTime: "2026-01-03T12:15:00-07:00",
    durationMinutes: 75,
    modality: "In-Person",
    serviceType: "CHI",
    navigatorId: "nav-maria",
    verified: true,
    verifiedBy: "sup-sarah",
    verifiedAt: "2026-01-03T17:00:00-07:00",
    billingPeriod: "2026-01",
    activityType: "TRANSPORT", // -> H2015 (Community Support)
  },
  {
    id: "tl-005",
    patientId: "pt2",
    date: "2026-01-10",
    startTime: "2026-01-10T09:30:00-07:00",
    endTime: "2026-01-10T10:00:00-07:00",
    durationMinutes: 30,
    modality: "Phone",
    serviceType: "CHI",
    navigatorId: "nav-maria",
    verified: true,
    verifiedBy: "sup-sarah",
    verifiedAt: "2026-01-10T17:00:00-07:00",
    billingPeriod: "2026-01",
    activityType: "PEER_SUPPORT", // -> H0038 (Peer Support)
  },
  // Robert Wilson (pt3) - PIN patient, January 2026
  // Total: 45 min = 3 units under Medicaid H-codes (Rule of Eights: 38-52 = 3 units)
  // NOTE: This is READY under Medicaid (8+ mins) but MISSING_DATA under Medicare (needs 60 min)
  // DEMO: Shows in "Needs Attention" tab to demonstrate the guardrail
  {
    id: "tl-006",
    patientId: "pt3",
    date: "2026-01-08",
    startTime: "2026-01-08T14:00:00-07:00",
    endTime: "2026-01-08T14:25:00-07:00",
    durationMinutes: 25,
    modality: "Phone",
    serviceType: "PIN",
    navigatorId: "nav2",
    verified: true,
    verifiedBy: "sup-sarah",
    verifiedAt: "2026-01-08T17:00:00-07:00",
    billingPeriod: "2026-01",
    activityType: "OUTREACH", // -> H0023 (Outreach)
  },
  // Additional log for Robert Wilson to reach 45 min total (for "Needs Attention" demo)
  {
    id: "tl-006b",
    patientId: "pt3",
    date: "2026-01-15",
    startTime: "2026-01-15T10:00:00-07:00",
    endTime: "2026-01-15T10:20:00-07:00",
    durationMinutes: 20,
    modality: "Phone",
    serviceType: "PIN",
    navigatorId: "nav2",
    verified: true,
    verifiedBy: "sup-sarah",
    verifiedAt: "2026-01-15T17:00:00-07:00",
    billingPeriod: "2026-01",
    activityType: "CHECK_IN", // -> H0038 (Peer Support)
  },
  // Helen Garcia (pt4) - CHI patient, January 2026 (multiple visits, good volume)
  // Total: 195 min = 13 units under Medicaid H-codes (Rule of Eights)
  {
    id: "tl-007",
    patientId: "pt4",
    date: "2026-01-02",
    startTime: "2026-01-02T10:00:00-07:00",
    endTime: "2026-01-02T11:30:00-07:00",
    durationMinutes: 90,
    modality: "In-Person",
    serviceType: "CHI",
    navigatorId: "nav2", // David Chen (was "nav-david" - no such Navigator entity)
    verified: true,
    verifiedBy: "sup-sarah",
    verifiedAt: "2026-01-02T17:00:00-07:00",
    billingPeriod: "2026-01",
    activityType: "HOME_VISIT", // -> H2015 (Community Support)
  },
  {
    id: "tl-008",
    patientId: "pt4",
    date: "2026-01-09",
    startTime: "2026-01-09T09:00:00-07:00",
    endTime: "2026-01-09T10:00:00-07:00",
    durationMinutes: 60,
    modality: "Video",
    serviceType: "CHI",
    navigatorId: "nav2", // David Chen (was "nav-david" - no such Navigator entity)
    verified: true,
    verifiedBy: "sup-sarah",
    verifiedAt: "2026-01-09T17:00:00-07:00",
    billingPeriod: "2026-01",
    activityType: "PEER_SUPPORT", // -> H0038 (Peer Support)
  },
  {
    id: "tl-009",
    patientId: "pt4",
    date: "2026-01-16",
    startTime: "2026-01-16T11:00:00-07:00",
    endTime: "2026-01-16T11:45:00-07:00",
    durationMinutes: 45,
    modality: "Phone",
    serviceType: "CHI",
    navigatorId: "nav2", // David Chen (was "nav-david" - no such Navigator entity)
    verified: true,
    verifiedBy: "sup-sarah",
    verifiedAt: "2026-01-16T17:00:00-07:00",
    billingPeriod: "2026-01",
    activityType: "CHECK_IN", // -> H0038 (Peer Support)
  },
  // Frank Anderson (pt5) - PIN patient, unverified logs (pending supervisor review)
  {
    id: "tl-010",
    patientId: "pt5",
    date: "2026-01-20",
    startTime: "2026-01-20T13:00:00-07:00",
    endTime: "2026-01-20T14:30:00-07:00",
    durationMinutes: 90,
    modality: "In-Person",
    serviceType: "PIN",
    navigatorId: "nav-maria",
    verified: false,
    billingPeriod: "2026-01",
    activityType: "HOME_VISIT", // -> H2015 (Community Support)
  },
  // December 2025 time logs (for historical comparison)
  {
    id: "tl-011",
    patientId: "pt1",
    date: "2025-12-10",
    startTime: "2025-12-10T10:00:00-07:00",
    endTime: "2025-12-10T11:30:00-07:00",
    durationMinutes: 90,
    modality: "In-Person",
    serviceType: "PIN",
    navigatorId: "nav-maria",
    verified: true,
    verifiedBy: "sup-sarah",
    verifiedAt: "2025-12-10T17:00:00-07:00",
    billingPeriod: "2025-12",
    activityType: "HOME_VISIT", // -> H2015 (Community Support)
  },
  {
    id: "tl-012",
    patientId: "pt2",
    date: "2025-12-15",
    startTime: "2025-12-15T09:00:00-07:00",
    endTime: "2025-12-15T10:15:00-07:00",
    durationMinutes: 75,
    modality: "In-Person",
    serviceType: "CHI",
    navigatorId: "nav-maria",
    verified: true,
    verifiedBy: "sup-sarah",
    verifiedAt: "2025-12-15T17:00:00-07:00",
    billingPeriod: "2025-12",
    activityType: "TRANSPORT", // -> H2015 (Community Support)
  },
  // Billing Bridge Test A: Sam Underwood
  // 45 min = 3 units under Medicaid H-codes (Rule of Eights: 38-52 = 3 units)
  // NOTE: This is READY under Medicaid but MISSING_DATA under Medicare (needs 60 min)
  {
    id: "tl-billing-45",
    patientId: "pt-billing",
    date: "2026-01-20",
    startTime: "2026-01-20T10:00:00-07:00",
    endTime: "2026-01-20T10:45:00-07:00",
    durationMinutes: 45,
    modality: "In-Person",
    serviceType: "PIN",
    navigatorId: "nav-john",
    verified: true,
    verifiedBy: "sup1",
    verifiedAt: "2026-01-20T17:00:00-07:00",
    billingPeriod: "2026-01",
    activityType: "PEER_SUPPORT", // -> H0038 (Peer Support)
  },
  // Validation test: Patient with MISSING ICD codes → claim should go to "Needs Attention"
  {
    id: "tl-validation-test",
    patientId: "pt-validation-test",
    date: "2026-01-22",
    startTime: "2026-01-22T11:00:00-07:00",
    endTime: "2026-01-22T11:30:00-07:00",
    durationMinutes: 30,
    modality: "In-Person",
    serviceType: "CHI",
    navigatorId: "nav-maria",
    verified: true,
    verifiedBy: "sup1",
    verifiedAt: "2026-01-22T17:00:00-07:00",
    billingPeriod: "2026-01",
    activityType: "HOME_VISIT", // -> H2015 (Community Support)
  },
  // Additional time logs to ensure Frank Anderson (pt5) is billable
  // Total (verified): 90 min = 6 units under Medicaid H-codes (Rule of Eights)
  {
    id: "tl-013",
    patientId: "pt5",
    date: "2026-01-10",
    startTime: "2026-01-10T09:00:00-07:00",
    endTime: "2026-01-10T10:00:00-07:00",
    durationMinutes: 60,
    modality: "In-Person",
    serviceType: "PIN",
    navigatorId: "nav3",
    verified: true,
    verifiedBy: "sup1",
    verifiedAt: "2026-01-10T17:00:00-07:00",
    billingPeriod: "2026-01",
    activityType: "HOME_VISIT", // -> H2015 (Community Support)
  },
  {
    id: "tl-014",
    patientId: "pt5",
    date: "2026-01-17",
    startTime: "2026-01-17T14:00:00-07:00",
    endTime: "2026-01-17T14:30:00-07:00",
    durationMinutes: 30,
    modality: "Phone",
    serviceType: "PIN",
    navigatorId: "nav3",
    verified: true,
    verifiedBy: "sup1",
    verifiedAt: "2026-01-17T17:00:00-07:00",
    billingPeriod: "2026-01",
    activityType: "CHECK_IN", // -> H0038 (Peer Support)
  },
  // Additional January activity so the executive daily-units chart has full
  // month coverage. NO logs for pt3 / pt-billing / pt-validation-test — those
  // patients are QA guardrail fixtures with fixed minute totals.
  {
    id: "tl-015",
    patientId: "pt1",
    date: "2026-01-26",
    startTime: "2026-01-26T09:00:00-07:00",
    endTime: "2026-01-26T09:40:00-07:00",
    durationMinutes: 40,
    modality: "In-Person",
    serviceType: "PIN",
    navigatorId: "nav-maria",
    verified: true,
    verifiedBy: "sup1",
    verifiedAt: "2026-01-26T17:00:00-07:00",
    billingPeriod: "2026-01",
    activityType: "HOME_VISIT", // -> H2015 (Community Support)
  },
  {
    id: "tl-016",
    patientId: "pt1",
    date: "2026-01-29",
    startTime: "2026-01-29T13:00:00-07:00",
    endTime: "2026-01-29T13:20:00-07:00",
    durationMinutes: 20,
    modality: "Phone",
    serviceType: "PIN",
    navigatorId: "nav-maria",
    verified: true,
    verifiedBy: "sup1",
    verifiedAt: "2026-01-29T17:00:00-07:00",
    billingPeriod: "2026-01",
    activityType: "CHECK_IN", // -> H0038 (Peer Support)
  },
  {
    id: "tl-017",
    patientId: "pt2",
    date: "2026-01-06",
    startTime: "2026-01-06T10:00:00-07:00",
    endTime: "2026-01-06T10:35:00-07:00",
    durationMinutes: 35,
    modality: "In-Person",
    serviceType: "CHI",
    navigatorId: "nav-maria",
    verified: true,
    verifiedBy: "sup1",
    verifiedAt: "2026-01-06T17:00:00-07:00",
    billingPeriod: "2026-01",
    activityType: "TRANSPORT", // -> H2015 (Community Support)
  },
  {
    id: "tl-018",
    patientId: "pt2",
    date: "2026-01-14",
    startTime: "2026-01-14T11:00:00-07:00",
    endTime: "2026-01-14T11:50:00-07:00",
    durationMinutes: 50,
    modality: "In-Person",
    serviceType: "CHI",
    navigatorId: "nav-maria",
    verified: true,
    verifiedBy: "sup1",
    verifiedAt: "2026-01-14T17:00:00-07:00",
    billingPeriod: "2026-01",
    activityType: "HOME_VISIT", // -> H2015 (Community Support)
  },
  {
    id: "tl-019",
    patientId: "pt2",
    date: "2026-01-24",
    startTime: "2026-01-24T14:00:00-07:00",
    endTime: "2026-01-24T14:30:00-07:00",
    durationMinutes: 30,
    modality: "Phone",
    serviceType: "CHI",
    navigatorId: "nav-maria",
    verified: true,
    verifiedBy: "sup1",
    verifiedAt: "2026-01-24T17:00:00-07:00",
    billingPeriod: "2026-01",
    activityType: "CHECK_IN", // -> H0038 (Peer Support)
  },
  {
    id: "tl-020",
    patientId: "pt4",
    date: "2026-01-07",
    startTime: "2026-01-07T09:30:00-07:00",
    endTime: "2026-01-07T10:10:00-07:00",
    durationMinutes: 40,
    modality: "Video",
    serviceType: "CHI",
    navigatorId: "nav2",
    verified: true,
    verifiedBy: "sup1",
    verifiedAt: "2026-01-07T17:00:00-07:00",
    billingPeriod: "2026-01",
    activityType: "PEER_SUPPORT", // -> H0038 (Peer Support)
  },
  {
    id: "tl-021",
    patientId: "pt4",
    date: "2026-01-21",
    startTime: "2026-01-21T10:00:00-07:00",
    endTime: "2026-01-21T10:55:00-07:00",
    durationMinutes: 55,
    modality: "In-Person",
    serviceType: "CHI",
    navigatorId: "nav2",
    verified: true,
    verifiedBy: "sup1",
    verifiedAt: "2026-01-21T17:00:00-07:00",
    billingPeriod: "2026-01",
    activityType: "HOME_VISIT", // -> H2015 (Community Support)
  },
  {
    id: "tl-022",
    patientId: "pt4",
    date: "2026-01-27",
    startTime: "2026-01-27T15:00:00-07:00",
    endTime: "2026-01-27T15:30:00-07:00",
    durationMinutes: 30,
    modality: "Phone",
    serviceType: "CHI",
    navigatorId: "nav2",
    verified: true,
    verifiedBy: "sup1",
    verifiedAt: "2026-01-27T17:00:00-07:00",
    billingPeriod: "2026-01",
    activityType: "CHECK_IN", // -> H0038 (Peer Support)
  },
  {
    id: "tl-023",
    patientId: "pt5",
    date: "2026-01-13",
    startTime: "2026-01-13T09:00:00-07:00",
    endTime: "2026-01-13T09:45:00-07:00",
    durationMinutes: 45,
    modality: "In-Person",
    serviceType: "PIN",
    navigatorId: "nav3",
    verified: true,
    verifiedBy: "sup1",
    verifiedAt: "2026-01-13T17:00:00-07:00",
    billingPeriod: "2026-01",
    activityType: "HOME_VISIT", // -> H2015 (Community Support)
  },
  {
    id: "tl-024",
    patientId: "pt5",
    date: "2026-01-23",
    startTime: "2026-01-23T13:00:00-07:00",
    endTime: "2026-01-23T14:00:00-07:00",
    durationMinutes: 60,
    modality: "In-Person",
    serviceType: "PIN",
    navigatorId: "nav3",
    verified: true,
    verifiedBy: "sup1",
    verifiedAt: "2026-01-23T17:00:00-07:00",
    billingPeriod: "2026-01",
    activityType: "HOME_VISIT", // -> H2015 (Community Support)
  },
  {
    id: "tl-025",
    patientId: "pt5",
    date: "2026-01-28",
    startTime: "2026-01-28T10:00:00-07:00",
    endTime: "2026-01-28T10:25:00-07:00",
    durationMinutes: 25,
    modality: "Phone",
    serviceType: "PIN",
    navigatorId: "nav3",
    verified: true,
    verifiedBy: "sup1",
    verifiedAt: "2026-01-28T17:00:00-07:00",
    billingPeriod: "2026-01",
    activityType: "OUTREACH", // -> H0023 (Outreach)
  },
  // Elena Rodriguez (pt-elena) - enrolled 2026-01-28, first navigation contacts
  {
    id: "tl-026",
    patientId: "pt-elena",
    date: "2026-01-28",
    startTime: "2026-01-28T11:00:00-07:00",
    endTime: "2026-01-28T12:00:00-07:00",
    durationMinutes: 60,
    modality: "In-Person",
    serviceType: "PIN",
    navigatorId: "nav-maria",
    verified: true,
    verifiedBy: "sup1",
    verifiedAt: "2026-01-28T17:00:00-07:00",
    billingPeriod: "2026-01",
    activityType: "HOME_VISIT", // -> H2015 (Community Support)
  },
  {
    id: "tl-027",
    patientId: "pt-elena",
    date: "2026-01-29",
    startTime: "2026-01-29T10:00:00-07:00",
    endTime: "2026-01-29T10:30:00-07:00",
    durationMinutes: 30,
    modality: "Phone",
    serviceType: "PIN",
    navigatorId: "nav-maria",
    verified: true,
    verifiedBy: "sup1",
    verifiedAt: "2026-01-29T17:00:00-07:00",
    billingPeriod: "2026-01",
    activityType: "CHECK_IN", // -> H0038 (Peer Support)
  },
  {
    id: "tl-028",
    patientId: "pt-elena",
    date: "2026-01-30",
    startTime: "2026-01-30T14:00:00-07:00",
    endTime: "2026-01-30T14:45:00-07:00",
    durationMinutes: 45,
    modality: "In-Person",
    serviceType: "PIN",
    navigatorId: "nav-maria",
    verified: true,
    verifiedBy: "sup1",
    verifiedAt: "2026-01-30T17:00:00-07:00",
    billingPeriod: "2026-01",
    activityType: "TRANSPORT", // -> H2015 (Community Support)
  },
  // ==========================================================================
  // GELLERT DAY-CLOSE DEMO: nav1's current week (charge-slip history + today)
  // Today's logs (anchor 2026-01-30) have NO signed slips -> live day-close.
  // tl-g18 is the 6-minute patient-day (sub-8-minute stacking coaching hint).
  // ==========================================================================
  {
    id: "tl-g01",
    patientId: "pt1",
    date: "2026-01-21",
    startTime: "2026-01-21T09:00:00-07:00",
    endTime: "2026-01-21T09:45:00-07:00",
    durationMinutes: 45,
    modality: "In-Person",
    serviceType: "CHI",
    navigatorId: "nav1",
    verified: true,
    verifiedBy: "sup1",
    verifiedAt: "2026-01-21T17:00:00-07:00",
    billingPeriod: "2026-01",
    activityType: "PEER_SUPPORT", // -> H0038
  },
  {
    id: "tl-g02",
    patientId: "pt2",
    date: "2026-01-21",
    startTime: "2026-01-21T13:00:00-07:00",
    endTime: "2026-01-21T13:30:00-07:00",
    durationMinutes: 30,
    modality: "Phone",
    serviceType: "CHI",
    navigatorId: "nav1",
    verified: true,
    verifiedBy: "sup1",
    verifiedAt: "2026-01-21T17:00:00-07:00",
    billingPeriod: "2026-01",
    activityType: "PEER_SUPPORT", // -> H0038
  },
  {
    id: "tl-g03",
    patientId: "pt1",
    date: "2026-01-22",
    startTime: "2026-01-22T09:00:00-07:00",
    endTime: "2026-01-22T09:25:00-07:00",
    durationMinutes: 25,
    modality: "In-Person",
    serviceType: "CHI",
    navigatorId: "nav1",
    verified: true,
    verifiedBy: "sup1",
    verifiedAt: "2026-01-22T17:00:00-07:00",
    billingPeriod: "2026-01",
    activityType: "PEER_SUPPORT", // -> H0038
  },
  {
    id: "tl-g04",
    patientId: "pt2",
    date: "2026-01-22",
    startTime: "2026-01-22T13:00:00-07:00",
    endTime: "2026-01-22T13:40:00-07:00",
    durationMinutes: 40,
    modality: "Phone",
    serviceType: "CHI",
    navigatorId: "nav1",
    verified: true,
    verifiedBy: "sup1",
    verifiedAt: "2026-01-22T17:00:00-07:00",
    billingPeriod: "2026-01",
    activityType: "PEER_SUPPORT", // -> H0038
  },
  {
    id: "tl-g05",
    patientId: "pt1",
    date: "2026-01-23",
    startTime: "2026-01-23T09:00:00-07:00",
    endTime: "2026-01-23T09:30:00-07:00",
    durationMinutes: 30,
    modality: "In-Person",
    serviceType: "CHI",
    navigatorId: "nav1",
    verified: true,
    verifiedBy: "sup1",
    verifiedAt: "2026-01-23T17:00:00-07:00",
    billingPeriod: "2026-01",
    activityType: "PEER_SUPPORT", // -> H0038
  },
  {
    id: "tl-g06",
    patientId: "pt2",
    date: "2026-01-23",
    startTime: "2026-01-23T13:00:00-07:00",
    endTime: "2026-01-23T13:20:00-07:00",
    durationMinutes: 20,
    modality: "Phone",
    serviceType: "CHI",
    navigatorId: "nav1",
    verified: true,
    verifiedBy: "sup1",
    verifiedAt: "2026-01-23T17:00:00-07:00",
    billingPeriod: "2026-01",
    activityType: "PEER_SUPPORT", // -> H0038
  },
  {
    id: "tl-g07",
    patientId: "pt1",
    date: "2026-01-26",
    startTime: "2026-01-26T09:00:00-07:00",
    endTime: "2026-01-26T09:50:00-07:00",
    durationMinutes: 50,
    modality: "In-Person",
    serviceType: "CHI",
    navigatorId: "nav1",
    verified: true,
    verifiedBy: "sup1",
    verifiedAt: "2026-01-26T17:00:00-07:00",
    billingPeriod: "2026-01",
    activityType: "PEER_SUPPORT", // -> H0038
  },
  {
    id: "tl-g08",
    patientId: "pt2",
    date: "2026-01-26",
    startTime: "2026-01-26T13:00:00-07:00",
    endTime: "2026-01-26T13:35:00-07:00",
    durationMinutes: 35,
    modality: "Phone",
    serviceType: "CHI",
    navigatorId: "nav1",
    verified: true,
    verifiedBy: "sup1",
    verifiedAt: "2026-01-26T17:00:00-07:00",
    billingPeriod: "2026-01",
    activityType: "PEER_SUPPORT", // -> H0038
  },
  {
    id: "tl-g09",
    patientId: "pt1",
    date: "2026-01-27",
    startTime: "2026-01-27T09:00:00-07:00",
    endTime: "2026-01-27T09:40:00-07:00",
    durationMinutes: 40,
    modality: "In-Person",
    serviceType: "CHI",
    navigatorId: "nav1",
    verified: true,
    verifiedBy: "sup1",
    verifiedAt: "2026-01-27T17:00:00-07:00",
    billingPeriod: "2026-01",
    activityType: "PEER_SUPPORT", // -> H0038
  },
  {
    id: "tl-g10",
    patientId: "pt2",
    date: "2026-01-27",
    startTime: "2026-01-27T13:00:00-07:00",
    endTime: "2026-01-27T13:25:00-07:00",
    durationMinutes: 25,
    modality: "Phone",
    serviceType: "CHI",
    navigatorId: "nav1",
    verified: true,
    verifiedBy: "sup1",
    verifiedAt: "2026-01-27T17:00:00-07:00",
    billingPeriod: "2026-01",
    activityType: "PEER_SUPPORT", // -> H0038
  },
  {
    id: "tl-g11",
    patientId: "pt1",
    date: "2026-01-28",
    startTime: "2026-01-28T09:00:00-07:00",
    endTime: "2026-01-28T09:30:00-07:00",
    durationMinutes: 30,
    modality: "In-Person",
    serviceType: "CHI",
    navigatorId: "nav1",
    verified: true,
    verifiedBy: "sup1",
    verifiedAt: "2026-01-28T17:00:00-07:00",
    billingPeriod: "2026-01",
    activityType: "PEER_SUPPORT", // -> H0038
  },
  {
    id: "tl-g12",
    patientId: "pt2",
    date: "2026-01-28",
    startTime: "2026-01-28T13:00:00-07:00",
    endTime: "2026-01-28T13:45:00-07:00",
    durationMinutes: 45,
    modality: "Phone",
    serviceType: "CHI",
    navigatorId: "nav1",
    verified: true,
    verifiedBy: "sup1",
    verifiedAt: "2026-01-28T17:00:00-07:00",
    billingPeriod: "2026-01",
    activityType: "PEER_SUPPORT", // -> H0038
  },
  {
    id: "tl-g13",
    patientId: "pt1",
    date: "2026-01-29",
    startTime: "2026-01-29T09:00:00-07:00",
    endTime: "2026-01-29T09:35:00-07:00",
    durationMinutes: 35,
    modality: "In-Person",
    serviceType: "CHI",
    navigatorId: "nav1",
    verified: true,
    verifiedBy: "sup1",
    verifiedAt: "2026-01-29T17:00:00-07:00",
    billingPeriod: "2026-01",
    activityType: "PEER_SUPPORT", // -> H0038
  },
  {
    id: "tl-g14",
    patientId: "pt2",
    date: "2026-01-29",
    startTime: "2026-01-29T13:00:00-07:00",
    endTime: "2026-01-29T13:30:00-07:00",
    durationMinutes: 30,
    modality: "Phone",
    serviceType: "CHI",
    navigatorId: "nav1",
    verified: true,
    verifiedBy: "sup1",
    verifiedAt: "2026-01-29T17:00:00-07:00",
    billingPeriod: "2026-01",
    activityType: "PEER_SUPPORT", // -> H0038
  },
  {
    id: "tl-g15",
    patientId: "pt1",
    date: "2026-01-30",
    startTime: "2026-01-30T09:00:00-07:00",
    endTime: "2026-01-30T09:45:00-07:00",
    durationMinutes: 45,
    modality: "In-Person",
    serviceType: "CHI",
    navigatorId: "nav1",
    verified: true,
    verifiedBy: "sup1",
    verifiedAt: "2026-01-30T17:00:00-07:00",
    billingPeriod: "2026-01",
    activityType: "PEER_SUPPORT", // -> H0038
  },
  {
    id: "tl-g16",
    patientId: "pt1",
    date: "2026-01-30",
    startTime: "2026-01-30T11:30:00-07:00",
    endTime: "2026-01-30T12:00:00-07:00",
    durationMinutes: 30,
    modality: "Phone",
    serviceType: "CHI",
    navigatorId: "nav1",
    verified: true,
    verifiedBy: "sup1",
    verifiedAt: "2026-01-30T17:00:00-07:00",
    billingPeriod: "2026-01",
    activityType: "PEER_SUPPORT", // -> H0038
  },
  {
    id: "tl-g17",
    patientId: "pt2",
    date: "2026-01-30",
    startTime: "2026-01-30T13:00:00-07:00",
    endTime: "2026-01-30T13:55:00-07:00",
    durationMinutes: 55,
    modality: "In-Person",
    serviceType: "CHI",
    navigatorId: "nav1",
    verified: true,
    verifiedBy: "sup1",
    verifiedAt: "2026-01-30T17:00:00-07:00",
    billingPeriod: "2026-01",
    activityType: "PEER_SUPPORT", // -> H0038
  },
  {
    id: "tl-g18",
    patientId: "pt4",
    date: "2026-01-30",
    startTime: "2026-01-30T15:00:00-07:00",
    endTime: "2026-01-30T15:06:00-07:00",
    durationMinutes: 6,
    modality: "Phone",
    serviceType: "CHI",
    navigatorId: "nav1",
    verified: true,
    verifiedBy: "sup1",
    verifiedAt: "2026-01-30T17:00:00-07:00",
    billingPeriod: "2026-01",
    activityType: "PEER_SUPPORT", // -> H0038
  },
  {
    id: "tl-g19",
    patientId: "pt5",
    date: "2026-01-30",
    startTime: "2026-01-30T15:30:00-07:00",
    endTime: "2026-01-30T16:05:00-07:00",
    durationMinutes: 35,
    modality: "Phone",
    serviceType: "CHI",
    navigatorId: "nav1",
    verified: true,
    verifiedBy: "sup1",
    verifiedAt: "2026-01-30T17:00:00-07:00",
    billingPeriod: "2026-01",
    activityType: "PEER_SUPPORT", // -> H0038
  },
]

// ============================================================================
// NAVIGATOR SAFETY MAP - Real-time Locations
// ============================================================================

/**
 * Initial navigator locations in Phoenix metro area
 * Demonstrates different safety statuses for the supervisor "God Mode" view
 */
export const initialNavigatorLocations: NavigatorLocation[] = [
  // Maria Gonzalez - ACTIVE, West Valley (Glendale)
  {
    id: "loc-maria",
    navigatorId: "nav-maria",
    navigatorName: "Maria Gonzalez",
    lat: 33.5387,
    lng: -112.1859, // Glendale - West Valley
    lastCheckIn: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 mins ago
    status: "ACTIVE",
    currentTask: "Transporting Patient",
    currentPatientId: "pt1",
    speed: 25, // In transit
    batteryLevel: 78,
  },
  // John Mitchell - RISK_ALERT, East Valley (Mesa) - Overdue check-out
  {
    id: "loc-john",
    navigatorId: "nav-john",
    navigatorName: "John Mitchell",
    lat: 33.4152,
    lng: -111.8315, // Mesa - East Valley
    lastCheckIn: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago - RISK!
    status: "RISK_ALERT",
    currentTask: "Home Visit (High Acuity)",
    currentPatientId: "pt3",
    speed: 0,
    batteryLevel: 15, // Low battery adds to concern
  },
  // Sarah Thompson - IDLE, Central (Downtown Phoenix)
  {
    id: "loc-sarah",
    navigatorId: "nav-sarah",
    navigatorName: "Sarah Thompson",
    lat: 33.4484,
    lng: -112.0740, // Downtown Phoenix - Central
    lastCheckIn: new Date(Date.now() - 20 * 60 * 1000).toISOString(), // 20 mins ago (>= IDLE_AFTER_MIN threshold)
    status: "IDLE",
    currentTask: "Documentation",
    speed: 0,
    batteryLevel: 62,
  },
]

// ============================================================================
// DIRECT MESSAGES (unified messaging - nudges are Messages with type "nudge")
// ============================================================================

export const initialDirectMessages: Message[] = [
  {
    id: "nudge-1",
    senderId: "sup1",
    senderName: "Marcus Williams",
    senderRole: "supervisor",
    receiverId: "nav-maria",
    receiverName: "Maria Gonzalez",
    receiverRole: "navigator",
    content: "Claim flagged: Missing 15 minutes of documented time for this month's billing cycle. Please add time logs to reach 60-minute minimum.",
    timestamp: "2026-01-30T09:15:00-07:00",
    readStatus: false,
    type: "nudge",
    patientId: "pt-billing",
    patientName: "Sam Underwood",
  },
  {
    id: "nudge-2",
    senderId: "sup1",
    senderName: "Marcus Williams",
    senderRole: "supervisor",
    receiverId: "nav-john",
    receiverName: "John Mitchell",
    receiverRole: "navigator",
    content: "Billing review: Patient Sam Underwood has only 45 minutes logged this month. Need additional 15 minutes documented for G0506 claim.",
    timestamp: "2026-01-30T10:30:00-07:00",
    readStatus: false,
    type: "nudge",
    patientId: "pt-billing",
    patientName: "Sam Underwood",
  },
  {
    id: "nudge-3",
    senderId: "sup1",
    senderName: "Marcus Williams",
    senderRole: "supervisor",
    receiverId: "nav-maria",
    receiverName: "Maria Gonzalez",
    receiverRole: "navigator",
    content: "PCP follow-up needed: Patient missed annual wellness visit. Please schedule appointment and document outreach.",
    timestamp: "2026-01-28T14:00:00-07:00",
    readStatus: false,
    type: "nudge",
    patientId: "pt1",
    patientName: "James Thompson",
  },
]

// ============================================================================
// GELLERT ZONES (billing/geo) — Gellert runs 11 zones; 6 seeded for the
// Phoenix-metro demo. Every zip exists in AZ_ZIP_CENTROIDS; no zip in 2 zones.
// ============================================================================

export const initialZones: Zone[] = [
  { id: "zone-central-phoenix", name: "Central Phoenix", color: "#0ea5e9", zipCodes: ["85001", "85012", "85034"], description: "Downtown core and central corridor" },
  { id: "zone-north-phoenix", name: "North Phoenix", color: "#8b5cf6", zipCodes: ["85021", "85032"], description: "North Phoenix and Paradise Valley Village" },
  { id: "zone-west-valley", name: "West Valley", color: "#f59e0b", zipCodes: ["85031", "85301", "85303", "85308", "85351", "85383"], description: "Maryvale, Glendale, Sun City, Peoria" },
  { id: "zone-east-valley", name: "East Valley", color: "#10b981", zipCodes: ["85201", "85204", "85296"], description: "Mesa and Gilbert" },
  { id: "zone-tempe-scottsdale", name: "Tempe / Scottsdale", color: "#ec4899", zipCodes: ["85008", "85251", "85281"], description: "Tempe, Scottsdale, East Phoenix" },
  { id: "zone-south-phoenix", name: "South Phoenix", color: "#ef4444", zipCodes: ["85044", "85339"], description: "Ahwatukee and Laveen" },
]

// ============================================================================
// JOURNEY EVENTS (Gellert WorkFlow2025) — full transition history for every
// seed patient, chronological; last toPhase always equals the stored phase.
// ============================================================================

export const initialJourneyEvents: JourneyEvent[] = [
  { id: "je-pt1-1", patientId: "pt1", at: "2025-12-01T10:00:00Z", fromPhase: "referral", toPhase: "intake", actorId: "sup1", actorName: "Marcus Williams", reason: "Referral converted; Intake 1 scheduled" },
  { id: "je-pt1-2", patientId: "pt1", at: "2025-12-12T15:00:00Z", fromPhase: "intake", toPhase: "active", actorId: "nav1", actorName: "Emily Rodriguez", reason: "Intake 2 complete; graduated to active navigation" },
  { id: "je-pt2-1", patientId: "pt2", at: "2025-12-05T10:00:00Z", fromPhase: "referral", toPhase: "intake", actorId: "sup1", actorName: "Marcus Williams", reason: "Referral converted; Intake 1 scheduled" },
  { id: "je-pt2-2", patientId: "pt2", at: "2025-12-16T14:00:00Z", fromPhase: "intake", toPhase: "active", actorId: "nav1", actorName: "Emily Rodriguez", reason: "Intake 2 complete; graduated to active navigation" },
  { id: "je-pt3-1", patientId: "pt3", at: "2025-12-28T10:00:00Z", fromPhase: "referral", toPhase: "intake", actorId: "sup1", actorName: "Marcus Williams", reason: "Referral converted; Intake 1 scheduled" },
  { id: "je-pt3-2", patientId: "pt3", at: "2026-01-08T15:30:00Z", fromPhase: "intake", toPhase: "active", actorId: "nav2", actorName: "David Chen", reason: "Intake 2 complete; graduated to active navigation" },
  { id: "je-pt4-1", patientId: "pt4", at: "2025-12-18T10:00:00Z", fromPhase: "referral", toPhase: "intake", actorId: "sup1", actorName: "Marcus Williams", reason: "Referral converted; Intake 1 scheduled" },
  { id: "je-pt4-2", patientId: "pt4", at: "2025-12-23T14:00:00Z", fromPhase: "intake", toPhase: "active", actorId: "nav2", actorName: "David Chen", reason: "Intake 2 complete; graduated to active navigation" },
  { id: "je-pt4-3", patientId: "pt4", at: "2025-12-24T16:00:00Z", fromPhase: "active", toPhase: "telenavigation", actorId: "sup1", actorName: "Marcus Williams", reason: "Graduation confirmed; monthly telenavigation cadence begins" },
  { id: "je-pt5-1", patientId: "pt5", at: "2025-12-30T10:00:00Z", fromPhase: "referral", toPhase: "intake", actorId: "sup1", actorName: "Marcus Williams", reason: "Referral converted; Intake 1 scheduled" },
  { id: "je-pt5-2", patientId: "pt5", at: "2026-01-09T15:00:00Z", fromPhase: "intake", toPhase: "active", actorId: "nav3", actorName: "Maria Santos", reason: "Intake 2 complete; graduated to active navigation" },
  { id: "je-ptbilling-1", patientId: "pt-billing", at: "2026-01-01T10:00:00Z", fromPhase: "referral", toPhase: "intake", actorId: "sup1", actorName: "Marcus Williams", reason: "Referral from St. Joseph's converted; Intake 1 scheduled" },
  { id: "je-ptbilling-2", patientId: "pt-billing", at: "2026-01-10T14:00:00Z", fromPhase: "intake", toPhase: "active", actorId: "nav-john", actorName: "John Mitchell", reason: "Intake 2 complete; graduated to active navigation" },
  { id: "je-ptval-1", patientId: "pt-validation-test", at: "2026-01-05T10:00:00Z", fromPhase: "referral", toPhase: "intake", actorId: "sup1", actorName: "Marcus Williams", reason: "Referral converted; Intake 1 scheduled" },
  { id: "je-ptval-2", patientId: "pt-validation-test", at: "2026-01-16T14:00:00Z", fromPhase: "intake", toPhase: "active", actorId: "nav-maria", actorName: "Maria Gonzalez", reason: "Intake 2 complete; graduated to active navigation" },
  { id: "je-ptelena-1", patientId: "pt-elena", at: "2026-01-28T11:00:00Z", fromPhase: "referral", toPhase: "intake", actorId: "sup1", actorName: "Marcus Williams", reason: "Referral from Banner Health converted; Intake 1 scheduled" },
  { id: "je-ptelena-2", patientId: "pt-elena", at: "2026-01-30T12:00:00Z", fromPhase: "intake", toPhase: "active", actorId: "nav-maria", actorName: "Maria Gonzalez", reason: "Intake 2 complete; graduated to active navigation" },
  { id: "je-ptji1-1", patientId: "pt-journey-intake1", at: "2026-01-28T10:00:00Z", fromPhase: "referral", toPhase: "intake", actorId: "sup1", actorName: "Marcus Williams", reason: "Referral from St. Joseph's converted; Intake 1 scheduled for Feb 1" },
  { id: "je-ptji2-1", patientId: "pt-journey-intake2", at: "2026-01-15T10:00:00Z", fromPhase: "referral", toPhase: "intake", actorId: "sup1", actorName: "Marcus Williams", reason: "Referral from St. Joseph's converted; Intake 1 scheduled" },
  { id: "je-ptjx-1", patientId: "pt-journey-exited", at: "2025-12-10T10:00:00Z", fromPhase: "referral", toPhase: "intake", actorId: "sup1", actorName: "Marcus Williams", reason: "Referral from Mercy Care converted; Intake 1 scheduled" },
  { id: "je-ptjx-2", patientId: "pt-journey-exited", at: "2025-12-22T14:00:00Z", fromPhase: "intake", toPhase: "active", actorId: "nav8", actorName: "Kevin Martinez", reason: "Intake 2 complete; graduated to active navigation" },
  { id: "je-ptjx-3", patientId: "pt-journey-exited", at: "2026-01-18T16:00:00Z", fromPhase: "active", toPhase: "exited", actorId: "nav8", actorName: "Kevin Martinez", reason: "Patient-initiated exit (relocation); supervisor confirmed" },
]

// ============================================================================
// CHARGE SLIPS (Gellert day-close) — only SIGNED slips persist; unsigned
// slips are derived on the fly. ~7 workdays of history, ~90% signed same-day;
// TODAY's patient-days (2026-01-30 logs) are deliberately unsigned so the
// day-close demo runs live. timeLogIds/totalMinutes/units mirror the seed
// TimeLogs exactly (verify:gellert locks slip integrity).
// ============================================================================

export const initialChargeSlips: ChargeSlip[] = [
  { id: "slip-nav1-pt1-2026-01-21", navigatorId: "nav1", patientId: "pt1", date: "2026-01-21", timeLogIds: ["tl-g01"], totalMinutes: 45, units: 3, code: "H0038", signedAt: "2026-01-21T17:05:00Z", signedBy: "nav1" },
  { id: "slip-nav1-pt1-2026-01-22", navigatorId: "nav1", patientId: "pt1", date: "2026-01-22", timeLogIds: ["tl-g03"], totalMinutes: 25, units: 2, code: "H0038", signedAt: "2026-01-22T17:05:00Z", signedBy: "nav1" },
  { id: "slip-nav1-pt1-2026-01-23", navigatorId: "nav1", patientId: "pt1", date: "2026-01-23", timeLogIds: ["tl-g05"], totalMinutes: 30, units: 2, code: "H0038", signedAt: "2026-01-23T17:05:00Z", signedBy: "nav1" },
  { id: "slip-nav1-pt1-2026-01-26", navigatorId: "nav1", patientId: "pt1", date: "2026-01-26", timeLogIds: ["tl-g07"], totalMinutes: 50, units: 3, code: "H0038", signedAt: "2026-01-26T17:05:00Z", signedBy: "nav1" },
  { id: "slip-nav1-pt1-2026-01-27", navigatorId: "nav1", patientId: "pt1", date: "2026-01-27", timeLogIds: ["tl-g09"], totalMinutes: 40, units: 3, code: "H0038", signedAt: "2026-01-27T17:05:00Z", signedBy: "nav1" },
  { id: "slip-nav1-pt1-2026-01-28", navigatorId: "nav1", patientId: "pt1", date: "2026-01-28", timeLogIds: ["tl-g11"], totalMinutes: 30, units: 2, code: "H0038", signedAt: "2026-01-28T17:05:00Z", signedBy: "nav1" },
  { id: "slip-nav1-pt1-2026-01-29", navigatorId: "nav1", patientId: "pt1", date: "2026-01-29", timeLogIds: ["tl-g13"], totalMinutes: 35, units: 2, code: "H0038", signedAt: "2026-01-29T17:05:00Z", signedBy: "nav1" },
  { id: "slip-nav1-pt2-2026-01-21", navigatorId: "nav1", patientId: "pt2", date: "2026-01-21", timeLogIds: ["tl-g02"], totalMinutes: 30, units: 2, code: "H0038", signedAt: "2026-01-21T17:05:00Z", signedBy: "nav1" },
  { id: "slip-nav1-pt2-2026-01-22", navigatorId: "nav1", patientId: "pt2", date: "2026-01-22", timeLogIds: ["tl-g04"], totalMinutes: 40, units: 3, code: "H0038", signedAt: "2026-01-22T17:05:00Z", signedBy: "nav1" },
  { id: "slip-nav1-pt2-2026-01-23", navigatorId: "nav1", patientId: "pt2", date: "2026-01-23", timeLogIds: ["tl-g06"], totalMinutes: 20, units: 1, code: "H0038", signedAt: "2026-01-24T17:05:00Z", signedBy: "nav1" },
  { id: "slip-nav1-pt2-2026-01-26", navigatorId: "nav1", patientId: "pt2", date: "2026-01-26", timeLogIds: ["tl-g08"], totalMinutes: 35, units: 2, code: "H0038", signedAt: "2026-01-26T17:05:00Z", signedBy: "nav1" },
  { id: "slip-nav1-pt2-2026-01-27", navigatorId: "nav1", patientId: "pt2", date: "2026-01-27", timeLogIds: ["tl-g10"], totalMinutes: 25, units: 2, code: "H0038", signedAt: "2026-01-27T17:05:00Z", signedBy: "nav1" },
  { id: "slip-nav1-pt2-2026-01-28", navigatorId: "nav1", patientId: "pt2", date: "2026-01-28", timeLogIds: ["tl-g12"], totalMinutes: 45, units: 3, code: "H0038", signedAt: "2026-01-28T17:05:00Z", signedBy: "nav1" },
  { id: "slip-nav1-pt2-2026-01-29", navigatorId: "nav1", patientId: "pt2", date: "2026-01-29", timeLogIds: ["tl-g14"], totalMinutes: 30, units: 2, code: "H0038", signedAt: "2026-01-29T17:05:00Z", signedBy: "nav1" },
  { id: "slip-nav2-pt4-2026-01-21", navigatorId: "nav2", patientId: "pt4", date: "2026-01-21", timeLogIds: ["tl-021"], totalMinutes: 55, units: 4, code: "H0038", signedAt: "2026-01-21T17:05:00Z", signedBy: "nav2" },
  { id: "slip-nav3-pt5-2026-01-23", navigatorId: "nav3", patientId: "pt5", date: "2026-01-23", timeLogIds: ["tl-024"], totalMinutes: 60, units: 4, code: "H0038", signedAt: "2026-01-23T17:05:00Z", signedBy: "nav3" },
  { id: "slip-nav-maria-pt2-2026-01-24", navigatorId: "nav-maria", patientId: "pt2", date: "2026-01-24", timeLogIds: ["tl-019"], totalMinutes: 30, units: 2, code: "H0038", signedAt: "2026-01-25T17:05:00Z", signedBy: "nav-maria" },
  { id: "slip-nav-maria-pt1-2026-01-26", navigatorId: "nav-maria", patientId: "pt1", date: "2026-01-26", timeLogIds: ["tl-015"], totalMinutes: 40, units: 3, code: "H0038", signedAt: "2026-01-26T17:05:00Z", signedBy: "nav-maria" },
  { id: "slip-nav2-pt4-2026-01-27", navigatorId: "nav2", patientId: "pt4", date: "2026-01-27", timeLogIds: ["tl-022"], totalMinutes: 30, units: 2, code: "H0038", signedAt: "2026-01-27T17:05:00Z", signedBy: "nav2" },
  { id: "slip-nav3-pt5-2026-01-28", navigatorId: "nav3", patientId: "pt5", date: "2026-01-28", timeLogIds: ["tl-025"], totalMinutes: 25, units: 2, code: "H0038", signedAt: "2026-01-28T17:05:00Z", signedBy: "nav3" },
  { id: "slip-nav-maria-pt-elena-2026-01-28", navigatorId: "nav-maria", patientId: "pt-elena", date: "2026-01-28", timeLogIds: ["tl-026"], totalMinutes: 60, units: 4, code: "H0038", signedAt: "2026-01-28T17:05:00Z", signedBy: "nav-maria" },
  { id: "slip-nav-maria-pt1-2026-01-29", navigatorId: "nav-maria", patientId: "pt1", date: "2026-01-29", timeLogIds: ["tl-016"], totalMinutes: 20, units: 1, code: "H0038", signedAt: "2026-01-29T17:05:00Z", signedBy: "nav-maria" },
  { id: "slip-nav-maria-pt-elena-2026-01-29", navigatorId: "nav-maria", patientId: "pt-elena", date: "2026-01-29", timeLogIds: ["tl-027"], totalMinutes: 30, units: 2, code: "H0038", signedAt: "2026-01-29T17:05:00Z", signedBy: "nav-maria" },
]

// ============================================================================
// PROVIDER DIRECTORY & STANDING PATIENT FACTS (Gellert note system)
// The cut-and-paste killer: provider names/practices/addresses live here once
// and auto-fill into notes instead of being retyped per note.
// ============================================================================

export const initialProviders: Provider[] = [
  {
    id: "prov-pcp-smith",
    name: "Dr. Jane Smith",
    credential: "MD",
    specialty: "Family Medicine",
    practiceName: "Desert Family Medicine",
    address: { street: "4045 W Main St", city: "Phoenix", state: "AZ", zip: "85004" },
    phone: "(602) 555-0140",
    type: "pcp",
  },
  {
    id: "prov-pcp-okafor",
    name: "Dr. Daniel Okafor",
    credential: "DO",
    specialty: "Internal Medicine",
    practiceName: "Camelback Primary Care",
    address: { street: "5040 N 15th Ave", city: "Phoenix", state: "AZ", zip: "85015" },
    phone: "(602) 555-0141",
    type: "pcp",
  },
  {
    id: "prov-cardio-patel",
    name: "Dr. Anita Patel",
    credential: "MD",
    specialty: "Cardiology",
    practiceName: "Heart & Vascular Institute of Arizona",
    address: { street: "1331 N 7th St, Suite 375", city: "Phoenix", state: "AZ", zip: "85006" },
    phone: "(602) 555-0142",
    type: "specialist",
  },
  {
    id: "prov-bh-copper-sky",
    name: "Copper Sky Behavioral Health",
    specialty: "Outpatient Behavioral Health Clinic",
    practiceName: "Copper Sky Behavioral Health",
    address: { street: "2222 E Thomas Rd", city: "Phoenix", state: "AZ", zip: "85016" },
    phone: "(602) 555-0143",
    type: "behavioral_health",
  },
  {
    id: "prov-psych-nguyen",
    name: "Dr. Robert Nguyen",
    credential: "MD",
    specialty: "Psychiatry",
    practiceName: "Copper Sky Behavioral Health",
    address: { street: "2222 E Thomas Rd", city: "Phoenix", state: "AZ", zip: "85016" },
    phone: "(602) 555-0144",
    type: "behavioral_health",
  },
  {
    id: "prov-lab-labcorp",
    name: "LabCorp Patient Service Center",
    specialty: "Clinical Laboratory",
    practiceName: "LabCorp — Phoenix Central",
    address: { street: "1300 N 12th St, Suite 300", city: "Phoenix", state: "AZ", zip: "85006" },
    phone: "(602) 555-0145",
    type: "lab_imaging",
  },
  {
    id: "prov-imaging-simonmed",
    name: "SimonMed Imaging",
    specialty: "Diagnostic Imaging",
    practiceName: "SimonMed Imaging — Mesa",
    address: { street: "6634 E Baseline Rd", city: "Mesa", state: "AZ", zip: "85206" },
    phone: "(480) 555-0146",
    type: "lab_imaging",
  },
  {
    id: "prov-pharm-walgreens",
    name: "Walgreens Pharmacy",
    specialty: "Retail Pharmacy",
    practiceName: "Walgreens #04521",
    address: { street: "1610 E Camelback Rd", city: "Phoenix", state: "AZ", zip: "85016" },
    phone: "(602) 555-0147",
    type: "pharmacy",
  },
  {
    id: "prov-pharm-cvs",
    name: "CVS Pharmacy",
    specialty: "Retail Pharmacy",
    practiceName: "CVS #08842",
    address: { street: "5940 W Glendale Ave", city: "Glendale", state: "AZ", zip: "85301" },
    phone: "(623) 555-0148",
    type: "pharmacy",
  },
]

// Durable per-patient facts the auto-fill layer recalls across notes.
// pt1 is the field anecdote: diabetic patient with a colonoscopy due.
export const initialStandingFacts: StandingPatientFacts[] = [
  {
    patientId: "pt1",
    diabetic: true,
    colonoscopy: { status: "due", note: "Overdue since November; patient agreed to scheduling support at the January visit" },
    preferredPharmacyProviderId: "prov-pharm-walgreens",
    updatedAt: "2026-01-24T17:30:00Z",
    updatedBy: "nav1",
  },
  {
    patientId: "pt2",
    diabetic: false,
    colonoscopy: { status: "up_to_date", note: "Completed 2024" },
    mammogram: { status: "up_to_date", note: "Completed September 2025" },
    preferredPharmacyProviderId: "prov-pharm-cvs",
    updatedAt: "2026-01-19T22:30:00Z",
    updatedBy: "nav1",
  },
  {
    patientId: "pt3",
    colonoscopy: { status: "declined", note: "Declined screening discussion at the January cardiology visit; revisit in six months" },
    updatedAt: "2026-01-15T21:30:00Z",
    updatedBy: "nav2",
  },
  {
    patientId: "pt4",
    mammogram: { status: "due", note: "Due this quarter; reminder set for the next telenavigation check-in" },
    updatedAt: "2026-01-10T18:00:00Z",
    updatedBy: "nav2",
  },
  {
    patientId: "pt5",
    diabetic: true,
    colonoscopy: { status: "never", note: "Never screened; education provided January 21" },
    preferredPharmacyProviderId: "prov-pharm-walgreens",
    updatedAt: "2026-01-21T22:00:00Z",
    updatedBy: "nav3",
  },
]
