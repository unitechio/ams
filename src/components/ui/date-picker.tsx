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
  includeTime?: boolean
}

function parseDateValue(value?: string) {
  if (!value) return undefined
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

function range(limit: number) {
  return Array.from({ length: limit }, (_, index) => index)
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Chọn ngày",
  className,
  hideIcon = false,
  includeTime = false,
}: DatePickerProps) {
  const dateValue = parseDateValue(value)

  const commitDate = React.useCallback((nextDate: Date | undefined) => {
    if (!nextDate) {
      onChange?.(undefined)
      return
    }
    onChange?.(
      includeTime
        ? format(nextDate, "yyyy-MM-dd'T'HH:mm:ss")
        : format(nextDate, "yyyy-MM-dd"),
    )
  }, [includeTime, onChange])

  const updateTimePart = (part: "hours" | "minutes" | "seconds", nextValue: number) => {
    const nextDate = dateValue ? new Date(dateValue) : new Date()
    if (part === "hours") nextDate.setHours(nextValue)
    if (part === "minutes") nextDate.setMinutes(nextValue)
    if (part === "seconds") nextDate.setSeconds(nextValue)
    commitDate(nextDate)
  }

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
          {dateValue
            ? format(dateValue, includeTime ? "dd/MM/yyyy HH:mm:ss" : "dd/MM/yyyy")
            : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950" align="start">
        <div className="rounded-xl bg-white dark:bg-slate-950">
          <Calendar
            className="rounded-xl bg-white dark:bg-slate-950"
            mode="single"
            selected={dateValue}
            onSelect={(selectedDate) => {
              if (!selectedDate) {
                commitDate(undefined)
                return
              }
              const nextDate = dateValue ? new Date(dateValue) : new Date()
              nextDate.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate())
              commitDate(nextDate)
            }}
            initialFocus
          />
          {includeTime && (
            <div className="grid grid-cols-3 gap-2 border-t border-slate-200 p-3 dark:border-slate-800">
              <label className="space-y-1 text-xs text-slate-500">
                <span>Giờ</span>
                <select
                  value={dateValue?.getHours() ?? 0}
                  onChange={(e) => updateTimePart("hours", Number(e.target.value))}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  {range(24).map((hour) => (
                    <option key={hour} value={hour}>{String(hour).padStart(2, "0")}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs text-slate-500">
                <span>Phút</span>
                <select
                  value={dateValue?.getMinutes() ?? 0}
                  onChange={(e) => updateTimePart("minutes", Number(e.target.value))}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  {range(60).map((minute) => (
                    <option key={minute} value={minute}>{String(minute).padStart(2, "0")}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs text-slate-500">
                <span>Giây</span>
                <select
                  value={dateValue?.getSeconds() ?? 0}
                  onChange={(e) => updateTimePart("seconds", Number(e.target.value))}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  {range(60).map((second) => (
                    <option key={second} value={second}>{String(second).padStart(2, "0")}</option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
