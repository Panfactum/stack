import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import { memo } from 'react'

import FooterContainer from '@/components/layout/web/primary/footer/FooterContainer'
import ScrollButtonContainer from '@/components/layout/web/primary/footer/ScrollButtonContainer'
import DefaultTooltipLazy from '@/components/tooltip/DefaultTooltipLazy'

export default memo(function Footer () {
  return (
    <FooterContainer>
      <ScrollButtonContainer>
        <DefaultTooltipLazy title="Scroll to top">
          <KeyboardArrowUpIcon/>
        </DefaultTooltipLazy>
      </ScrollButtonContainer>
      (c) Panfactum, LLC 2023-2024
    </FooterContainer>
  )
})
