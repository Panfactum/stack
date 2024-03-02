'use client'

import styled from '@emotion/styled'

import {
  BREAKPOINT,
  WEB_NAVBAR_BORDER_WIDTH_PX,
  WEB_NAVBAR_HEIGHT_REM,
  WEB_TABBAR_BORDER_WIDTH_PX,
  WEB_TABBAR_HEIGHT_REM
} from '@/components/theme'

const TabContainer = styled.nav`
  height: ${WEB_TABBAR_HEIGHT_REM}rem;
  min-height: ${WEB_TABBAR_HEIGHT_REM}rem !important;
  z-index: 50;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: baseline;
  background-color: ${props => props.theme.extraColors.gray.light};

  // Only on small devices
  bottom: calc(${WEB_NAVBAR_HEIGHT_REM}rem + ${WEB_NAVBAR_BORDER_WIDTH_PX}px);
  position: fixed;
  border-top: ${props => `${WEB_NAVBAR_BORDER_WIDTH_PX}px solid ${props.theme.extraColors.gray.dark}`};
  
  // Only on large devices
  @media (min-width: ${BREAKPOINT.SM}px) {
    border-top: none;
    border-bottom: ${props => `${WEB_TABBAR_BORDER_WIDTH_PX}px solid ${props.theme.palette.primary.light}`};
    position: sticky;
    top: calc(${WEB_NAVBAR_HEIGHT_REM}rem + ${WEB_NAVBAR_BORDER_WIDTH_PX}px);
    bottom: initial;
  }
`

export default TabContainer
