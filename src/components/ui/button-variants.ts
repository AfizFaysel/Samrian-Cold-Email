// Kept out of button.tsx so server components can style links as buttons.
import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-clip-padding text-base font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-accent focus-visible:ring-3 focus-visible:ring-accent/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-error aria-invalid:ring-3 aria-invalid:ring-error/20 dark:aria-invalid:border-error/50 dark:aria-invalid:ring-error/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-accent-bg text-on-accent hover:bg-accent-bg/90 aria-expanded:bg-accent-bg/90",
        outline: "border-border bg-card text-primary hover:bg-muted aria-expanded:bg-muted",
        secondary:
          "bg-muted text-primary hover:bg-[color-mix(in_oklab,var(--color-background-muted),var(--color-text-primary)_7%)] aria-expanded:bg-[color-mix(in_oklab,var(--color-background-muted),var(--color-text-primary)_7%)]",
        ghost: "text-primary hover:bg-muted aria-expanded:bg-muted",
        destructive:
          "bg-error-muted text-error hover:bg-[color-mix(in_oklab,var(--color-error-muted),var(--color-error)_12%)] focus-visible:border-error/40 focus-visible:ring-error/20",
        link: "text-accent underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-sm in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-sm in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-2 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-md",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);
