/**
 * Verification script for lib/collection-helpers.ts.
 * Run: npx tsx scripts/verify-collection-helpers.ts
 */

import type { Appointment, Patient, PatientNote, Referral, AdverseEvent, Message } from "../lib/types"
import {
  getAppointmentsByDate,
  getAppointmentsByNavigator,
  getAppointmentsByPatient,
  getAppointmentsInRange,
  getUpcomingAppointments,
  getPatientsByNavigator,
  getHighRiskPatients,
  getPatientsNeedingContact,
  getNotesByPatient,
  getNotesByAuthor,
  getRecentNotes,
  getPendingReferrals,
  getActiveAdverseEvents,
  getAdverseEventsByPatient,
  syncAppointmentToPatient,
  removeAppointmentFromPatient,
  getMessagesForUser,
  getThreadMessages,
  getUnreadCount,
  getConversationThreads,
} from "../lib/collection-helpers"

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(`FAIL: ${message}`)
  console.log(`  ✓ ${message}`)
}

let passed = 0
let failed = 0

function run(name: string, fn: () => void) {
  try {
    console.log(`\n--- ${name} ---`)
    fn()
    passed++
  } catch (e) {
    failed++
    console.error(`  ✗ ${(e as Error).message}`)
  }
}

console.log("lib/collection-helpers – Verification")
console.log("=============================================")

function appointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: "apt1",
    patientId: "pt1",
    navigatorId: "nav1",
    date: "2026-07-10",
    time: "09:00",
    type: "home_visit",
    status: "scheduled",
    ...overrides,
  }
}

function patient(overrides: Partial<Patient> = {}): Patient {
  return {
    id: "pt1",
    name: "Jane Doe",
    dob: "1950-01-01",
    chartNumber: "GH-2026-0001",
    riskLevel: 1,
    survivalStatus: "active",
    assignedNavigator: "nav1",
    assignedSupervisor: "sup1",
    healthPlan: "Medicaid BH",
    enrollmentDate: "2026-01-01",
    lastContactDate: "2026-07-01",
    medicationCompliance: 90,
    pcpCompliance: true,
    upcomingAppointments: [],
    medications: [],
    adverseEvents: [],
    ...overrides,
  }
}

function note(overrides: Partial<PatientNote> = {}): PatientNote {
  return {
    id: "n1",
    patientId: "pt1",
    authorId: "nav1",
    authorName: "Navigator One",
    authorRole: "navigator",
    content: "Visit note",
    type: "general",
    createdAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  }
}

function referral(overrides: Partial<Referral> = {}): Referral {
  return {
    id: "ref1",
    receivedAt: "2026-07-01T00:00:00.000Z",
    source: "Banner Health",
    rawData: {
      PID: { patientName: "Jane Doe", dob: "1950-01-01", gender: "F", address: { street: "1 Main St", city: "Phoenix", state: "AZ", zip: "85001" }, phone: "555-1234" },
      DG1: { primaryDiagnosis: "CHF", icdCodes: ["I50.9"], diagnosisDate: "2026-06-01" },
      IN1: { payerName: "Medicaid", payerId: "medicaid-bh", memberId: "M123" },
      PV1: { referringPhysician: "Dr. Smith", facilityName: "Banner Health" },
    },
    status: "pending",
    patientName: "Jane Doe",
    dob: "1950-01-01",
    referralSource: "Banner Health",
    riskScore: 2,
    referralDate: "2026-07-01",
    diagnosis: "CHF",
    healthPlan: "Medicaid BH",
    zipCode: "85001",
    language: "en",
    requiredAcuity: "L1",
    ...overrides,
  }
}

function adverseEvent(overrides: Partial<AdverseEvent> = {}): AdverseEvent {
  return {
    id: "ae1",
    patientId: "pt1",
    type: "fall",
    diagnosis: "Fall with minor injury",
    startDate: "2026-07-01",
    status: "monitoring",
    rightCareFlag: false,
    followUpStatus: "pending",
    ...overrides,
  }
}

