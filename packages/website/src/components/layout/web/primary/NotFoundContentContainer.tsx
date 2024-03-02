'use client'

import styled from '@emotion/styled'

import { FOOTER_SCROLL_BUTTON_HEIGHT_PX } from '@/components/layout/web/primary/footer/ScrollButtonContainer'
import {
  BREAKPOINT,
  WEB_FOOTER_HEIGHT_REM,
  WEB_NAVBAR_BORDER_WIDTH_PX,
  WEB_NAVBAR_HEIGHT_REM
} from '@/components/theme'

const NotFoundContentContainer = styled.article`
  width: 100%;
  padding: 0 1rem 2rem;
  background-color: ${({ theme }) => theme.extraColors.gray.light};
  min-height: calc(100vh - ${2 * WEB_NAVBAR_HEIGHT_REM}rem + ${FOOTER_SCROLL_BUTTON_HEIGHT_PX}px);
  
  @media (min-width: ${BREAKPOINT.SM}px) {
    min-height: calc(100vh - ${WEB_NAVBAR_HEIGHT_REM}rem - ${WEB_FOOTER_HEIGHT_REM}rem - ${WEB_NAVBAR_BORDER_WIDTH_PX}px);
  }
`

export default NotFoundContentContainer
