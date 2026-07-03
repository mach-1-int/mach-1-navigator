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
  Appointment,
  User,
  HealthPlanRevenue,
  ReferralSource,
  BillingData,
  CareTemplate,
  CarePlan,
  PayerRate,
  AuditLog,
  NoteTemplate,
  SupervisorMessage,
  // CMS Billing Types (Phase 2.1)
  CPTDefinition,
  ZCode,
  // Navigator Safety Map
  NavigatorLocation,
} from "./types"

// ============================================================================
// USERS
// ============================================================================

export const initialUsers: User[] = [
  { id: "exec1", name: "Dr. Sarah Chen", role: "executive", email: "sarah.chen@gellert.health" },
  { id: "sup1", name: "Marcus Williams", role: "supervisor", email: "marcus.williams@gellert.health" },
  { id: "nav1", name: "Emily Rodriguez", role: "navigator", email: "emily.rodriguez@gellert.health" },
  { id: "pt1", name: "James Thompson", role: "patient", email: "james.t@email.com" },
  { id: "pt-elena", name: "Elena Rodriguez", role: "patient", email: "elena.rodriguez@email.com" }, // Patient Portal demo
  { id: "admin1", name: "Alex Rivera", role: "admin", email: "alex.rivera@gellert.health" },
  { id: "biller1", name: "Revenue Cycle Manager", role: "biller", email: "billing@gellert.health" },
  // Matching Engine Test Navigators
  {
    id: "nav-maria",
    name: "Maria Gonzalez",
    role: "navigator",
    email: "maria.gonzalez@gellert.health",
    attributes: {
      homeZipCode: "85301", // Glendale - West Valley
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
    attributes: {
      homeZipCode: "85201", // Mesa - East Valley
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
    attributes: {
      homeZipCode: "85001", // Central Phoenix
      serviceAreaRadius: 25,
      languages: ["en"],
      currentCaseload: 10, // Low caseload, lots of availability
      maxCaseload: 50,
      acuityCapabilities: ["L1", "L2", "L3"], // Can handle high risk (L3)
    },
  },
]

// ============================================================================
// SUPERVISORS
// ============================================================================

export const initialSupervisors: Supervisor[] = [
  { id: "sup1", name: "Marcus Williams", navigatorIds: ["nav1", "nav2", "nav3"], region: "Phoenix Metro" },
  { id: "sup2", name: "Jennifer Adams", navigatorIds: ["nav4", "nav5"], region: "Tucson" },
  { id: "sup3", name: "Robert Kim", navigatorIds: ["nav6", "nav7", "nav8"], region: "Mesa/Tempe" },
]

// ============================================================================
// NAVIGATORS
// ============================================================================

export const initialNavigators: Navigator[] = [
  { id: "nav1", name: "Emily Rodriguez", supervisorId: "sup1", monthlyUnits: 285, mtdUnits: 142, adverseEventCount: 2, cancellations: 3, medicationCompliance: 96, pcpCompliance: 94, highFivePercentage: 92, engagementScore: 88, lengthOfService: 24, patientCount: 45 },
  { id: "nav2", name: "David Chen", supervisorId: "sup1", monthlyUnits: 312, mtdUnits: 156, adverseEventCount: 1, cancellations: 1, medicationCompliance: 98, pcpCompliance: 97, highFivePercentage: 95, engagementScore: 91, lengthOfService: 36, patientCount: 52 },
  { id: "nav3", name: "Maria Santos", supervisorId: "sup1", monthlyUnits: 198, mtdUnits: 99, adverseEventCount: 4, cancellations: 6, medicationCompliance: 89, pcpCompliance: 85, highFivePercentage: 78, engagementScore: 72, lengthOfService: 8, patientCount: 38 },
  // Matching-engine test navigators (Geography, Language, Load QA)
  { id: "nav-maria", name: "Maria Gonzalez", supervisorId: "sup1", monthlyUnits: 198, mtdUnits: 99, adverseEventCount: 2, cancellations: 4, medicationCompliance: 90, pcpCompliance: 86, highFivePercentage: 80, engagementScore: 75, lengthOfService: 8, patientCount: 35 },
  { id: "nav-john", name: "John Mitchell", supervisorId: "sup1", monthlyUnits: 260, mtdUnits: 130, adverseEventCount: 1, cancellations: 2, medicationCompliance: 94, pcpCompliance: 92, highFivePercentage: 86, engagementScore: 82, lengthOfService: 14, patientCount: 48 },
  { id: "nav-sarah", name: "Sarah Thompson", supervisorId: "sup1", monthlyUnits: 120, mtdUnits: 60, adverseEventCount: 0, cancellations: 1, medicationCompliance: 96, pcpCompliance: 94, highFivePercentage: 90, engagementScore: 88, lengthOfService: 4, patientCount: 10 },
  { id: "nav4", name: "John Park", supervisorId: "sup2", monthlyUnits: 267, mtdUnits: 133, adverseEventCount: 2, cancellations: 2, medicationCompliance: 94, pcpCompliance: 92, highFivePercentage: 88, engagementScore: 85, lengthOfService: 18, patientCount: 42 },
  { id: "nav5", name: "Lisa Brown", supervisorId: "sup2", monthlyUnits: 245, mtdUnits: 122, adverseEventCount: 3, cancellations: 4, medicationCompliance: 91, pcpCompliance: 89, highFivePercentage: 84, engagementScore: 80, lengthOfService: 12, patientCount: 40 },
  { id: "nav6", name: "Michael Lee", supervisorId: "sup3", monthlyUnits: 298, mtdUnits: 149, adverseEventCount: 1, cancellations: 2, medicationCompliance: 97, pcpCompliance: 95, highFivePercentage: 93, engagementScore: 89, lengthOfService: 30, patientCount: 48 },
  { id: "nav7", name: "Sarah Johnson", supervisorId: "sup3", monthlyUnits: 178, mtdUnits: 89, adverseEventCount: 5, cancellations: 7, medicationCompliance: 86, pcpCompliance: 82, highFivePercentage: 74, engagementScore: 68, lengthOfService: 6, patientCount: 35 },
  { id: "nav8", name: "Kevin Martinez", supervisorId: "sup3", monthlyUnits: 256, mtdUnits: 128, adverseEventCount: 2, cancellations: 3, medicationCompliance: 93, pcpCompliance: 91, highFivePercentage: 86, engagementScore: 82, lengthOfService: 15, patientCount: 41 },
]

// ============================================================================
// PATIENTS
// ============================================================================

export const initialPatients: Patient[] = [
  {
    id: "pt1", name: "James Thompson", dob: "1952-03-15", chartNumber: "GH-2024-001", riskLevel: 3, survivalStatus: "active",
    assignedNavigator: "nav1", assignedSupervisor: "sup1", healthPlan: "United Healthcare", enrollmentDate: "2024-06-01",
    lastContactDate: "2026-01-24", medicationCompliance: 85, pcpCompliance: true,
    upcomingAppointments: [{ id: "apt1", patientId: "pt1", navigatorId: "nav1", date: "2026-01-28", time: "10:00", type: "home_visit", status: "scheduled" }],
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
  },
  {
    id: "pt2", name: "Dorothy Martinez", dob: "1948-07-22", chartNumber: "GH-2024-002", riskLevel: 2, survivalStatus: "active",
    assignedNavigator: "nav1", assignedSupervisor: "sup1", healthPlan: "Mercy Care", enrollmentDate: "2024-08-15",
    lastContactDate: "2026-01-22", medicationCompliance: 92, pcpCompliance: true,
    upcomingAppointments: [{ id: "apt2", patientId: "pt2", navigatorId: "nav1", date: "2026-01-29", time: "14:00", type: "phone_call", status: "scheduled" }],
    medications: [
      { id: "med3", name: "Atorvastatin", dosage: "20mg", frequency: "Once daily", nextRefillDate: "2026-02-10", compliance: true },
    ],
    adverseEvents: [],
    lat: 33.4942, lng: -112.1401, // West Phoenix
    // CMS Billing Track (Phase 2.1)
    billingTrack: "CHI", // Community Health Integration - SDOH focus
    primaryDiagnosis: "Congestive Heart Failure (I50.9)",
    icdCodes: ["I50.9", "I25.10", "Z96.1"], // CHF, CAD, Pacemaker
  },
  {
    id: "pt3", name: "Robert Wilson", dob: "1945-11-08", chartNumber: "GH-2024-003", riskLevel: 3, survivalStatus: "active",
    assignedNavigator: "nav2", assignedSupervisor: "sup1", healthPlan: "United Healthcare", enrollmentDate: "2024-05-20",
    lastContactDate: "2026-01-20", medicationCompliance: 78, pcpCompliance: false,
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
  },
  {
    id: "pt4", name: "Helen Garcia", dob: "1950-04-30", chartNumber: "GH-2024-004", riskLevel: 1, survivalStatus: "active",
    assignedNavigator: "nav2", assignedSupervisor: "sup1", healthPlan: "Molina", enrollmentDate: "2024-09-01",
    lastContactDate: "2026-01-25", medicationCompliance: 98, pcpCompliance: true,
    upcomingAppointments: [{ id: "apt3", patientId: "pt4", navigatorId: "nav2", date: "2026-02-01", time: "09:00", type: "video_call", status: "scheduled" }],
    medications: [
      { id: "med6", name: "Amlodipine", dosage: "5mg", frequency: "Once daily", nextRefillDate: "2026-02-15", compliance: true },
    ],
    adverseEvents: [],
    lat: 33.5091, lng: -111.8987, // Scottsdale
    billingTrack: "CHI", // Community Health Integration - lower acuity
    primaryDiagnosis: "Essential Hypertension (I10)",
    icdCodes: ["I10", "E78.0"], // Hypertension, Pure hypercholesterolemia
  },
  {
    id: "pt5", name: "Frank Anderson", dob: "1943-09-12", chartNumber: "GH-2024-005", riskLevel: 3, survivalStatus: "active",
    assignedNavigator: "nav3", assignedSupervisor: "sup1", healthPlan: "United Healthcare", enrollmentDate: "2024-04-10",
    lastContactDate: "2026-01-18", medicationCompliance: 72, pcpCompliance: false,
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
  },
  // Billing Bridge test patient: single 45-min note → Needs Attention (Test A); add 30+30 mins in app for Test B/C
  {
    id: "pt-billing",
    name: "Sam Underwood",
    dob: "1960-05-14",
    chartNumber: "GH-2026-BILL",
    riskLevel: 2,
    survivalStatus: "active",
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
  },
  // Validation test patient: MISSING ICD codes → should appear in "Needs Attention"
  {
    id: "pt-validation-test",
    name: "Mary Jenkins",
    dob: "1955-03-22",
    chartNumber: "GH-2026-VAL",
    riskLevel: 2,
    survivalStatus: "active",
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
        notes: "Pharmacy Pickup - CVS on Glendale Ave"
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
  },
]

// ============================================================================
// APPOINTMENTS (Standalone collection - synced with patient.upcomingAppointments)
// ============================================================================

export const initialAppointments: Appointment[] = [
  { id: "apt1", patientId: "pt1", navigatorId: "nav1", date: "2026-01-28", time: "10:00", type: "home_visit", status: "scheduled" },
  { id: "apt2", patientId: "pt2", navigatorId: "nav1", date: "2026-01-29", time: "14:00", type: "phone_call", status: "scheduled" },
  { id: "apt3", patientId: "pt4", navigatorId: "nav2", date: "2026-02-01", time: "09:00", type: "video_call", status: "scheduled" },
  // Elena's pharmacy pickup for Patient Portal demo
  { id: "apt-elena-pharmacy", patientId: "pt-elena", navigatorId: "nav-maria", date: "2026-02-02", time: "14:00", type: "clinic", status: "scheduled", notes: "Pharmacy Pickup - CVS on Glendale Ave" },
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

export const initialReferrals: Referral[] = [
  // ============================================================================
  // MATCHING ENGINE TEST REFERRALS
  // ============================================================================
  // Elena Rodriguez - Should match Maria (Spanish speaker in West Valley)
  {
    id: "ref-elena",
    receivedAt: "2026-01-28T09:00:00Z",
    source: "Banner Health",
    rawData: {
      PID: {
        patientName: "Elena Rodriguez",
        dob: "1958-06-12",
        gender: "F",
        address: {
          street: "2145 W Glendale Ave",
          city: "Phoenix",
          state: "AZ",
          zip: "85303" // West Valley Patient
        },
        phone: "(623) 555-0189",
        email: "elena.rodriguez@email.com"
      },
      DG1: {
        primaryDiagnosis: "Type 2 Diabetes with peripheral neuropathy",
        icdCodes: ["E11.42", "G63.2"],
        diagnosisDate: "2026-01-25"
      },
      IN1: {
        payerName: "Mercy Care",
        payerId: "MC-AZ",
        memberId: "MC789456123"
      },
      PV1: {
        referringPhysician: "Dr. Ana Martinez",
        facilityName: "Banner Estrella Medical Center"
      }
    },
    status: "pending",
    patientName: "Elena Rodriguez",
    dob: "1958-06-12",
    referralSource: "Banner Health",
    riskScore: 2,
    referralDate: "2026-01-28",
    diagnosis: "Type 2 Diabetes with neuropathy",
    healthPlan: "Mercy Care",
    // Matching engine fields
    zipCode: "85303",
    language: "es", // Spanish speaker - critical match factor
    requiredAcuity: "L2",
  },
  // Mike Smith - Should match John (East Valley, but warn about capacity)
  {
    id: "ref-mike",
    receivedAt: "2026-01-28T10:30:00Z",
    source: "HonorHealth",
    rawData: {
      PID: {
        patientName: "Mike Smith",
        dob: "1962-09-23",
        gender: "M",
        address: {
          street: "4567 E Main St",
          city: "Mesa",
          state: "AZ",
          zip: "85201" // East Valley - Mesa
        },
        phone: "(480) 555-0234",
        email: "mike.smith62@email.com"
      },
      DG1: {
        primaryDiagnosis: "Essential Hypertension",
        icdCodes: ["I10"],
        diagnosisDate: "2026-01-26"
      },
      IN1: {
        payerName: "United Healthcare",
        payerId: "UHC-AZ",
        memberId: "UHC456789123"
      },
      PV1: {
        referringPhysician: "Dr. Robert Chen",
        facilityName: "HonorHealth Scottsdale"
      }
    },
    status: "pending",
    patientName: "Mike Smith",
    dob: "1962-09-23",
    referralSource: "HonorHealth",
    riskScore: 1,
    referralDate: "2026-01-28",
    diagnosis: "Essential Hypertension",
    healthPlan: "United Healthcare",
    // Matching engine fields
    zipCode: "85201",
    language: "en",
    requiredAcuity: "L1",
  },
  // David Jones - Should strictly match Sarah (L3 requirement)
  {
    id: "ref-david",
    receivedAt: "2026-01-28T11:45:00Z",
    source: "Valleywise Health",
    rawData: {
      PID: {
        patientName: "David Jones",
        dob: "1945-02-14",
        gender: "M",
        address: {
          street: "789 N Central Ave",
          city: "Phoenix",
          state: "AZ",
          zip: "85001" // Central Phoenix
        },
        phone: "(602) 555-0345",
        email: "d.jones45@email.com"
      },
      DG1: {
        primaryDiagnosis: "End Stage Renal Disease on Hemodialysis with CHF",
        icdCodes: ["N18.6", "I50.9", "Z99.2"],
        diagnosisDate: "2026-01-20"
      },
      IN1: {
        payerName: "AHCCCS",
        payerId: "AHCCCS-AZ",
        memberId: "AHC987654321"
      },
      PV1: {
        admitDate: "2026-01-15",
        dischargeDate: "2026-01-27",
        attendingPhysician: "Dr. Lisa Wong",
        referringPhysician: "Dr. James Park",
        facilityName: "Valleywise Medical Center"
      }
    },
    status: "pending",
    patientName: "David Jones",
    dob: "1945-02-14",
    referralSource: "Valleywise Health",
    riskScore: 3,
    referralDate: "2026-01-28",
    diagnosis: "ESRD on Dialysis, CHF",
    healthPlan: "AHCCCS",
    // Matching engine fields
    zipCode: "85001",
    language: "en",
    requiredAcuity: "L3", // High risk - only Sarah can handle
  },
  // ============================================================================
  // ORIGINAL REFERRALS (updated with matching fields)
  // ============================================================================
  {
    id: "ref1",
    receivedAt: "2026-01-25T14:32:00Z",
    source: "Dignity Health",
    rawData: {
      PID: {
        patientName: "William Anderson",
        dob: "1948-03-15",
        gender: "M",
        ssn: "***-**-4521",
        address: {
          street: "4521 W Camelback Rd",
          city: "Phoenix",
          state: "AZ",
          zip: "85031"
        },
        phone: "(602) 555-0147",
        email: "w.anderson48@email.com"
      },
      DG1: {
        primaryDiagnosis: "Congestive Heart Failure with COPD and Type 2 Diabetes",
        icdCodes: ["I50.9", "J44.9", "E11.9"],
        diagnosisDate: "2026-01-20"
      },
      IN1: {
        payerName: "United Healthcare",
        payerId: "UHC-AZ",
        memberId: "UHC987654321",
        groupNumber: "GRP-001"
      },
      PV1: {
        admitDate: "2026-01-18",
        dischargeDate: "2026-01-24",
        attendingPhysician: "Dr. Michael Torres",
        referringPhysician: "Dr. Sarah Kim",
        facilityName: "Dignity Health St. Joseph's"
      }
    },
    status: "pending",
    // Denormalized fields
    patientName: "William Anderson",
    dob: "1948-03-15",
    referralSource: "Dignity Health",
    riskScore: 3,
    referralDate: "2026-01-25",
    diagnosis: "CHF, COPD, Type 2 Diabetes",
    healthPlan: "United Healthcare",
    // Matching engine fields
    zipCode: "85031",
    language: "en",
    requiredAcuity: "L3",
  },
  {
    id: "ref2",
    receivedAt: "2026-01-24T09:15:00Z",
    source: "Banner Health",
    rawData: {
      PID: {
        patientName: "Patricia Moore",
        dob: "1955-08-22",
        gender: "F",
        address: {
          street: "789 E Indian School Rd",
          city: "Scottsdale",
          state: "AZ",
          zip: "85251"
        },
        phone: "(480) 555-0198"
      },
      DG1: {
        primaryDiagnosis: "Essential Hypertension with Chronic Kidney Disease Stage 3",
        icdCodes: ["I10", "N18.3"],
        diagnosisDate: "2026-01-22"
      },
      IN1: {
        payerName: "Mercy Care",
        payerId: "MC-AZ",
        memberId: "MC123456789"
      },
      PV1: {
        referringPhysician: "Dr. James Chen",
        facilityName: "Banner Desert Medical Center"
      }
    },
    status: "pending",
    patientName: "Patricia Moore",
    dob: "1955-08-22",
    referralSource: "Banner Health",
    riskScore: 2,
    referralDate: "2026-01-24",
    diagnosis: "Hypertension, CKD Stage 3",
    healthPlan: "Mercy Care",
    // Matching engine fields
    zipCode: "85251",
    language: "en",
    requiredAcuity: "L2",
  },
  {
    id: "ref3",
    receivedAt: "2026-01-23T16:45:00Z",
    source: "Valleywise Health",
    rawData: {
      PID: {
        patientName: "George Taylor",
        dob: "1942-11-08",
        gender: "M",
        address: {
          street: "2340 S 24th St",
          city: "Phoenix",
          state: "AZ",
          zip: "85034"
        },
        phone: "(602) 555-0234",
        email: "g.taylor42@email.com"
      },
      DG1: {
        primaryDiagnosis: "End Stage Renal Disease on Hemodialysis with Coronary Artery Disease",
        icdCodes: ["N18.6", "I25.10", "Z99.2"],
        diagnosisDate: "2026-01-15"
      },
      IN1: {
        payerName: "AHCCCS",
        payerId: "AHCCCS-AZ",
        memberId: "AHC567891234"
      },
      PV1: {
        admitDate: "2026-01-12",
        dischargeDate: "2026-01-22",
        attendingPhysician: "Dr. Robert Martinez",
        referringPhysician: "Dr. Lisa Wong",
        facilityName: "Valleywise Medical Center"
      }
    },
    status: "pending",
    patientName: "George Taylor",
    dob: "1942-11-08",
    referralSource: "Valleywise Health",
    riskScore: 3,
    referralDate: "2026-01-23",
    diagnosis: "ESRD on Dialysis, CAD",
    healthPlan: "AHCCCS",
    // Matching engine fields
    zipCode: "85034",
    language: "en",
    requiredAcuity: "L3",
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
]

// ============================================================================
// EXECUTIVE/KPI DATA (Static for demo)
// ============================================================================

export const healthPlanRevenue: HealthPlanRevenue[] = [
  { planName: "United Healthcare", pmpmRevenue: 285000, patientCount: 156, color: "hsl(var(--chart-1))" },
  { planName: "Mercy Care", pmpmRevenue: 198000, patientCount: 112, color: "hsl(var(--chart-2))" },
  { planName: "Molina", pmpmRevenue: 142000, patientCount: 87, color: "hsl(var(--chart-3))" },
  { planName: "AHCCCS", pmpmRevenue: 89000, patientCount: 45, color: "hsl(var(--chart-4))" },
]

export const referralSources: ReferralSource[] = [
  { name: "Valleywise Health", count: 89, trend: "up" },
  { name: "Dignity Health", count: 67, trend: "stable" },
  { name: "Banner Health", count: 54, trend: "up" },
  { name: "HonorHealth", count: 42, trend: "down" },
  { name: "Phoenix VA", count: 38, trend: "stable" },
]

export const monthlyBillingData: BillingData[] = [
  { date: "Jan 1", units: 245, target: 280 },
  { date: "Jan 5", units: 312, target: 280 },
  { date: "Jan 10", units: 287, target: 280 },
  { date: "Jan 15", units: 298, target: 280 },
  { date: "Jan 20", units: 265, target: 280 },
  { date: "Jan 25", units: 325, target: 280 },
]

export const kpiMetrics = {
  totalRevenue: 714000,
  revenueGrowth: 12.5,
  totalPatients: 400,
  activePatients: 385,
  avgEngagement: 11,
  avgUnitsPerNavigator: 255,
  medicationComplianceTarget: 95,
  pcpComplianceTarget: 90,
  patientsAwaitingIntake: 23,
  avgDaysInQueue: 4.2,
  highCostPatients: 12,
  totalAdverseEvents: 18,
  currentInpatients: 3,
}

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

export const initialPayerRates: PayerRate[] = [
  {
    id: "payer-uhc",
    payerName: "United Healthcare",
    ratePerUnit: 150.00,
    lastUpdated: "2026-01-15T10:00:00Z",
    updatedBy: "admin1",
  },
  {
    id: "payer-molina",
    payerName: "Molina Healthcare",
    ratePerUnit: 125.00,
    lastUpdated: "2026-01-15T10:00:00Z",
    updatedBy: "admin1",
  },
  {
    id: "payer-bcbs",
    payerName: "Blue Cross Blue Shield",
    ratePerUnit: 175.00,
    lastUpdated: "2026-01-15T10:00:00Z",
    updatedBy: "admin1",
  },
  {
    id: "payer-mercy",
    payerName: "Mercy Care",
    ratePerUnit: 140.00,
    lastUpdated: "2026-01-15T10:00:00Z",
    updatedBy: "admin1",
  },
  {
    id: "payer-ahcccs",
    payerName: "AHCCCS",
    ratePerUnit: 110.00,
    lastUpdated: "2026-01-15T10:00:00Z",
    updatedBy: "admin1",
  },
]

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
    startTime: "2026-01-29T10:00:00-07:00",
    endTime: "2026-01-29T11:00:00-07:00",
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
    startTime: "2026-01-29T09:30:00-07:00",
    endTime: "2026-01-29T10:00:00-07:00",
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
    startTime: "2026-01-29T14:00:00-07:00",
    endTime: "2026-01-29T15:00:00-07:00",
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
    startTime: "2026-01-29T09:00:00-07:00",
    endTime: "2026-01-29T10:00:00-07:00",
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
    startTime: "2026-01-29T10:15:00-07:00",
    endTime: "2026-01-29T10:45:00-07:00",
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
    startTime: "2026-01-29T14:00:00-07:00",
    endTime: "2026-01-29T14:45:00-07:00",
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
    startTime: "2026-01-29T15:30:00-07:00",
    endTime: "2026-01-29T16:30:00-07:00",
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

import type { TimeLog, ActivityType } from "./types"

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
    navigatorId: "nav-david",
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
    navigatorId: "nav-david",
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
    navigatorId: "nav-david",
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
    lastCheckIn: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 mins ago
    status: "IDLE",
    currentTask: "Documentation",
    speed: 0,
    batteryLevel: 62,
  },
]

// ============================================================================
// SUPERVISOR MESSAGES (NUDGES)
// ============================================================================

export const initialSupervisorMessages: SupervisorMessage[] = [
  {
    id: "nudge-1",
    fromSupervisorId: "sup1",
    fromSupervisorName: "Marcus Williams",
    toNavigatorId: "nav-maria",
    patientId: "pt-billing",
    patientName: "Sam Underwood",
    content: "Claim flagged: Missing 15 minutes of documented time for this month's billing cycle. Please add time logs to reach 60-minute minimum.",
    type: "nudge",
    createdAt: "2026-01-29T09:15:00-07:00",
    read: false,
  },
  {
    id: "nudge-2",
    fromSupervisorId: "sup1",
    fromSupervisorName: "Marcus Williams",
    toNavigatorId: "nav-john",
    patientId: "pt-billing",
    patientName: "Sam Underwood",
    content: "Billing review: Patient Sam Underwood has only 45 minutes logged this month. Need additional 15 minutes documented for G0506 claim.",
    type: "nudge",
    createdAt: "2026-01-29T10:30:00-07:00",
    read: false,
  },
  {
    id: "nudge-3",
    fromSupervisorId: "sup1",
    fromSupervisorName: "Marcus Williams",
    toNavigatorId: "nav-maria",
    patientId: "pt1",
    patientName: "James Thompson",
    content: "PCP follow-up needed: Patient missed annual wellness visit. Please schedule appointment and document outreach.",
    type: "nudge",
    createdAt: "2026-01-28T14:00:00-07:00",
    read: false,
  },
]
