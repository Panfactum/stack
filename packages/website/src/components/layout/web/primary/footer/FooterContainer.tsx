'use client'

import styled from '@emotion/styled'
import type { ReactNode } from 'react'
import { memo, useContext } from 'react'

import {
  BREAKPOINT,
  WEB_FOOTER_HEIGHT_REM, WEB_NAVBAR_BORDER_WIDTH_PX, WEB_NAVBAR_HEIGHT_REM, WEB_TABBAR_HEIGHT_REM
} from '@/components/theme'
import { SecondaryTabsVisibleContext } from '@/lib/contexts/web/SecondaryTabsVisible'

export const FOOTER_PADDING_REM = 4

const StyledFooterContainer = styled.footer<{secondaryTabAdjust?: boolean}>`
  height: ${WEB_FOOTER_HEIGHT_REM}rem;
  color: #FFFFFF;
  background: ${({ theme }) => theme.palette.primary.main};
  padding: ${FOOTER_PADDING_REM}rem;
  text-align: right;
  position: relative;
  z-index: 49;

  // Only on small devices
  margin-bottom: ${({ secondaryTabAdjust = false }) => `calc(${WEB_NAVBAR_HEIGHT_REM}rem + ${secondaryTabAdjust ? WEB_TABBAR_HEIGHT_REM : 0}rem + ${WEB_NAVBAR_BORDER_WIDTH_PX}px)`};
  
  // Only on large devices
  @media (min-width: ${BREAKPOINT.SM}px) {
    margin-bottom: 0;
  }
`

export default memo(function FooterContainer ({ children }: {children: ReactNode}) {
  const { visible } = useContext(SecondaryTabsVisibleContext)
  return (
    <StyledFooterContainer secondaryTabAdjust={visible}>
      {children}
    </StyledFooterContainer>
  )
})
