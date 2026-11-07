import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

/*
 * Chambarrio additions: lime / violet / soft chips, and `status` — a chip with a leading
 * dot ("● En revisión"). The dot uses currentColor unless you set --dot, e.g.
 * <Badge variant="status" style={{ "--dot": "var(--nopal)" } as React.CSSProperties}>.
 * Sizes: default (20px, legacy), md (28px chip), lg (32px chip).
 */
const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border bg-input/30 text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
        lime: "bg-limon text-limon-foreground [a]:hover:bg-limon/85",
        violet: "bg-primary text-primary-foreground [a]:hover:bg-primary/85",
        soft: "bg-tile text-uva-ink [a]:hover:bg-uva-soft",
        status:
          "border-border bg-card text-foreground before:size-1.5 before:shrink-0 before:rounded-full before:bg-[var(--dot,currentColor)] before:content-['']",
      },
      size: {
        default: "",
        md: "h-7 gap-1.5 px-2.5 text-[0.8rem] [&>svg]:size-3.5! before:size-2",
        lg: "h-8 gap-1.5 px-3 text-sm [&>svg]:size-4! before:size-2",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
