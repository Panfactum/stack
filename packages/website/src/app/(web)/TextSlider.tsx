'use client'

import { clsx } from 'clsx'
import { useEffect, useState } from 'react'

interface TextSliderProps {
  items: string[]
}

export default function TextSlider (props: TextSliderProps) {
  const { items } = props
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timeout = setTimeout(() => {
      setIndex(index === items.length - 1 ? 0 : index + 1)
    }, 2500)
    return () => {
      clearTimeout(timeout)
    }
  }, [items, index, setIndex])

  return (
    <div className="relative h-7 sm:h-9 w-full flex justify-center overflow-hidden">
      {items.map((text, i) => (
        <span
          key={text}
          className={clsx('transition-all duration-1000 ease-in-out absolute', i === index ? '' : 'translate-y-10')}
        >
          {text}
        </span>
      ))}
    </div>

  )
}
