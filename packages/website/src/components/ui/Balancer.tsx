'use client'

import type { ReactElement, ReactNode } from 'react'
import WrapBalancer from 'react-wrap-balancer'

export default function Balancer (props: { children: ReactElement | string | ReactNode }) {
  return (
    <WrapBalancer>
      {props.children}
    </WrapBalancer>
  )
}
