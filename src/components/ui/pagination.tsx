import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface PaginationProps {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  className?: string;
}

export function Pagination({ total, page, pageSize, onPageChange, onPageSizeChange, className }: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize);
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const pages: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("...");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  return (
    <div className={cn("flex flex-col sm:flex-row items-center justify-between gap-4", className)}>
      <div className="flex items-center gap-4 order-2 sm:order-1">
        <span className="text-slate-500 text-[11px] font-medium uppercase tracking-wider">
          Hiển thị <span className="text-slate-900 font-bold">{start}-{end}</span> / <span className="text-slate-900 font-bold">{total}</span>
        </span>
        
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[11px] font-medium uppercase">Dòng:</span>
            <Select 
              value={String(pageSize)} 
              onValueChange={(v) => onPageSizeChange(Number(v))}
            >
              <SelectTrigger className="h-7 w-[65px] text-[11px] font-bold rounded-lg bg-white border-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="min-w-[65px]">
                {[10, 30, 50, 100].map(s => (
                  <SelectItem key={s} value={String(s)} className="text-[11px] font-medium">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 order-1 sm:order-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <div className="flex items-center gap-0.5">
          {pages.map((p, i) =>
            p === "..." ? (
              <span key={`ellipsis-${i}`} className="w-8 text-center text-slate-300">…</span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p as number)}
                className={cn(
                  "h-8 w-8 rounded-lg text-xs font-bold transition-all",
                  p === page
                    ? "bg-emerald-600 text-white shadow-sm shadow-emerald-100"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                )}
              >
                {p}
              </button>
            )
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages || totalPages === 0}
          className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
