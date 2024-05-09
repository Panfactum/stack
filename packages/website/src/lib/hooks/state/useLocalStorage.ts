'use client'

import { useState } from 'react'

export function useLocalStorage<T> (key: string, initialValue: T) {
  const localData = typeof window !== 'undefined' ? localStorage.getItem(key) : undefined

  const [val, setVal] = useState<T>(localData ? JSON.parse(localData) as T : initialValue)

  return [val, (newVal: T) => {
    localStorage.setItem(key, JSON.stringify(newVal))
    setVal(newVal)
  }] as const
}
