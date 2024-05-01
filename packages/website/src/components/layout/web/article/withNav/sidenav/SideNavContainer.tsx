'use client'

import styled from '@emotion/styled'

import {
  BREAKPOINT,
  WEB_ARTICLE_SIDEBAR_WIDTH_PX,
  WEB_FOOTER_HEIGHT_REM,
  WEB_NAVBAR_BORDER_WIDTH_PX,
  WEB_NAVBAR_HEIGHT_REM,
  WEB_TABBAR_HEIGHT_REM
} from '@/components/theme'

const SideNavContainer = styled.aside`
  
  // This ensures that footer is displayed at the bottom of the page in case the article
  // is too short. Note that we take into account the navbar border width as it has box-sizing equal to content-box
  min-height: calc(100vh - ${WEB_TABBAR_HEIGHT_REM}rem - ${WEB_NAVBAR_HEIGHT_REM}rem - ${WEB_FOOTER_HEIGHT_REM}rem - ${WEB_NAVBAR_BORDER_WIDTH_PX}px);
  
  min-width: ${WEB_ARTICLE_SIDEBAR_WIDTH_PX}px;
  width: ${WEB_ARTICLE_SIDEBAR_WIDTH_PX}px;
  border-right: ${({ theme }) => `2px solid ${theme.palette.primary.light}`};
  position: sticky;
  top: calc(${WEB_TABBAR_HEIGHT_REM}rem + ${WEB_NAVBAR_HEIGHT_REM}rem + ${WEB_NAVBAR_BORDER_WIDTH_PX}px);
  
  display: none;
  @media (min-width: ${BREAKPOINT.SM}px) {
    display: block;
  }
`

export default SideNavContainer
