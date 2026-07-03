/**
 * CSV Exporter - Medical Billing Format
 *
 * Generates standard medical billing CSV files for claims export.
 * Follows CMS 1500 / 837P format conventions for healthcare billing.
 */

import type { BillableClaim, Navigator, OrganizationSettings, Patient } from "./types"

/**
 * CSV Headers for Medical Billing Export
 */
const CSV_HEADERS = [
  "Patient_Name",
  "Member_ID",
  "DOB",
  "Date_Of_Service",
  "Rendering_Provider",
  "Service_Provider",
  "CPT_Code",
  "Units",
  "Diagnosis_1",
  "Diagnosis_2",
  "Diagnosis_3",
  "Diagnosis_4",
  "Total_Minutes",
  "Service_Type",
  "Billing_Model",
  "Claim_ID",
] as const

/**
 * Row data structure for CSV export
 */
interface CSVRow {
  Patient_Name: string
  Member_ID: string
  DOB: string
  Date_Of_Service: string
  Rendering_Provider: string
  Service_Provider: string
  CPT_Code: string
  Units: string
  Diagnosis_1: string
  Diagnosis_2: string
  Diagnosis_3: string
  Diagnosis_4: string
  Total_Minutes: string
  Service_Type: string
  Billing_Model: string
  Claim_ID: string
}

/**
 * Get the last day of a month from a YYYY-MM string
 * Returns formatted as MM/DD/YYYY
 */
function getLastDayOfMonth(monthStr: string): string {
  const [year, month] = monthStr.split("-").map(Number)
  // Create date for first day of next month, then subtract 1 day
  const lastDay = new Date(year, month, 0)
  const mm = String(lastDay.getMonth() + 1).padStart(2, "0")
  const dd = String(lastDay.getDate()).padStart(2, "0")
  const yyyy = lastDay.getFullYear()
  return `${mm}/${dd}/${yyyy}`
}

/**
 * Escape a CSV field value (handle commas, quotes, newlines)
 */
function escapeCSVField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    // Escape quotes by doubling them, then wrap in quotes
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Convert a claim to CSV rows
 * Generates separate rows for base code and add-on code
 */
function claimToCSVRows(
  claim: BillableClaim,
  patientDOB: string,
  serviceProvider: string,
  renderingProvider: string
): CSVRow[] {
  const rows: CSVRow[] = []
  const dateOfService = getLastDayOfMonth(claim.month)

  // Format billing model for display
  const billingModelDisplay = claim.billingModel
    ? claim.billingModel.replace(/_/g, " ")
    : "MEDICAID BH" // Default to Medicaid for demo

  // Base row template
  const baseRow: Omit<CSVRow, "CPT_Code" | "Units"> = {
    Patient_Name: claim.patientName,
    Member_ID: claim.memberId,
    DOB: patientDOB,
    Date_Of_Service: dateOfService,
    Rendering_Provider: renderingProvider,
    Service_Provider: serviceProvider,
    Diagnosis_1: claim.diagnosisCodes[0] || "",
    Diagnosis_2: claim.diagnosisCodes[1] || "",
    Diagnosis_3: claim.diagnosisCodes[2] || "",
    Diagnosis_4: claim.diagnosisCodes[3] || "",
    Total_Minutes: claim.totalMinutes.toString(),
    Service_Type: claim.serviceType,
    Billing_Model: billingModelDisplay,
    Claim_ID: claim.id,
  }

  // Row 1: Primary/Base Code (G0023 for PIN, G0019 for CHI)
  if (claim.primaryUnits > 0) {
    rows.push({
      ...baseRow,
      CPT_Code: claim.primaryCode,
      Units: claim.primaryUnits.toString(),
    })
  }

  // Row 2: Add-on Code (G0024 for PIN, G0022 for CHI)
  if (claim.addOnUnits > 0 && claim.addOnCode) {
    rows.push({
      ...baseRow,
      CPT_Code: claim.addOnCode,
      Units: claim.addOnUnits.toString(),
    })
  }

  return rows
}

/**
 * Generate CSV content from claims
 */
export function generateBillingCSV(
  claims: BillableClaim[],
  patients?: Patient[],
  navigators?: Navigator[],
  orgSettings?: OrganizationSettings
): string {
  // Create patient DOB lookup if patients provided
  const dobLookup = new Map<string, string>()
  if (patients) {
    patients.forEach((p) => {
      if (p.dob) {
        // Convert YYYY-MM-DD to MM/DD/YYYY
        const [year, month, day] = p.dob.split("-")
        dobLookup.set(p.id, `${month}/${day}/${year}`)
      }
    })
  }

  // Navigator id -> name lookup (fallback: raw id)
  const navigatorLookup = new Map<string, string>()
  navigators?.forEach((n) => navigatorLookup.set(n.id, n.name))

  const renderingProvider = orgSettings?.supervisingProvider.name ?? ""

  // Convert all claims to rows
  const allRows: CSVRow[] = []
  for (const claim of claims) {
    // Empty DOB when the patient is missing — never fabricate demographics
    const patientDOB = dobLookup.get(claim.patientId) || ""
    const serviceProvider = navigatorLookup.get(claim.navigatorId) ?? claim.navigatorId
    const rows = claimToCSVRows(claim, patientDOB, serviceProvider, renderingProvider)
    allRows.push(...rows)
  }

  // Build CSV string
  const headerLine = CSV_HEADERS.join(",")
  const dataLines = allRows.map((row) =>
    CSV_HEADERS.map((header) => escapeCSVField(row[header])).join(",")
  )

  return [headerLine, ...dataLines].join("\n")
}

