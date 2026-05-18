import * as React from 'react';
import { cn } from '@/lib/utils';

export function AdminFormSurface({
  className,
  children,
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-50/60 to-emerald-50/25 p-4 shadow-sm dark:border-slate-800 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AdminFormSection({
  title,
  description,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      {...props}
      className={cn(
        'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900',
        className,
      )}
    >
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {description}
          </p>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

export function AdminFormNote({
  className,
  children,
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900',
        className,
      )}
    >
      {children}
    </section>
  );
}
