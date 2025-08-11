import * as React from "react";
import * as CheckboxPr from "@radix-ui/react-checkbox";
import { cn } from "@/lib/utils";

export const Checkbox = React.forwardRef<React.ElementRef<typeof CheckboxPr.Root>, React.ComponentPropsWithoutRef<typeof CheckboxPr.Root>>(
  ({ className, ...props }, ref) => (
    <CheckboxPr.Root
      ref={ref}
      className={cn("peer h-5 w-5 shrink-0 rounded-md border shadow focus-visible:outline-none data-[state=checked]:bg-black data-[state=checked]:text-white", className)}
      {...props}
    >
      <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </CheckboxPr.Root>
  )
);
Checkbox.displayName = "Checkbox";