/**
 * Trigger browser download of a text file (CSV, 837, 835, ...)
 */
export function triggerFileDownload(
  content: string,
  filename: string,
  mimeType: string = "text/csv"
): void {
  // Prepend BOM to CSV files for Excel compatibility
  const isCsv = mimeType.startsWith("text/csv")
  const payload = isCsv ? `\uFEFF${content}` : content
  const blob = new Blob([payload], { type: `${mimeType};charset=utf-8;` })

  // Create download link
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.style.display = "none"

  // Trigger download
  document.body.appendChild(link)
  link.click()

  // Cleanup
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Trigger browser download of CSV file (thin wrapper for compatibility)
 */
export function triggerCSVDownload(csvContent: string, filename: string): void {
  triggerFileDownload(csvContent, filename, "text/csv")
}

/**
 * Main export function: Download claims as CSV
 *
 * @param claims - Array of billable claims to export
 * @param patients - Optional array of patients for DOB lookup
 * @param filename - Optional custom filename (defaults to claims-export-YYYY-MM-DD.csv)
 * @param navigators - Optional array of navigators for Service_Provider names
 * @param orgSettings - Optional org settings for Rendering_Provider
 */
export function downloadClaimsCsv(
  claims: BillableClaim[],
  patients?: Patient[],
  filename?: string,
  navigators?: Navigator[],
  orgSettings?: OrganizationSettings
): void {
  if (claims.length === 0) {
    console.warn("No claims to export")
    return
  }

  // Generate CSV content
  const csvContent = generateBillingCSV(claims, patients, navigators, orgSettings)

  // Generate filename if not provided
  const exportFilename =
    filename ||
    `claims-export-${new Date().toISOString().split("T")[0]}.csv`

  // Trigger download
  triggerCSVDownload(csvContent, exportFilename)
}

/**
 * Generate filename for monthly export
 */
export function generateMonthlyFilename(month: string): string {
  return `billing-claims-${month}.csv`
}

/**
 * Export claims for a specific month with proper naming
 */
export function downloadMonthlyClaimsCsv(
  claims: BillableClaim[],
  month: string,
  patients?: Patient[],
  navigators?: Navigator[],
  orgSettings?: OrganizationSettings
): void {
  const filename = generateMonthlyFilename(month)
  downloadClaimsCsv(claims, patients, filename, navigators, orgSettings)
}

/**
 * Generate a summary report alongside the claims
 * Returns a summary string that could be included as a separate file
 * Supports both Medicaid H-codes and Medicare G-codes
 */
export function generateExportSummary(claims: BillableClaim[]): string {
  const totalClaims = claims.length
  const totalPrimaryUnits = claims.reduce((sum, c) => sum + c.primaryUnits, 0)
  const totalAddOnUnits = claims.reduce((sum, c) => sum + c.addOnUnits, 0)
  const totalMinutes = claims.reduce((sum, c) => sum + c.totalMinutes, 0)

  // Group by billing model
  const medicaidClaims = claims.filter((c) => c.billingModel === "MEDICAID_BH" || c.primaryCode.startsWith("H"))
  const medicareClaims = claims.filter((c) => c.billingModel?.startsWith("MEDICARE") || c.primaryCode.startsWith("G"))

  const pinClaims = claims.filter((c) => c.serviceType === "PIN")
  const chiClaims = claims.filter((c) => c.serviceType === "CHI")

  const lines = [
    "CLAIMS EXPORT SUMMARY",
    "=====================",
    `Export Date: ${new Date().toLocaleString()}`,
    "",
    "TOTALS:",
    `  Total Claims: ${totalClaims}`,
    `  Total Minutes: ${totalMinutes}`,
    `  Primary Code Units: ${totalPrimaryUnits}`,
    `  Add-on Code Units: ${totalAddOnUnits}`,
    "",
    "BY BILLING MODEL:",
    `  Medicaid BH (H-Codes): ${medicaidClaims.length} claims`,
    `  Medicare (G-Codes): ${medicareClaims.length} claims`,
    "",
    "BY SERVICE TYPE:",
    `  PIN (Principal Illness Navigation): ${pinClaims.length} claims`,
    `  CHI (Community Health Integration): ${chiClaims.length} claims`,
    "",
    "CODES BREAKDOWN:",
  ]

  // Add H-code breakdown if Medicaid claims exist
  if (medicaidClaims.length > 0) {
    const h0038 = medicaidClaims.filter((c) => c.primaryCode === "H0038")
    const h2015 = medicaidClaims.filter((c) => c.primaryCode === "H2015")
    const h0023 = medicaidClaims.filter((c) => c.primaryCode === "H0023")
    lines.push(
      `  H0038 (Peer Services): ${h0038.reduce((s, c) => s + c.primaryUnits, 0)} units`,
      `  H2015 (Community Support): ${h2015.reduce((s, c) => s + c.primaryUnits, 0)} units`,
      `  H0023 (Outreach): ${h0023.reduce((s, c) => s + c.primaryUnits, 0)} units`
    )
  }

  // Add G-code breakdown if Medicare claims exist
  if (medicareClaims.length > 0) {
    lines.push(
      `  G0023 (PIN Base): ${pinClaims.reduce((s, c) => s + c.primaryUnits, 0)} units`,
      `  G0024 (PIN Add-on): ${pinClaims.reduce((s, c) => s + c.addOnUnits, 0)} units`,
      `  G0019 (CHI Base): ${chiClaims.reduce((s, c) => s + c.primaryUnits, 0)} units`,
      `  G0022 (CHI Add-on): ${chiClaims.reduce((s, c) => s + c.addOnUnits, 0)} units`
    )
  }

  return lines.join("\n")
}
