import {clsx} from "clsx";
import type {ReactNode, MouseEvent} from "react";
import * as React from "react";

interface ButtonProps {
  size?: "sm" | "md" | "lg" | "xl"
  variant?: "primary" | "secondary"
  className?: string
  children: string | ReactNode
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void
}

const sizes = {
  sm: "py-2 px-2 rounded",
  md: "py-3 px-4 rounded-xl",
  lg: "py-6 px-6 rounded-2xl",
  xl: "py-8 px-8 rounded-2xl"
}

const variants = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  tertiary: "btn-tertiary",
}


export default function Button({size = "md", variant = "primary", className, onClick, children}: ButtonProps){
  return (
    <button
      onClick={onClick}
      className={clsx([
        sizes[size],
        variants[variant],
        className
      ])}

    >
      {children}
    </button>
  )
}