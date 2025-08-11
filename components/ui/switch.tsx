import * as React from "react";
import * as SwitchPr from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export const Switch = React.forwardRef<React.ElementRef<typeof SwitchPr.Root>, React.ComponentPropsWithoutRef<typeof SwitchPr.Root>>(
  ({ className, ...props }, ref) => (
    <SwitchPr.Root
      ref={ref}
      className={cn("peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors data-[state=checked]:bg-black data-[state=unchecked]:bg-muted", className)}
      {...props}
    >
      <SwitchPr.Thumb className="pointer-events-none block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-5" />
    </SwitchPr.Root>
  )
);
Switch.displayName = "Switch";
