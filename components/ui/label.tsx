import * as React from "react";
import * as LabelPr from "@radix-ui/react-label";
import { cn } from "@/lib/utils";

export const Label = React.forwardRef<React.ElementRef<typeof LabelPr.Root>, React.ComponentPropsWithoutRef<typeof LabelPr.Root>>(
  ({ className, ...props }, ref) => <LabelPr.Root ref={ref} className={cn("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className)} {...props} />
);
Label.displayName = "Label";
