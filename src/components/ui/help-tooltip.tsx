import React from 'react';
import { HelpCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export function HelpTooltip({
  title,
  content,
  className,
}: {
  title?: string;
  content: React.ReactNode;
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={title || 'Xem hướng dẫn'}
          className={cn(
            'inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:text-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
            className,
          )}
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 rounded-2xl border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-950">
        {title ? <p className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</p> : null}
        <div className="text-xs leading-5 text-slate-600 dark:text-slate-300">{content}</div>
      </PopoverContent>
    </Popover>
  );
}

export function FieldLabelWithHelp({
  label,
  helpTitle,
  helpContent,
}: {
  label: string;
  helpTitle?: string;
  helpContent: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{label}</span>
      <HelpTooltip title={helpTitle} content={helpContent} />
    </span>
  );
}
