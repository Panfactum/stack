'use client'

import styled from '@emotion/styled'

import {
  WEB_ARTICLE_MAX_WIDTH_PX
} from '@/components/theme'

const ArticleWithNavContainer = styled.div`
  width: 100%;
  max-width: min(100vw, ${WEB_ARTICLE_MAX_WIDTH_PX}px);
  display: flex;
  flex-direction: row;
  margin: auto;
`

export default ArticleWithNavContainer