function message(overrides: Partial<Message> = {}): Message {
  return {
    id: "m1",
    senderId: "u1",
    senderName: "User One",
    senderRole: "navigator",
    receiverId: "u2",
    receiverName: "User Two",
    receiverRole: "supervisor",
    content: "hello",
    timestamp: "2026-07-01T00:00:00.000Z",
    readStatus: false,
    type: "direct",
    ...overrides,
  }
}

// --- Appointment helpers ---

run("getAppointmentsByDate: filters to scheduled appointments on the date", () => {
  const appts = [
    appointment({ id: "a1", date: "2026-07-10", status: "scheduled" }),
    appointment({ id: "a2", date: "2026-07-10", status: "cancelled" }),
    appointment({ id: "a3", date: "2026-07-11", status: "scheduled" }),
  ]
  const found = getAppointmentsByDate(appts, "2026-07-10")
  assert(found.length === 1 && found[0].id === "a1", "returns only the scheduled appointment on the date")
})

run("getAppointmentsByNavigator: filters by navigatorId", () => {
  const appts = [appointment({ id: "a1", navigatorId: "nav1" }), appointment({ id: "a2", navigatorId: "nav2" })]
  const found = getAppointmentsByNavigator(appts, "nav1")
  assert(found.length === 1 && found[0].id === "a1", "returns only nav1's appointments")
})

run("getAppointmentsByPatient: filters by patientId", () => {
  const appts = [appointment({ id: "a1", patientId: "pt1" }), appointment({ id: "a2", patientId: "pt2" })]
  const found = getAppointmentsByPatient(appts, "pt1")
  assert(found.length === 1 && found[0].id === "a1", "returns only pt1's appointments")
})

run("getAppointmentsInRange: filters by inclusive date range and scheduled status", () => {
  const appts = [
    appointment({ id: "a1", date: "2026-07-05", status: "scheduled" }),
    appointment({ id: "a2", date: "2026-07-10", status: "scheduled" }),
    appointment({ id: "a3", date: "2026-07-15", status: "scheduled" }),
    appointment({ id: "a4", date: "2026-07-10", status: "cancelled" }),
  ]
  const found = getAppointmentsInRange(appts, "2026-07-05", "2026-07-10")
  assert(found.length === 2 && found.every((a) => a.id !== "a3" && a.id !== "a4"), "includes range bounds, excludes non-scheduled")
})

run("getUpcomingAppointments: today+future scheduled, sorted ascending", () => {
  const past = new Date()
  past.setDate(past.getDate() - 5)
  const future = new Date()
  future.setDate(future.getDate() + 5)
  const appts = [
    appointment({ id: "future", date: future.toISOString().split("T")[0], status: "scheduled" }),
    appointment({ id: "past", date: past.toISOString().split("T")[0], status: "scheduled" }),
  ]
  const found = getUpcomingAppointments(appts)
  assert(found.length === 1 && found[0].id === "future", "excludes past appointments, keeps future")
})

// --- Patient helpers ---

run("getPatientsByNavigator: filters by assignedNavigator", () => {
  const patients = [patient({ id: "p1", assignedNavigator: "nav1" }), patient({ id: "p2", assignedNavigator: "nav2" })]
  const found = getPatientsByNavigator(patients, "nav1")
  assert(found.length === 1 && found[0].id === "p1", "returns only nav1's patients")
})

run("getHighRiskPatients: filters to riskLevel 3", () => {
  const patients = [patient({ id: "p1", riskLevel: 3 }), patient({ id: "p2", riskLevel: 1 })]
  const found = getHighRiskPatients(patients)
  assert(found.length === 1 && found[0].id === "p1", "returns only high-risk patients")
})

