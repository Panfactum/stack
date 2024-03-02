'use client'

import styled from '@emotion/styled'

import {
  BREAKPOINT,
  WEB_NAVBAR_BORDER_WIDTH_PX,
  WEB_NAVBAR_HEIGHT_REM
} from '@/components/theme'

const NavbarContainer = styled.div`
  height: ${WEB_NAVBAR_HEIGHT_REM}rem;
  box-sizing: content-box;
  z-index: 50;
  background: ${props => props.theme.palette.primary.main};
  width: 100%;

  // Only on small devices
  bottom: 0;
  position: fixed;
  border-top: ${props => `${WEB_NAVBAR_BORDER_WIDTH_PX}px solid ${props.theme.extraColors.gray.dark}`};
  
  // Only on large devices
  @media (min-width: ${BREAKPOINT.SM}px) {
    border-top: none;
    border-bottom: ${props => `${WEB_NAVBAR_BORDER_WIDTH_PX}px solid ${props.theme.extraColors.gray.dark}`};
    position: sticky;
    top: 0;
    bottom: initial;
  }
`

export default NavbarContainer
