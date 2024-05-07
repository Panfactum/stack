'use client'

import type { ReactElement, ReactNode } from 'react'
import Balancer from 'react-wrap-balancer'

export default function PrettyBalancer (props: { children: ReactElement | string | ReactNode }) {
  return (
    <Balancer
      ratio={0.2}
      preferNative={false}
    >
      {props.children}
    </Balancer>
  )
}
