import * as React from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AdminCard({
  className,
  children,
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AdminToolbar({
  className,
  children,
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800 md:flex-row md:items-center',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AdminSearchField({
  className,
  children,
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('relative flex-1', className)}>
      <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
      {children}
    </div>
  );
}

export function AdminTableFooter({
  className,
  children,
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'border-t border-slate-100 px-4 py-3 dark:border-slate-800',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AdminLoadingState({
  className,
  children,
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex items-center justify-center py-16 text-slate-500 dark:text-slate-400',
        className,
      )}
    >
      {children}
    </div>
  );
}
