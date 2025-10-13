"use client"

import * as React from "react"
import { ChevronsUpDown, Check } from "lucide-react"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export function Combobox({ options = [], value, onChange, placeholder = "Selecione..." }) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState(value || "")

  React.useEffect(() => {
    setInputValue(value || "")
  }, [value])

  const filtered = React.useMemo(() => {
    const q = (inputValue || "").toLowerCase()
    return options.filter((opt) => opt.label.toLowerCase().includes(q))
  }, [options, inputValue])

  const handleSelect = (opt) => {
    setInputValue(opt.label)
    onChange?.(opt.label) // persist human-friendly text
    setOpen(false)
  }

  const handleChange = (e) => {
    const v = e.target.value
    setInputValue(v)
    onChange?.(v) // allow free-typed values to persist
    if (!open) setOpen(true)
  }

  const handleBlur = () => {
    // allow click on suggestion before closing
    setTimeout(() => setOpen(false), 100)
  }

  return (
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Input
              value={inputValue}
              onChange={handleChange}
              onFocus={() => setOpen(true)}
              onBlur={handleBlur}
              placeholder={placeholder}
              className="pr-8"
            />
            <ChevronsUpDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
          <div className="max-h-60 overflow-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum resultado encontrado.</div>
            ) : (
              filtered.map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-center gap-2",
                    inputValue?.toLowerCase() === opt.label.toLowerCase() && "bg-accent text-accent-foreground"
                  )}
                  onMouseDown={(e) => e.preventDefault()} // prevent Input blur before click
                  onClick={() => handleSelect(opt)}
                >
                  <Check
                    className={cn(
                      "h-4 w-4",
                      inputValue?.toLowerCase() === opt.label.toLowerCase() ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {opt.label}
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
