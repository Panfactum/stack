import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex gap- items-center rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        brand: "bg-brand-primary border-utility-brand-50",
        outline: "bg-primary text-secondary border-primary",

        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
      },

      size: {
        sm: "py-xxs px-[10px] text-xs gap-x-xs font-medium",
        md: "py-xxs px-[10px] text-sm gap-x-sm font-medium",
        lg: "py-xs px-lg text-sm gap-x-md font-semibold",
      },
    },

    defaultVariants: {
      variant: "brand",
      size: "lg",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <div
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
