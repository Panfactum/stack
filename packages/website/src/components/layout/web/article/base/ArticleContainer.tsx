'use client'

import styled from '@emotion/styled'
import type { ReactNode } from 'react'
import { memo, useContext } from 'react'

import { FOOTER_SCROLL_BUTTON_HEIGHT_PX } from '@/components/layout/web/primary/footer/ScrollButtonContainer'
import {
  BREAKPOINT,
  WEB_ARTICLE_MAX_WIDTH_PX, WEB_ARTICLE_SIDEBAR_WIDTH_PX,
  WEB_FOOTER_HEIGHT_REM,
  WEB_NAVBAR_BORDER_WIDTH_PX,
  WEB_NAVBAR_HEIGHT_REM,
  WEB_TABBAR_HEIGHT_REM
} from '@/components/theme'
import { SecondaryTabsVisibleContext } from '@/lib/contexts/web/SecondaryTabsVisible'

const StyledArticleContainer = styled.article<{withSidebar?: boolean, secondaryTabAdjust?: boolean}>`
  

  
  margin: 0 auto;
  padding: 0 1rem 2rem;

  box-sizing: border-box;
  

  width: 100%;
  max-width: ${WEB_ARTICLE_MAX_WIDTH_PX}px;

  min-height: ${({ secondaryTabAdjust = false }) => `calc(100vh - ${secondaryTabAdjust ? WEB_TABBAR_HEIGHT_REM : 0}rem - ${2 * WEB_NAVBAR_HEIGHT_REM}rem + ${FOOTER_SCROLL_BUTTON_HEIGHT_PX}px`});
  
  @media (min-width: ${BREAKPOINT.SM}px) {
    // This ensures that footer is displayed at the bottom of the page in case the article
    // is too short. Note that we take into account the navbar border width as it has box-sizing equal to content-box
    min-height: ${({ secondaryTabAdjust = false }) => `calc(100vh - ${secondaryTabAdjust ? WEB_TABBAR_HEIGHT_REM : 0}rem - ${WEB_NAVBAR_HEIGHT_REM}rem - ${WEB_FOOTER_HEIGHT_REM}rem - ${WEB_NAVBAR_BORDER_WIDTH_PX}px`});

    // The total content width should NEVER exceed WEB_ARTICLE_MAX_WIDTH_PX so if a sidebar exists we need to take that into
    // account when determining the max width of the article. The sidebar is only embedded in the document layout on larger screens.
    max-width: ${({ withSidebar = false }) => withSidebar ? `min(${WEB_ARTICLE_MAX_WIDTH_PX - WEB_ARTICLE_SIDEBAR_WIDTH_PX}px, calc(100vw - ${WEB_ARTICLE_SIDEBAR_WIDTH_PX}px))` : `${WEB_ARTICLE_MAX_WIDTH_PX}px`};
  }
`

export default memo(function ArticleContainer ({ children, withSidebar }: {children: ReactNode, withSidebar?: boolean}) {
  const { visible } = useContext(SecondaryTabsVisibleContext)
  return (
    <StyledArticleContainer
      secondaryTabAdjust={visible}
      withSidebar={withSidebar}
    >
      {children}
    </StyledArticleContainer>
  )
})
