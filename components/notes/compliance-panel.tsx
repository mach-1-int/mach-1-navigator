"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, ChevronDown, ChevronRight, ShieldCheck, TriangleAlert, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { COMPLIANCE_RULES, type ComplianceFinding } from "@/lib/note-compliance"
import type { NoteTemplate } from "@/lib/types"

interface CompliancePanelProps {
  findings: ComplianceFinding[]
  template?: NoteTemplate
}

const LEVEL_CONFIG = {
  pass: { icon: CheckCircle2, className: "text-emerald-600" },
  warn: { icon: TriangleAlert, className: "text-amber-600" },
  fail: { icon: XCircle, className: "text-destructive" },
}

export function CompliancePanel({ findings, template }: CompliancePanelProps) {
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null)

  const failCount = findings.filter((f) => f.level === "fail").length
  const warnCount = findings.filter((f) => f.level === "warn").length

  return (
    <Card
      className={cn(
        "bg-background",
        failCount > 0 ? "border-destructive/50" : warnCount > 0 ? "border-amber-300" : "border-emerald-300"
      )}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <ShieldCheck
            className={cn(
              "h-4 w-4",
              failCount > 0 ? "text-destructive" : warnCount > 0 ? "text-amber-600" : "text-emerald-600"
            )}
          />
          Manual Compliance
          {failCount > 0 && (
            <Badge variant="destructive" className="text-xs h-5">
              {failCount} blocking
            </Badge>
          )}
          {failCount === 0 && warnCount > 0 && (
            <Badge variant="outline" className="text-xs h-5 bg-amber-50 text-amber-700 border-amber-300">
              {warnCount} warning{warnCount !== 1 ? "s" : ""}
            </Badge>
          )}
          {failCount === 0 && warnCount === 0 && (
            <Badge variant="outline" className="text-xs h-5 bg-emerald-50 text-emerald-700 border-emerald-300">
              All checks pass
            </Badge>
          )}
        </CardTitle>
        {template?.manualSection && (
          <p className="text-xs text-muted-foreground">
            Checked against the Gellert Note-Taking Manual — {template.manualSection}
          </p>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="divide-y divide-border/60">
          {COMPLIANCE_RULES.map((rule) => {
            const finding = findings.find((f) => f.ruleId === rule.id)
            const isExpanded = expandedRuleId === rule.id
            if (!finding) {
              return (
                <div key={rule.id} className="flex items-center gap-2 py-1.5 opacity-50">
                  <span className="h-3.5 w-3.5 shrink-0 text-center text-xs text-muted-foreground leading-none">—</span>
                  <span className="text-xs text-muted-foreground">{rule.title}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground uppercase">N/A</span>
                </div>
              )
            }
            const config = LEVEL_CONFIG[finding.level]
            const Icon = config.icon
            return (
              <div key={rule.id} className="py-1.5">
                <button
                  type="button"
                  className="flex items-center gap-2 w-full text-left"
                  onClick={() => setExpandedRuleId(isExpanded ? null : rule.id)}
                >
                  <Icon className={cn("h-3.5 w-3.5 shrink-0", config.className)} />
                  <span className={cn("text-xs", finding.level === "fail" && "font-medium text-destructive")}>
                    {rule.title}
                  </span>
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3 ml-auto text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="h-3 w-3 ml-auto text-muted-foreground shrink-0" />
                  )}
                </button>
                {isExpanded && (
                  <div className="mt-1.5 ml-5 pl-0.5 space-y-1.5">
                    <p
                      className={cn(
                        "text-xs",
                        finding.level === "fail"
                          ? "text-destructive"
                          : finding.level === "warn"
                            ? "text-amber-700"
                            : "text-muted-foreground"
                      )}
                    >
                      {finding.message}
                    </p>
                    {finding.offendingText && finding.offendingText.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {finding.offendingText.map((snippet, idx) => (
                          <code key={idx} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">
                            {snippet}
                          </code>
                        ))}
                      </div>
                    )}
                    <p className="text-[11px] italic text-muted-foreground border-l-2 border-border pl-2">
                      {finding.citation}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