run("getPatientsNeedingContact: filters by lastContactDate cutoff", () => {
  const old = new Date()
  old.setDate(old.getDate() - 30)
  const recent = new Date()
  recent.setDate(recent.getDate() - 1)
  const patients = [
    patient({ id: "stale", lastContactDate: old.toISOString() }),
    patient({ id: "fresh", lastContactDate: recent.toISOString() }),
  ]
  const found = getPatientsNeedingContact(patients, 14)
  assert(found.length === 1 && found[0].id === "stale", "flags only patients past the cutoff")
})

// --- Notes helpers ---

run("getNotesByPatient: filters and sorts descending by createdAt", () => {
  const notes = [
    note({ id: "n1", patientId: "pt1", createdAt: "2026-07-01T00:00:00.000Z" }),
    note({ id: "n2", patientId: "pt1", createdAt: "2026-07-03T00:00:00.000Z" }),
    note({ id: "n3", patientId: "pt2", createdAt: "2026-07-02T00:00:00.000Z" }),
  ]
  const found = getNotesByPatient(notes, "pt1")
  assert(found.length === 2 && found[0].id === "n2" && found[1].id === "n1", "returns pt1's notes newest-first")
})

run("getNotesByAuthor: filters by authorId", () => {
  const notes = [note({ id: "n1", authorId: "nav1" }), note({ id: "n2", authorId: "nav2" })]
  const found = getNotesByAuthor(notes, "nav1")
  assert(found.length === 1 && found[0].id === "n1", "returns only nav1's notes")
})

run("getRecentNotes: sorts descending and limits, without mutating input", () => {
  const notes = [
    note({ id: "n1", createdAt: "2026-07-01T00:00:00.000Z" }),
    note({ id: "n2", createdAt: "2026-07-03T00:00:00.000Z" }),
    note({ id: "n3", createdAt: "2026-07-02T00:00:00.000Z" }),
  ]
  const found = getRecentNotes(notes, 2)
  assert(found.length === 2 && found[0].id === "n2" && found[1].id === "n3", "returns the 2 most recent notes")
  assert(notes[0].id === "n1", "does not mutate the original array order")
})

// --- Referral helpers ---

run("getPendingReferrals: filters to pending status", () => {
  const referrals = [referral({ id: "r1", status: "pending" }), referral({ id: "r2", status: "accepted" })]
  const found = getPendingReferrals(referrals)
  assert(found.length === 1 && found[0].id === "r1", "returns only pending referrals")
})

// --- Adverse event helpers ---

run("getActiveAdverseEvents: excludes ended events", () => {
  const events = [adverseEvent({ id: "e1", status: "monitoring" }), adverseEvent({ id: "e2", status: "ended" })]
  const found = getActiveAdverseEvents(events)
  assert(found.length === 1 && found[0].id === "e1", "excludes ended events")
})

run("getAdverseEventsByPatient: filters by patientId", () => {
  const events = [adverseEvent({ id: "e1", patientId: "pt1" }), adverseEvent({ id: "e2", patientId: "pt2" })]
  const found = getAdverseEventsByPatient(events, "pt1")
  assert(found.length === 1 && found[0].id === "e1", "returns only pt1's events")
})

// --- Sync helpers ---

run("syncAppointmentToPatient: adds a new appointment without mutating input", () => {
  const patients = [patient({ id: "pt1", upcomingAppointments: [] })]
  const apt = appointment({ id: "a1", patientId: "pt1" })
  const updated = syncAppointmentToPatient(patients, apt)
  assert(updated[0].upcomingAppointments.length === 1 && updated[0].upcomingAppointments[0].id === "a1", "adds the new appointment")
  assert(patients[0].upcomingAppointments.length === 0, "does not mutate the original patient")
})

