import * as React from "react";
import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants = {
    default: "bg-emerald-100 text-emerald-700 border-transparent",
    secondary: "bg-gray-100 text-gray-700 border-transparent",
    destructive: "bg-red-100 text-red-700 border-transparent",
    outline: "text-gray-700 border-gray-200",
    success: "bg-emerald-100 text-emerald-700 border-transparent",
    warning: "bg-amber-100 text-amber-700 border-transparent",
  };
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium transition-colors",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
