import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  value?: string // YYYY-MM-DD
  onChange?: (date?: string) => void
  placeholder?: string
  className?: string
  hideIcon?: boolean
}

export function DatePicker({ value, onChange, placeholder = "Chọn ngày", className, hideIcon = false }: DatePickerProps) {
  const dateValue = value ? new Date(value) : undefined

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal h-10 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm shadow-none",
            !value && "text-muted-foreground",
            className
          )}
        >
          {!hideIcon && <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />}
          {dateValue ? format(dateValue, "dd/MM/yyyy") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950" align="start">
        <Calendar
          className="rounded-xl bg-white dark:bg-slate-950"
          mode="single"
          selected={dateValue}
          onSelect={(d) => onChange?.(d ? format(d, "yyyy-MM-dd") : undefined)}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
