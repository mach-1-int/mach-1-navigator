"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import type { NavigatorShift, DayOfWeek, Navigator } from "@/lib/types"
import { generateId } from "@/lib/store"

interface AddShiftModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  navigators: Navigator[]
  supervisorId: string
  onAddShift: (shift: NavigatorShift, publish: boolean) => void
  existingShift?: NavigatorShift // For editing
}

const DAYS_OF_WEEK: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

const REGIONS = [
  { value: "phoenix-metro", label: "Phoenix Metro" },
  { value: "east-valley", label: "East Valley" },
  { value: "west-valley", label: "West Valley" },
  { value: "central", label: "Central Phoenix" },
  { value: "tucson", label: "Tucson" },
]

export function AddShiftModal({
  open,
  onOpenChange,
  navigators,
  supervisorId,
  onAddShift,
  existingShift,
}: AddShiftModalProps) {
  // Form state
  const [selectedNavigatorId, setSelectedNavigatorId] = useState(existingShift?.navigatorId || "")
  const [includeAllNavigators, setIncludeAllNavigators] = useState(false)
  const [selectedRegion, setSelectedRegion] = useState(existingShift?.region || "")
  const [includeAllRegions, setIncludeAllRegions] = useState(true)

  // Schedule state
  const [startDate, setStartDate] = useState(
    existingShift?.startDate || new Date().toISOString().split("T")[0]
  )
  const [endDate, setEndDate] = useState(existingShift?.endDate || "")
  const [noEndDate, setNoEndDate] = useState(!existingShift?.endDate)
  const [startTimeHour, setStartTimeHour] = useState(
    existingShift?.startTime?.split(":")[0] || "09"
  )
  const [startTimeMinute, setStartTimeMinute] = useState(
    existingShift?.startTime?.split(":")[1] || "00"
  )
  const [endTimeHour, setEndTimeHour] = useState(
    existingShift?.endTime?.split(":")[0] || "17"
  )
  const [endTimeMinute, setEndTimeMinute] = useState(
    existingShift?.endTime?.split(":")[1] || "00"
  )
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>(
    existingShift?.days || []
  )
  const [notes, setNotes] = useState(existingShift?.notes || "")

  // Toggle day selection
  const toggleDay = (day: DayOfWeek) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  // Get navigator name by ID
  const getNavigatorName = (id: string) => {
    return navigators.find((n) => n.id === id)?.name || "Unknown"
  }

  // Handle form submission
  const handleSubmit = (publish: boolean) => {
    const navigatorsToSchedule = includeAllNavigators
      ? navigators.map((n) => n.id)
      : [selectedNavigatorId]

    const now = new Date().toISOString()

    // If no days selected, use all days of the week (shift applies to every day in range)
    const daysToUse = selectedDays.length > 0 ? selectedDays : DAYS_OF_WEEK

    navigatorsToSchedule.forEach((navId) => {
      const shift: NavigatorShift = {
        id: existingShift?.id || generateId(),
        navigatorId: navId,
        navigatorName: getNavigatorName(navId),
        supervisorId,
        startDate,
        endDate: noEndDate ? undefined : endDate,
        days: daysToUse,
        startTime: `${startTimeHour}:${startTimeMinute}`,
        endTime: `${endTimeHour}:${endTimeMinute}`,
        region: includeAllRegions ? undefined : selectedRegion,
        notes: notes || undefined,
        isPublished: publish,
        createdAt: existingShift?.createdAt || now,
        updatedAt: now,
      }

      onAddShift(shift, publish)
    })

    // Reset form
    resetForm()
    onOpenChange(false)
  }

  const resetForm = () => {
    setSelectedNavigatorId("")
    setIncludeAllNavigators(false)
    setSelectedRegion("")
    setIncludeAllRegions(true)
    setStartDate(new Date().toISOString().split("T")[0])
    setEndDate("")
    setNoEndDate(true)
    setStartTimeHour("09")
    setStartTimeMinute("00")
    setEndTimeHour("17")
    setEndTimeMinute("00")
    setSelectedDays([])
    setNotes("")
  }

  // Days are optional - if none selected, shift applies to all days in range
  const isValid =
    (includeAllNavigators || selectedNavigatorId) &&
    startDate

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[700px] w-[90vw]">
        <DialogHeader>
          <DialogTitle>{existingShift ? "Edit Shift" : "Add Shift"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Shift Overview Section */}
          <div>
            <h3 className="font-semibold mb-4">Shift Overview</h3>
            <div className="grid grid-cols-3 gap-4">
              {/* Region Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Region</Label>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="all-regions"
                      checked={includeAllRegions}
                      onCheckedChange={(checked) =>
                        setIncludeAllRegions(checked as boolean)
                      }
                    />
                    <Label htmlFor="all-regions" className="text-xs font-normal">
                      Include all regions
                    </Label>
                  </div>
                </div>
                <Select
                  value={selectedRegion}
                  onValueChange={setSelectedRegion}
                  disabled={includeAllRegions}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Region" />
                  </SelectTrigger>
                  <SelectContent>
                    {REGIONS.map((region) => (
                      <SelectItem key={region.value} value={region.value}>
                        {region.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Navigator Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>
                    Navigator <span className="text-red-500">*</span>
                  </Label>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="all-navigators"
                      checked={includeAllNavigators}
                      onCheckedChange={(checked) =>
                        setIncludeAllNavigators(checked as boolean)
                      }
                    />
                    <Label htmlFor="all-navigators" className="text-xs font-normal">
                      Include all
                    </Label>
                  </div>
                </div>
                <Select
                  value={selectedNavigatorId}
                  onValueChange={setSelectedNavigatorId}
                  disabled={includeAllNavigators}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Navigator" />
                  </SelectTrigger>
                  <SelectContent>
                    {navigators.map((nav) => (
                      <SelectItem key={nav.id} value={nav.id}>
                        {nav.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  placeholder="Optional notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-[38px] min-h-[38px] resize-none"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Shift Schedule Section */}
          <div>
            <h3 className="font-semibold mb-4">Shift Schedule</h3>

            {/* Date Range */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="space-y-2">
                <Label>
                  Select Start Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Select End Date</Label>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="no-end-date"
                      checked={noEndDate}
                      onCheckedChange={(checked) =>
                        setNoEndDate(checked as boolean)
                      }
                    />
                    <Label htmlFor="no-end-date" className="text-xs font-normal">
                      No end date
                    </Label>
                  </div>
                </div>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={noEndDate}
                  min={startDate}
                />
              </div>

              {/* Start Time */}
              <div className="space-y-2">
                <Label>Schedule Start Time</Label>
                <div className="flex items-center gap-1">
                  <div className="flex items-center gap-1 border rounded-md px-2 py-1.5">
                    <span className="text-muted-foreground">⏱</span>
                    <Input
                      type="number"
                      min="0"
                      max="23"
                      value={startTimeHour}
                      onChange={(e) => setStartTimeHour(e.target.value.padStart(2, "0"))}
                      className="w-12 border-0 p-0 text-center focus-visible:ring-0"
                    />
                    <span>:</span>
                    <Input
                      type="number"
                      min="0"
                      max="59"
                      step="15"
                      value={startTimeMinute}
                      onChange={(e) => setStartTimeMinute(e.target.value.padStart(2, "0"))}
                      className="w-12 border-0 p-0 text-center focus-visible:ring-0"
                    />
                  </div>
                </div>
              </div>

              {/* End Time */}
              <div className="space-y-2">
                <Label>Schedule End Time</Label>
                <div className="flex items-center gap-1">
                  <div className="flex items-center gap-1 border rounded-md px-2 py-1.5">
                    <span className="text-muted-foreground">⏱</span>
                    <Input
                      type="number"
                      min="0"
                      max="23"
                      value={endTimeHour}
                      onChange={(e) => setEndTimeHour(e.target.value.padStart(2, "0"))}
                      className="w-12 border-0 p-0 text-center focus-visible:ring-0"
                    />
                    <span>:</span>
                    <Input
                      type="number"
                      min="0"
                      max="59"
                      step="15"
                      value={endTimeMinute}
                      onChange={(e) => setEndTimeMinute(e.target.value.padStart(2, "0"))}
                      className="w-12 border-0 p-0 text-center focus-visible:ring-0"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Days Selection */}
            <div className="space-y-2">
              <Label>
                Select Days{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <div className="flex gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <Button
                    key={day}
                    type="button"
                    variant={selectedDays.includes(day) ? "default" : "outline"}
                    className={cn(
                      "w-16 h-10",
                      selectedDays.includes(day) && "bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-300"
                    )}
                    onClick={() => toggleDay(day)}
                  >
                    {day}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedDays.length === 0
                  ? "No days selected — shift will be created for every day in the date range"
                  : `Shift will only apply to ${selectedDays.join(", ")} within the date range`}
              </p>
            </div>
          </div>

          <Separator />

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => handleSubmit(false)}
              disabled={!isValid}
            >
              Add and Publish Shift
            </Button>
            <Button
              onClick={() => handleSubmit(true)}
              disabled={!isValid}
              className="bg-blue-900 hover:bg-blue-800"
            >
              Add
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
