import { cva } from "class-variance-authority";
import React from "react";
import { cn } from "@/lib/utils.ts";

const alertVariants = cva(
  "flex gap-lg items-center text-sm px-[16px] border-l-4 mb-4",
  {
    variants: {
      severity: {
        info: "bg-accent dark:bg-brand-docs-info border-brand",
        warning:
          "bg-warning-primary dark:bg-brand-docs-warning border-warning",
        error:
          "bg-error-primary dark:bg-brand-docs-error border-error",
        success:
          "bg-success-primary dark:bg-brand-docs-success border-success",
      },
    },
    defaultVariants: {
      severity: "info",
    },
  },
);

type AlertProps = React.HTMLAttributes<HTMLDivElement> & {
  severity: "default" | "destructive";
};

const MarkdownAlert: React.FC<AlertProps> = ({
  className,
  severity,
  ...props
}) => {
  return (
    <div className={cn(alertVariants({ severity }), className)}>
      <div className={`w-full`} role="alert">
        {props.children}
      </div>
    </div>
  );
};

export default MarkdownAlert;
