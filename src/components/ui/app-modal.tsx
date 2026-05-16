/**
 * AppModal — Chuẩn hóa dialog theo shadcn/ui style
 * Dùng thay thế cho Dialog+DialogContent custom ở tất cả các trang.
 */
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AppModalAction {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'destructive' | 'outline' | 'ghost' | 'secondary';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
}

interface AppModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  /** accent color class for the header strip e.g. 'bg-emerald-600' */
  accent?: string;
  children?: React.ReactNode;
  /** Primary + secondary actions rendered in footer */
  actions?: AppModalAction[];
  /** If true, removes the top colored header and renders a simpler layout */
  plain?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_MAP = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
};

export function AppModal({
  open,
  onOpenChange,
  title,
  description,
  icon,
  accent = 'bg-emerald-600',
  children,
  actions,
  plain = false,
  size = 'md',
}: AppModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'p-0 border-0 shadow-2xl overflow-hidden',
          SIZE_MAP[size],
          'max-h-[90vh] flex flex-col'
        )}
      >
        {/* Header */}
        {plain ? (
          <DialogHeader className="px-6 pt-6 pb-2">
            <div className="flex items-center gap-3">
              {icon && <div className="text-slate-600">{icon}</div>}
              <div>
                <DialogTitle>{title}</DialogTitle>
                {description && <DialogDescription className="mt-1">{description}</DialogDescription>}
              </div>
            </div>
          </DialogHeader>
        ) : (
          <div className={cn('px-6 py-5 relative overflow-hidden', accent)}>
            {/* Decorative blob */}
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10 blur-2xl pointer-events-none" />
            <div className="relative z-10 flex items-start gap-3">
              {icon && (
                <div className="mt-0.5 text-white/90 shrink-0">{icon}</div>
              )}
              <div>
                <DialogTitle className="text-white text-base font-semibold leading-snug">
                  {title}
                </DialogTitle>
                {description && (
                  <DialogDescription className="text-white/70 text-xs mt-1 font-normal">
                    {description}
                  </DialogDescription>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Body */}
        {children && (
          <div className="px-6 py-5 overflow-y-auto flex-1 space-y-4">
            {children}
          </div>
        )}

        {/* Footer */}
        {actions && actions.length > 0 && (
          <DialogFooter className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 flex flex-row justify-end gap-2">
            {actions.map((action, i) => (
              <Button
                key={i}
                variant={action.variant ?? 'default'}
                onClick={action.onClick}
                disabled={action.disabled || action.loading}
                className={cn(
                  'h-9 px-4 text-sm font-medium rounded-lg transition-all duration-150',
                  action.variant === 'default' && !action.variant ? cn(accent, 'hover:opacity-90 text-white border-0') : ''
                )}
              >
                {action.loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                ) : action.icon ? (
                  <span className="mr-1.5">{action.icon}</span>
                ) : null}
                {action.label}
              </Button>
            ))}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
