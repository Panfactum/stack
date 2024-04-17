import { headers } from 'next/headers'
import type { ReactElement } from 'react'
import Balancer from 'react-wrap-balancer'

export default function PrettyBalancer (props: { children: ReactElement | string }) {
  const nonce = headers().get('x-nonce')
  return (
    <Balancer
      ratio={0.5}
      preferNative={false}
      nonce={nonce || ''}
    >
      {props.children}
    </Balancer>
  )
}
