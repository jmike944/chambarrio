"use client"

import * as React from "react"
import { cn } from "cn"
import { Progress as ProgressPrimitive } from "radix-ui"

const INDICATOR = {
  default: "bg-primary",
  lime: "bg-limon",
  spectrum: "bg-spectrum",
} as const

/** variant: "default" (violet), "lime" (on violet surfaces), "spectrum" (distance scale). */
function Progress({
  className,
  value,
  variant = "default",
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  variant?: keyof typeof INDICATOR
}) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "relative flex h-3 w-full items-center overflow-x-hidden rounded-4xl bg-tile",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        data-variant={variant}
        className={cn(
          "size-full flex-1 rounded-4xl transition-transform duration-700 ease-[cubic-bezier(.2,.8,.2,1)]",
          INDICATOR[variant]
        )}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
