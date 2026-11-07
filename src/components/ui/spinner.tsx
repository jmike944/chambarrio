import { cn } from "cn"
import { HugeiconsIcon } from "@hugeicons/react"
import { Loading03Icon } from "@hugeicons/core-free-icons"

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- strokeWidth is set explicitly below
function Spinner({ className, strokeWidth: _sw, ...props }: React.ComponentProps<"svg">) {
  return (
    <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} data-slot="spinner" role="status" aria-label="Cargando" className={cn("size-4 animate-spin", className)} {...props} />
  )
}

export { Spinner }
