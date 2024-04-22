import { headers } from 'next/headers'
import type { ReactElement, ReactNode } from 'react'
import Balancer from 'react-wrap-balancer'

export default function PrettyBalancer (props: { children: ReactElement | string | ReactNode }) {
  const nonce = headers().get('x-nonce')
  return (
    <Balancer
      ratio={0.2}
      preferNative={false}
      nonce={nonce || ''}
    >
      {props.children}
    </Balancer>
  )
}