run("syncAppointmentToPatient: updates an existing appointment in place", () => {
  const existing = appointment({ id: "a1", patientId: "pt1", status: "scheduled" })
  const patients = [patient({ id: "pt1", upcomingAppointments: [existing] })]
  const updated = syncAppointmentToPatient(patients, { ...existing, status: "completed" })
  assert(updated[0].upcomingAppointments.length === 1 && updated[0].upcomingAppointments[0].status === "completed", "updates the matching appointment in place")
})

run("removeAppointmentFromPatient: removes only the matching appointment", () => {
  const patients = [
    patient({
      id: "pt1",
      upcomingAppointments: [appointment({ id: "a1" }), appointment({ id: "a2" })],
    }),
  ]
  const updated = removeAppointmentFromPatient(patients, "pt1", "a1")
  assert(updated[0].upcomingAppointments.length === 1 && updated[0].upcomingAppointments[0].id === "a2", "removes only the target appointment")
})

// --- Messaging helpers ---

run("getMessagesForUser: matches sender or receiver, sorted newest-first", () => {
  const messages = [
    message({ id: "m1", senderId: "u1", receiverId: "u2", timestamp: "2026-07-01T00:00:00.000Z" }),
    message({ id: "m2", senderId: "u3", receiverId: "u1", timestamp: "2026-07-02T00:00:00.000Z" }),
    message({ id: "m3", senderId: "u3", receiverId: "u4", timestamp: "2026-07-03T00:00:00.000Z" }),
  ]
  const found = getMessagesForUser(messages, "u1")
  assert(found.length === 2 && found[0].id === "m2" && found[1].id === "m1", "returns u1's messages newest-first")
})

run("getThreadMessages: matches either direction between two users, sorted oldest-first", () => {
  const messages = [
    message({ id: "m1", senderId: "u1", receiverId: "u2", timestamp: "2026-07-02T00:00:00.000Z" }),
    message({ id: "m2", senderId: "u2", receiverId: "u1", timestamp: "2026-07-01T00:00:00.000Z" }),
    message({ id: "m3", senderId: "u1", receiverId: "u3", timestamp: "2026-07-03T00:00:00.000Z" }),
  ]
  const found = getThreadMessages(messages, "u1", "u2")
  assert(found.length === 2 && found[0].id === "m2" && found[1].id === "m1", "returns the thread oldest-first, excluding unrelated messages")
})

run("getUnreadCount: counts unread messages addressed to the user", () => {
  const messages = [
    message({ id: "m1", receiverId: "u1", readStatus: false }),
    message({ id: "m2", receiverId: "u1", readStatus: true }),
    message({ id: "m3", receiverId: "u2", readStatus: false }),
  ]
  assert(getUnreadCount(messages, "u1") === 1, "counts only unread messages addressed to u1")
})

run("getConversationThreads: groups by partner, keeps latest message and unread count", () => {
  const messages = [
    message({ id: "m1", senderId: "u2", senderName: "Bob", senderRole: "supervisor", receiverId: "u1", timestamp: "2026-07-01T00:00:00.000Z", readStatus: false }),
    message({ id: "m2", senderId: "u1", receiverId: "u2", receiverName: "Bob", receiverRole: "supervisor", timestamp: "2026-07-02T00:00:00.000Z", readStatus: true }),
    message({ id: "m3", senderId: "u3", senderName: "Cara", senderRole: "navigator", receiverId: "u1", timestamp: "2026-07-03T00:00:00.000Z", readStatus: false }),
  ]
  const threads = getConversationThreads(messages, "u1")
  assert(threads.length === 2, "groups into one thread per partner")
  assert(threads[0].partnerId === "u3" && threads[0].lastMessage.id === "m3", "sorts threads by most recent message first")
  const bobThread = threads.find((t) => t.partnerId === "u2")!
  assert(bobThread.lastMessage.id === "m2", "keeps the latest message per thread regardless of direction")
  assert(bobThread.unreadCount === 1, "counts only unread incoming messages in the thread")
})

console.log("\n=============================================")
console.log(`Result: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
