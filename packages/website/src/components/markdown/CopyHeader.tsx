'use client'

import InsertLinkIcon from '@mui/icons-material/InsertLink'
import Link from 'next/link'
import { useCallback } from 'react'

import DefaultTooltipLazy from '@/components/tooltip/DefaultTooltipLazy'

export default function CopyHeader (props: {id: string, size?: 'big' | 'small'}) {
  const { id, size = 'big' } = props

  const onClick = useCallback(() => {
    const currentLocation = window.location.href
    const newLocation = currentLocation.includes('#')
      ? currentLocation.replace(/#.+$/, `#${id}`)
      : currentLocation + `#${id}`
    void navigator.clipboard.writeText(newLocation)
  }, [id])

  return (
    <DefaultTooltipLazy title={'Click to copy link'}>
      <Link
        href={`#${id}`}
        id={id}
        className={'self-center text-black'}
      >
        <InsertLinkIcon
          className={`${size === 'big' ? 'h-[30px]' : 'h-[20px] my-[-5px]'} mx-[-3px]`}
          onClick={onClick}
        />
      </Link>
    </DefaultTooltipLazy>
  )
}
