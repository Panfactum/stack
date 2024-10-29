import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow hover:bg-primary/90',
        primary:
          'button-bg-primary button-text-primary border-2 button-border-primary',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        'secondary-gray':
          'button-bg-secondary-gray button-text-secondary-fg border button-border-secondary',

        destructive:
          'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        outline:
          'border border-primary bg-primary button-text-secondary-fg shadow-sm hover:bg-accent hover:text-accent-foreground',
        secondary:
          'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',

        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-[38px] lg:h-[50px] rounded-md py-md lg:py-lg px-lg lg:px-[18px] text-xs lg:text-md',
        md: 'h-9 rounded-md px-4 text-xs md:text-sm',
        lg: 'h-10 rounded-md py-[10px] px-xl text-md',
        xl: 'h-[52px] py-lg rounded-lg px-[18px] text-md',
        '2xl': 'h-12 rounded-lg px-6 text-md md:text-lg',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  href?: string
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        href={props.href}
        className={`${cn(buttonVariants({ variant, size, className }))} shadow-sm py-[10px]`}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
