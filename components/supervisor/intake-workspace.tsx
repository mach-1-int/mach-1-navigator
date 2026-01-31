"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"
import {
  FileText,
  MapPin,
  Phone,
  Calendar,
  Stethoscope,
  Building2,
  Globe,
  AlertTriangle,
  CheckCircle2,
  User,
  Users,
  Zap,
  ArrowLeft,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useRole } from "@/lib/role-context"
import { useDemoData } from "@/lib/demo-data-context"
import { initialUsers } from "@/lib/initial-data"
import {
  calculateMatchScore,
  rankNavigatorsForReferral,
  type NavigatorWithAttributes,
  type RankedNavigator,
} from "@/lib/matching-logic"
import type { Referral } from "@/lib/types"
import { toast } from "sonner"

interface IntakeWorkspaceProps {
  referralId: string
}

export function IntakeWorkspace({ referralId }: IntakeWorkspaceProps) {
  const { goBack } = useRole()
  const { referrals, assignReferral, navigators: stateNavigators } = useDemoData()
  const [isAssigning, setIsAssigning] = useState(false)
  // Language override for QA Test B (toggle to es to see Sarah drop)
  const [languageOverride, setLanguageOverride] = useState<string | null>(null)

  // Find the selected referral
  const referral = useMemo(() => {
    return referrals.find(r => r.id === referralId)
  }, [referrals, referralId])

  // Effective referral for matching (language override for testing)
  const effectiveReferral = useMemo(() => {
    if (!referral) return null
    if (languageOverride) return { ...referral, language: languageOverride }
    return referral
  }, [referral, languageOverride])

  // Get navigators with attributes: merge initialUsers (geo, languages, acuity) with live caseload from state
  const navigatorsWithAttributes = useMemo((): NavigatorWithAttributes[] => {
    return initialUsers
      .filter(user => user.role === "navigator" && user.attributes)
      .map(user => {
        const liveNav = stateNavigators.find(n => n.id === user.id)
        const currentCaseload = liveNav?.patientCount ?? user.attributes!.currentCaseload
        return {
          id: user.id,
          name: user.name,
          attributes: {
            ...user.attributes!,
            currentCaseload,
          },
        }
      })
  }, [stateNavigators])

  // Calculate and rank navigator matches using effective referral
  const rankedNavigators = useMemo((): RankedNavigator[] => {
    if (!effectiveReferral) return []
    return rankNavigatorsForReferral(effectiveReferral, navigatorsWithAttributes)
  }, [effectiveReferral, navigatorsWithAttributes])

  // Handle assign referral
  const handleAssign = async (navigatorId: string, navigatorName: string) => {
    if (!referral) return

    setIsAssigning(true)

    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 500))

    try {
      assignReferral(referral.id, navigatorId)
      toast.success(`${referral.patientName} assigned to ${navigatorName}`, {
        description: "Referral has been processed successfully.",
      })
      goBack()
    } catch (error) {
      toast.error("Failed to assign referral")
    } finally {
      setIsAssigning(false)
    }
  }

  if (!referral) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Referral not found</p>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-180px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" onClick={goBack} className="gap-2 -ml-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Referrals
        </Button>
        <Badge variant="outline" className="text-xs">
          Referral ID: {referral.id}
        </Badge>
      </div>

      {/* Split Screen */}
      <ResizablePanelGroup direction="horizontal" className="flex-1 rounded-lg border">
        {/* Left Pane - Referral Source */}
        <ResizablePanel defaultSize={45} minSize={30}>
          <div className="h-full flex flex-col overflow-hidden">
            <div className="p-4 border-b bg-muted/30 flex-shrink-0">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                Incoming Referral (AMD Integration)
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Read-only data from referring facility
              </p>
            </div>
            <div className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-4">
                  <ReferralDocument
                    referral={referral}
                    languageOverride={languageOverride}
                    onLanguageOverrideChange={setLanguageOverride}
                  />
                </div>
              </ScrollArea>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right Pane - Navigator Matching */}
        <ResizablePanel defaultSize={55} minSize={35}>
          <div className="h-full flex flex-col overflow-hidden">
            <div className="p-4 border-b bg-muted/30 flex-shrink-0">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-600" />
                Recommended Navigators
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Ranked by match score based on distance, language, capacity, and acuity
              </p>
            </div>
            <div className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-3">
                  {rankedNavigators.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No navigators available for matching</p>
                    </div>
                  ) : (
                    rankedNavigators.map((nav, index) => (
                      <NavigatorMatchCard
                        key={nav.navigatorId}
                        navigator={nav}
                        rank={index + 1}
                        isTopMatch={index === 0 && nav.score > 0}
                        onAssign={() => handleAssign(nav.navigatorId, nav.navigatorName)}
                        isAssigning={isAssigning}
                        referral={referral}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}

// ============================================================================
// REFERRAL DOCUMENT COMPONENT
// ============================================================================

function ReferralDocument({
  referral,
  languageOverride,
  onLanguageOverrideChange,
}: {
  referral: Referral
  languageOverride: string | null
  onLanguageOverrideChange: (lang: string | null) => void
}) {
  const rawData = referral.rawData

  return (
    <div className="space-y-4">
      {/* Patient Header */}
      <Card className="border-blue-200 bg-blue-50/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="bg-blue-100 text-blue-700 text-lg">
                {referral.patientName.split(" ").map(n => n[0]).join("")}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{referral.patientName}</h3>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  DOB: {new Date(referral.dob).toLocaleDateString()}
                </span>
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {rawData?.PID?.gender === "M" ? "Male" : rawData?.PID?.gender === "F" ? "Female" : "Other"}
                </span>
              </div>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline" className={cn(
                  referral.riskScore === 3 ? "bg-red-50 text-red-700 border-red-200" :
                  referral.riskScore === 2 ? "bg-amber-50 text-amber-700 border-amber-200" :
                  "bg-emerald-50 text-emerald-700 border-emerald-200"
                )}>
                  Risk Level {referral.riskScore}
                </Badge>
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                  Acuity: {referral.requiredAcuity}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Matching Criteria (language override for QA Test B) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            Matching Criteria
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Zip Code</p>
                <p className="font-mono font-medium">{referral.zipCode}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Language</p>
                <p className="font-medium">
                  {(languageOverride ?? referral.language) === "es" ? "Spanish" : "English"}
                </p>
                <select
                  className="mt-1 text-xs border rounded px-2 py-1 bg-background"
                  value={languageOverride ?? referral.language}
                  onChange={(e) => {
                    const v = e.target.value
                    onLanguageOverrideChange(v === referral.language ? null : v)
                  }}
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                </select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {rawData?.PID?.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{rawData.PID.phone}</span>
            </div>
          )}
          {rawData?.PID?.address && (
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p>{rawData.PID.address.street}</p>
                <p>{rawData.PID.address.city}, {rawData.PID.address.state} {rawData.PID.address.zip}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Clinical Information */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Stethoscope className="h-4 w-4" />
            Clinical Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Primary Diagnosis</p>
            <p className="font-medium">{rawData?.DG1?.primaryDiagnosis || referral.diagnosis}</p>
          </div>
          {rawData?.DG1?.icdCodes && rawData.DG1.icdCodes.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">ICD-10 Codes</p>
              <div className="flex flex-wrap gap-1">
                {rawData.DG1.icdCodes.map(code => (
                  <Badge key={code} variant="secondary" className="font-mono text-xs">
                    {code}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Referral Source */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Referral Source
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Facility</span>
            <span className="font-medium">{rawData?.PV1?.facilityName || referral.source}</span>
          </div>
          {rawData?.PV1?.referringPhysician && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Referring Physician</span>
              <span className="font-medium">{rawData.PV1.referringPhysician}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Health Plan</span>
            <span className="font-medium">{referral.healthPlan}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Referral Date</span>
            <span className="font-medium">{new Date(referral.receivedAt).toLocaleDateString()}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================================
// NAVIGATOR MATCH CARD COMPONENT
// ============================================================================

interface NavigatorMatchCardProps {
  navigator: RankedNavigator
  rank: number
  isTopMatch: boolean
  onAssign: () => void
  isAssigning: boolean
  referral: Referral
}

function NavigatorMatchCard({
  navigator,
  rank,
  isTopMatch,
  onAssign,
  isAssigning,
  referral,
}: NavigatorMatchCardProps) {
  // Get navigator attributes from initial users
  const navUser = initialUsers.find(u => u.id === navigator.navigatorId)
  const attrs = navUser?.attributes

  // Calculate match percentage (normalize score to 0-100)
  // Max possible score: 40 (distance) + 30 (capacity) + 20 (language) + 10 (acuity) = 100
  const matchPercentage = Math.max(0, Math.min(100, navigator.score))

  // Determine if this is a viable match
  const isViableMatch = navigator.score > 0

  // Parse match reasons into badges
  const badges = useMemo(() => {
    const result: { label: string; variant: "success" | "warning" | "error" }[] = []

    navigator.matchReasons.forEach(reason => {
      if (reason.includes("Within service area")) {
        const distanceMatch = reason.match(/\((\d+) mi/)
        const distance = distanceMatch ? parseInt(distanceMatch[1]) : 0
        result.push({ label: `~${distance} miles away`, variant: "success" })
      }
      if (reason.includes("Language match") && reason.includes("ES")) {
        result.push({ label: "Spanish Speaker", variant: "success" })
      }
      if (reason.includes("Available capacity")) {
        result.push({ label: "High Availability", variant: "success" })
      }
      if (reason.includes("Near capacity")) {
        result.push({ label: "Limited Capacity", variant: "warning" })
      }
      if (reason.includes("full capacity")) {
        result.push({ label: "At Capacity", variant: "error" })
      }
      if (reason.includes("Acuity capable")) {
        result.push({ label: `${referral.requiredAcuity} Certified`, variant: "success" })
      }
      if (reason.includes("Outside service area")) {
        result.push({ label: "Too Far", variant: "error" })
      }
      if (reason.includes("Language mismatch")) {
        result.push({ label: "Language Mismatch", variant: "error" })
      }
      if (reason.includes("Not certified")) {
        result.push({ label: "Not L3 Certified", variant: "warning" })
      }
    })

    return result
  }, [navigator.matchReasons, referral.requiredAcuity])

  // Capacity percentage
  const capacityPercentage = attrs
    ? (attrs.currentCaseload / attrs.maxCaseload) * 100
    : 0

  return (
    <Card className={cn(
      "transition-all",
      isTopMatch && isViableMatch && "ring-2 ring-emerald-500/50 bg-emerald-50/30",
      !isViableMatch && "opacity-60 bg-muted/30"
    )}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Rank Badge */}
          <div className={cn(
            "flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold shrink-0",
            rank === 1 && isViableMatch ? "bg-emerald-100 text-emerald-700" :
            rank === 2 && isViableMatch ? "bg-blue-100 text-blue-700" :
            rank === 3 && isViableMatch ? "bg-amber-100 text-amber-700" :
            "bg-muted text-muted-foreground"
          )}>
            #{rank}
          </div>

          {/* Navigator Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <Avatar className="h-10 w-10">
                <AvatarFallback className={cn(
                  isTopMatch && isViableMatch ? "bg-emerald-100 text-emerald-700" : "bg-muted"
                )}>
                  {navigator.navigatorName.split(" ").map(n => n[0]).join("")}
                </AvatarFallback>
              </Avatar>
              <div>
                <h4 className="font-semibold">{navigator.navigatorName}</h4>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-lg font-bold",
                    matchPercentage >= 70 ? "text-emerald-600" :
                    matchPercentage >= 40 ? "text-amber-600" :
                    "text-red-600"
                  )}>
                    {matchPercentage}%
                  </span>
                  <span className="text-xs text-muted-foreground">Match Score</span>
                </div>
              </div>
            </div>

            {/* Match Badges */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {badges.map((badge, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className={cn(
                    "text-xs",
                    badge.variant === "success" && "bg-emerald-50 text-emerald-700 border-emerald-200",
                    badge.variant === "warning" && "bg-amber-50 text-amber-700 border-amber-200",
                    badge.variant === "error" && "bg-red-50 text-red-700 border-red-200"
                  )}
                >
                  {badge.variant === "success" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                  {badge.variant === "warning" && <AlertTriangle className="h-3 w-3 mr-1" />}
                  {badge.variant === "error" && <AlertTriangle className="h-3 w-3 mr-1" />}
                  {badge.label}
                </Badge>
              ))}
            </div>

            {/* Capacity Bar */}
            {attrs && (
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Caseload</span>
                  <span className="font-medium">
                    {attrs.currentCaseload}/{attrs.maxCaseload} patients
                  </span>
                </div>
                <Progress
                  value={capacityPercentage}
                  className={cn(
                    "h-2",
                    capacityPercentage >= 90 ? "[&>div]:bg-red-500" :
                    capacityPercentage >= 70 ? "[&>div]:bg-amber-500" :
                    "[&>div]:bg-emerald-500"
                  )}
                />
              </div>
            )}

            {/* Match Reasons (expandable detail) */}
            <div className="text-xs text-muted-foreground space-y-0.5 mb-3">
              {navigator.matchReasons.slice(0, 3).map((reason, i) => (
                <p key={i} className="truncate">{reason}</p>
              ))}
            </div>

            {/* Assign Button */}
            <Button
              onClick={onAssign}
              disabled={!isViableMatch || isAssigning}
              className={cn(
                "w-full",
                isTopMatch && isViableMatch && "bg-emerald-600 hover:bg-emerald-700"
              )}
            >
              {isAssigning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : isViableMatch ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Assign Referral
                </>
              ) : (
                "Not Available"
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
