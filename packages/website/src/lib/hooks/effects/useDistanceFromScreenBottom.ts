// We use this to dynamically set the maxHeight of all layout content. This is to ensure that
// we can get an independent vertical scrollbar on containers in the main layout.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export default function useDistanceFromScreenBottom<T extends HTMLElement> (deps: unknown[] = []) {
  const contentRef = useRef<T>(null)
  const [contentDistanceFromViewportBottom, setContentDistanceFromViewportBottom] = useState(0)

  // Update the layout state on first render and on window resizing
  const handleResize = () => {
    if (contentRef.current) {
      const rect = contentRef.current.getBoundingClientRect()
      setContentDistanceFromViewportBottom(window.innerHeight - rect.top)
    }
  }
  useEffect(() => {
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(handleResize, [contentRef, ...deps])

  return [contentDistanceFromViewportBottom, contentRef] as const
}
