import React, { type ReactNode } from 'react'

export interface TooltipProps {
  children: ReactNode // Content to wrap (e.g., a button)
  title: string // The text to display in the tooltip
  position?: 'top' | 'bottom' | 'left' | 'right' // Position of the tooltip
}

const Tooltip: React.FC<TooltipProps> = ({
  children,
  title,
  position = 'bottom',
}) => {
  const positionClasses: Record<string, string> = {
    top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 transform -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 transform -translate-y-1/2 ml-2',
  }

  const pos = positionClasses[position]

  return (
    <div className="relative inline-block group">
      {/* Wrapped Content */}
      {children}

      {/* Tooltip */}
      <div
        className={`z-40 absolute bg-primary-solid dark:bg-primary 
          px-2 py-1 
          text-sm text-white 
          rounded shadow-md 
          hidden group-hover:inline transition-opacity duration-200 min-w-[400px] w-full max-w-[700px] ${pos}`}
        style={{ whiteSpace: 'pre-lines' }}
      >
        {title}
      </div>
    </div>
  )
}

export default Tooltip
