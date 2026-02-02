"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { searchICD10Codes, getCategories, type ICD10Code } from "@/lib/icd10-codes"

interface ICD10ComboboxProps {
  value?: string
  onSelect: (code: string, description: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function ICD10Combobox({
  value,
  onSelect,
  placeholder = "Search ICD-10 codes...",
  disabled = false,
  className,
}: ICD10ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [results, setResults] = React.useState<ICD10Code[]>([])

  // Search when query changes
  React.useEffect(() => {
    if (searchQuery.length >= 2) {
      const searchResults = searchICD10Codes(searchQuery, 50)
      setResults(searchResults)
    } else {
      setResults([])
    }
  }, [searchQuery])

  // Group results by category for better UX
  const groupedResults = React.useMemo(() => {
    const groups = new Map<string, ICD10Code[]>()
    for (const code of results) {
      const existing = groups.get(code.category) || []
      existing.push(code)
      groups.set(code.category, existing)
    }
    return groups
  }, [results])

  const handleSelect = (code: ICD10Code) => {
    onSelect(code.code, code.description)
    setSearchQuery("")
    setResults([])
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          {value ? (
            <span className="truncate">{value}</span>
          ) : (
            <span className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              {placeholder}
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Type condition or code (min 2 chars)..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            {searchQuery.length < 2 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Type at least 2 characters to search
              </div>
            ) : results.length === 0 ? (
              <CommandEmpty>No ICD-10 codes found.</CommandEmpty>
            ) : (
              Array.from(groupedResults.entries()).map(([category, codes]) => (
                <CommandGroup key={category} heading={category}>
                  {codes.map((code) => (
                    <CommandItem
                      key={code.code}
                      value={code.code}
                      onSelect={() => handleSelect(code)}
                      className="flex flex-col items-start py-2"
                    >
                      <div className="flex w-full items-center gap-2">
                        <span className="font-mono font-semibold text-primary">
                          {code.code}
                        </span>
                        <span className="flex-1 truncate text-sm">
                          {code.description}
                        </span>
                        {value === code.code && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/**
 * Simplified ICD-10 combobox that just adds codes without showing selected value
 * Useful for adding multiple codes to a list
 */
interface ICD10AddComboboxProps {
  onAdd: (code: string, description: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  existingCodes?: string[]
}

export function ICD10AddCombobox({
  onAdd,
  placeholder = "Search to add ICD-10 code...",
  disabled = false,
  className,
  existingCodes = [],
}: ICD10AddComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [results, setResults] = React.useState<ICD10Code[]>([])

  // Search when query changes
  React.useEffect(() => {
    if (searchQuery.length >= 2) {
      const searchResults = searchICD10Codes(searchQuery, 50)
      setResults(searchResults)
    } else {
      setResults([])
    }
  }, [searchQuery])

  // Group results by category
  const groupedResults = React.useMemo(() => {
    const groups = new Map<string, ICD10Code[]>()
    for (const code of results) {
      const existing = groups.get(code.category) || []
      existing.push(code)
      groups.set(code.category, existing)
    }
    return groups
  }, [results])

  const handleSelect = (code: ICD10Code) => {
    onAdd(code.code, code.description)
    setSearchQuery("")
    setResults([])
    // Keep open so user can add more codes
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <span className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            {placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Type condition or code (min 2 chars)..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            {searchQuery.length < 2 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Type at least 2 characters to search
              </div>
            ) : results.length === 0 ? (
              <CommandEmpty>No ICD-10 codes found.</CommandEmpty>
            ) : (
              Array.from(groupedResults.entries()).map(([category, codes]) => (
                <CommandGroup key={category} heading={category}>
                  {codes.map((code) => {
                    const alreadyAdded = existingCodes.includes(code.code)
                    return (
                      <CommandItem
                        key={code.code}
                        value={code.code}
                        onSelect={() => !alreadyAdded && handleSelect(code)}
                        className={cn(
                          "flex flex-col items-start py-2",
                          alreadyAdded && "opacity-50"
                        )}
                        disabled={alreadyAdded}
                      >
                        <div className="flex w-full items-center gap-2">
                          <span className="font-mono font-semibold text-primary">
                            {code.code}
                          </span>
                          <span className="flex-1 truncate text-sm">
                            {code.description}
                          </span>
                          {alreadyAdded && (
                            <Check className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              ))
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/**
 * ICD-10 combobox for selecting primary diagnosis
 * Returns formatted string like "Type 2 Diabetes (E11.9)"
 */
interface ICD10DiagnosisComboboxProps {
  value?: string
  onSelect: (formattedDiagnosis: string, code: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function ICD10DiagnosisCombobox({
  value,
  onSelect,
  placeholder = "Search for primary diagnosis...",
  disabled = false,
  className,
}: ICD10DiagnosisComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [results, setResults] = React.useState<ICD10Code[]>([])

  // Search when query changes
  React.useEffect(() => {
    if (searchQuery.length >= 2) {
      const searchResults = searchICD10Codes(searchQuery, 50)
      setResults(searchResults)
    } else {
      setResults([])
    }
  }, [searchQuery])

  // Group results by category
  const groupedResults = React.useMemo(() => {
    const groups = new Map<string, ICD10Code[]>()
    for (const code of results) {
      const existing = groups.get(code.category) || []
      existing.push(code)
      groups.set(code.category, existing)
    }
    return groups
  }, [results])

  const handleSelect = (code: ICD10Code) => {
    // Format as "Description (CODE)"
    const formatted = `${code.description} (${code.code})`
    onSelect(formatted, code.code)
    setSearchQuery("")
    setResults([])
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal h-auto min-h-[40px] whitespace-normal text-left",
            !value && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          {value ? (
            <span className="line-clamp-2">{value}</span>
          ) : (
            <span className="flex items-center gap-2">
              <Search className="h-4 w-4 shrink-0" />
              {placeholder}
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Type condition or code (min 2 chars)..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            {searchQuery.length < 2 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Type at least 2 characters to search
              </div>
            ) : results.length === 0 ? (
              <CommandEmpty>No ICD-10 codes found.</CommandEmpty>
            ) : (
              Array.from(groupedResults.entries()).map(([category, codes]) => (
                <CommandGroup key={category} heading={category}>
                  {codes.map((code) => (
                    <CommandItem
                      key={code.code}
                      value={code.code}
                      onSelect={() => handleSelect(code)}
                      className="flex flex-col items-start py-2"
                    >
                      <div className="flex w-full items-center gap-2">
                        <span className="font-mono font-semibold text-primary">
                          {code.code}
                        </span>
                        <span className="flex-1 truncate text-sm">
                          {code.description}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
