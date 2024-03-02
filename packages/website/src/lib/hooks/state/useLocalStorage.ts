import { useState } from 'react'

export function useLocalStorage<T> (key: string, initialValue: T) {
  const localData = localStorage.getItem(key)

  const [val, setVal] = useState<T>(localData ? JSON.parse(localData) as T : initialValue)

  return [val, (newVal: T) => {
    localStorage.setItem(key, JSON.stringify(newVal))
    setVal(newVal)
  }] as const
}
