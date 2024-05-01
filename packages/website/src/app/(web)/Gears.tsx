'use client'

import { css, keyframes } from '@emotion/react'
import styled from '@emotion/styled'

import { colors } from '../../../theme'

const rotate = keyframes`
  0% {
      transform: rotate(0deg);
  }
  100% {
      transform :rotate(-180deg);
  }
`

const rotateLeft = keyframes`
  0% {
      transform: rotate(30deg);
  }
  100% {
      transform :rotate(210deg);
  }
`

const rotateLeft2 = keyframes`
  0% {
      transform: rotate(30deg);
  }
  100% {
      transform :rotate(-150deg);
  }
`

const color = colors.secondary
const sharedStyles = css`
    width: 48px;
    height: 48px;
    background: ${color};
    position: absolute;
    border-radius: 24px;
    &:before {
        width: 68px;
        height: 68px;
        background:
                linear-gradient(0deg,transparent 39%, ${color} 39%, ${color} 61%, transparent 61%),
                linear-gradient(60deg,transparent 42%, ${color} 42%, ${color} 58%, transparent 58%),
                linear-gradient(120deg,transparent 42%, ${color} 42%, ${color} 58%, transparent 58%);
        position: absolute;
        content:"";
        top: -10px;
        left: -10px;
        border-radius: 30px;
    }
    &:after {
        width: 24px;
        height: 24px;
        background: ${colors.accent};
        position: absolute;
        content:"";
        top: 12px;
        left: 12px;
        border-radius: 12px;
    }
`

const sharedStylesSmall = css`
    width: 24px;
    height: 24px;
    background: ${color};
    position: absolute;
    border-radius: 12px;
    &:before {
        width: 34px;
        height: 34px;
        background:
                linear-gradient(0deg,transparent 39%, ${color} 39%, ${color} 61%, transparent 61%),
                linear-gradient(60deg,transparent 42%, ${color} 42%, ${color} 58%, transparent 58%),
                linear-gradient(120deg,transparent 42%, ${color} 42%, ${color} 58%, transparent 58%);
        position: absolute;
        content:"";
        top: -5px;
        left: -5px;
        border-radius: 15px;
    }
    &:after {
        width: 12px;
        height: 12px;
        background: ${colors.accent};
        position: absolute;
        content:"";
        top: 6px;
        left: 6px;
        border-radius: 6px;
    }
`

const rotationSpeed = '60s'

const Gear = styled.div`
    ${sharedStyles};
    top: 60px;
    left: 78px;
    animation: ${rotate} ${rotationSpeed} linear infinite;
`

const Gear2 = styled.div`
    ${sharedStyles};
    left: 26px;
    top: 30px;
    animation: ${rotateLeft} ${rotationSpeed} linear infinite;
`

const Gear3 = styled.div`
    ${sharedStyles};
    left: 130px;
    top: 30px;
    animation: ${rotateLeft} ${rotationSpeed} linear infinite;
`

const Gear4 = styled.div`
    ${sharedStyles};
    left: 78px;
    top: 120px;
    animation: ${rotateLeft} ${rotationSpeed} linear infinite;
`

const Gear5 = styled.div`
    ${sharedStyles};
    left: 20px;
    top: 136px;
    animation: ${rotateLeft2} ${rotationSpeed} linear infinite;
`

const Gear6 = styled.div`
    ${sharedStyles};
    left: 134px;
    top: 136px;
    animation: ${rotateLeft2} ${rotationSpeed} linear infinite;
`

const Gear7 = styled.div`
    ${sharedStylesSmall};
    top: 30px;
    left: 39px;
    animation: ${rotate} ${rotationSpeed} linear infinite;
`

const Gear8 = styled.div`
    ${sharedStylesSmall};
    left: 13px;
    top: 15px;
    animation: ${rotateLeft} ${rotationSpeed} linear infinite;
`

const Gear9 = styled.div`
    ${sharedStylesSmall};
    left: 65px;
    top: 15px;
    animation: ${rotateLeft} ${rotationSpeed} linear infinite;
`

const Gear10 = styled.div`
    ${sharedStylesSmall};
    left: 91px;
    top: 30px;
    animation: ${rotate} ${rotationSpeed} linear infinite;
`

const Gear11 = styled.div`
    ${sharedStylesSmall};
    left: 117px;
    top: 15px;
    animation: ${rotateLeft} ${rotationSpeed} linear infinite;
`

export function Gears () {
  return (
    <div className="block min-w-[200px] h-[200px]">

      <div className="relative">
        <Gear/>
        <Gear2/>
        <Gear3/>
        <Gear4/>
        <Gear6/>
      </div>
    </div>
  )
}

export function Gears2 () {
  return (
    <div className="block min-w-[200px] h-[200px]">

      <div className="relative">
        <Gear/>
        <Gear2/>
        <Gear3/>
        <Gear4/>
        <Gear5/>

      </div>
    </div>
  )
}

export function Gears3 () {
  return (
    <div className="block min-w-[164px] h-[50px]">
      <div className="relative">
        <Gear7/>
        <Gear8/>
        <Gear9/>
        <Gear10/>
        <Gear11/>
      </div>
    </div>
  )
}
