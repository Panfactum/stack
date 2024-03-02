'use client'

import styled from '@emotion/styled'

import {
  BREAKPOINT,
  WEB_NAVBAR_HEIGHT_REM
} from '@/components/theme'

const MobileHeaderContainer = styled.div`
  height: ${WEB_NAVBAR_HEIGHT_REM}rem;
  box-sizing: content-box;
  z-index: 50;
  background: ${props => props.theme.palette.primary.main};
  width: 100%;

  display: block;
  position: sticky;
  top: 0;
  
  // Only on large devices
  @media (min-width: ${BREAKPOINT.SM}px) {
    display: none;
  }
`

export default MobileHeaderContainer
