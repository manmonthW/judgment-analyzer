import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, variant = "default", ...props }: React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "secondary" | "destructive" }) {
  const styles =
    variant === "secondary"
      ? "bg-muted text-foreground"
      : variant === "destructive"
      ? "bg-red-600 text-white"
      : "bg-black text-white";
  return <div className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", styles, className)} {...props} />;
}
