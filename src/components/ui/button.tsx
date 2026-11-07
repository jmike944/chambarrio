import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

/*
 * Chambarrio: pill buttons with a tap squish (CSS, works in server components) and a
 * 1px hover lift on solid variants. Playful variants: lime (CTA on violet), violet, soft, white.
 * Sizes lg (48px) and xl (56px) are the big mobile CTAs.
 */
const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center rounded-4xl border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow,scale,translate,opacity] duration-150 ease-out outline-none select-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 active:not-aria-[haspopup]:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_8px_18px_-10px_var(--primary)] hover:-translate-y-px hover:bg-[color-mix(in_oklab,var(--primary),black_10%)]",
        violet:
          "bg-primary text-primary-foreground shadow-[0_8px_18px_-10px_var(--primary)] hover:-translate-y-px hover:bg-[color-mix(in_oklab,var(--primary),black_10%)]",
        lime:
          "bg-limon text-limon-foreground shadow-[0_8px_18px_-10px_rgb(22_15_51/0.55)] hover:-translate-y-px hover:bg-[color-mix(in_oklab,var(--limon),var(--ink)_7%)]",
        soft: "bg-tile text-uva-ink hover:bg-uva-soft aria-expanded:bg-uva-soft",
        white:
          "border-border bg-card text-card-foreground shadow-card hover:-translate-y-px hover:border-[color-mix(in_oklab,var(--primary)_30%,transparent)]",
        outline:
          "border-border bg-card hover:bg-tile hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-uva-ink underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        default:
          "h-9 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-6 gap-1 px-2.5 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        lg: "h-12 gap-2 px-5 text-base font-semibold has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4 [&_svg:not([class*='size-'])]:size-5",
        xl: "h-14 gap-2.5 px-7 text-[1.05rem] font-semibold has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5 [&_svg:not([class*='size-'])]:size-5",
        icon: "size-9",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-12 [&_svg:not([class*='size-'])]:size-5",
        "icon-xl": "size-14 [&_svg:not([class*='size-'])]:size-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
