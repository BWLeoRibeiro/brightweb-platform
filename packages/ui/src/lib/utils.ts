import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

const twMerge = extendTailwindMerge<"canonical-typography">({
  extend: {
    classGroups: {
      "canonical-typography": [
        "text-heading-1",
        "text-heading-2",
        "text-heading-3",
        "text-heading-4",
        "text-title",
        "text-body-lg",
        "text-body",
        "text-meta",
        "text-label",
        "text-micro",
        "text-kpi",
        "text-kpi-lg",
        "text-data-sm",
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
