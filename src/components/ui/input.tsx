import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "flex h-12 w-full rounded-md border border-border bg-card px-3 font-mono text-base text-foreground shadow-sm placeholder:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
