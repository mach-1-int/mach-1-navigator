"use client"

import React from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Database } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface AMDSourceIndicatorProps {
  source?: string
  className?: string
  size?: "sm" | "md"
}

export function AMDSourceIndicator({ 
  source = "Epic EHR", 
  className,
  size = "sm"
}: AMDSourceIndicatorProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span 
          className={cn(
            "inline-flex items-center justify-center rounded-full bg-emerald-100 text-emerald-700 cursor-help transition-colors hover:bg-emerald-200",
            size === "sm" ? "h-4 w-4" : "h-5 w-5",
            className
          )}
          aria-label="Data source information"
        >
          <Database className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} />
        </span>
      </TooltipTrigger>
      <TooltipContent 
        side="top" 
        className="max-w-[240px] bg-foreground text-background"
      >
        <div className="space-y-1">
          <p className="font-medium">Source: AMD Integration Layer</p>
          <p className="text-xs opacity-80">({source})</p>
          <p className="text-xs opacity-60 pt-1 border-t border-background/20">
            Data synced from external system. Not stored locally.
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

// Wrapper component for inline medical data with AMD indicator
interface AMDDataFieldProps {
  children: React.ReactNode
  source?: string
  className?: string
}

export function AMDDataField({ children, source, className }: AMDDataFieldProps) {
  return (
    <TooltipProvider>
      <span className={cn("inline-flex items-center gap-1.5", className)}>
        {children}
        <AMDSourceIndicator source={source} />
      </span>
    </TooltipProvider>
  )
}
