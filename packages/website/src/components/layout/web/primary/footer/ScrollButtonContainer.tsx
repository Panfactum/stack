'use client'

import styled from '@emotion/styled'
import type { ReactNode } from 'react'
import { memo } from 'react'

export const FOOTER_SCROLL_BUTTON_HEIGHT_PX = 30
const StyledScrollButtonContainer = styled.button`
  position: absolute;
  top: -18px;
  left: calc(50% - 18px);
  color: ${({ theme }) => theme.palette.primary.main};
  background-color: ${({ theme }) => theme.extraColors.gray.light};
  border: ${({ theme }) => `2px solid ${theme.palette.primary.light}`};
  width: 10%;
  height: ${FOOTER_SCROLL_BUTTON_HEIGHT_PX}px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 5px;
  
  :hover {
    background-color: ${({ theme }) => theme.palette.primary.light};
  }
`

export default memo(function ScrollButtonContainer ({ children }: {children: ReactNode}) {
  return (
    <StyledScrollButtonContainer
      onClick={() => {
        window.scrollTo(0, 0)
      }}
    >
      {children}
    </StyledScrollButtonContainer>
  )
})
