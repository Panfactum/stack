'use client'
import ArrowRightIcon from '@mui/icons-material/ArrowRight'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import Button from '@mui/material/Button'
import Drawer from '@mui/material/Drawer'
import { usePathname } from 'next/navigation'
import { Fragment, memo, useCallback, useState } from 'react'

import Nav from '@/components/layout/web/article/withNav/nav/Nav'
import type { IArticleNavProps } from '@/components/layout/web/article/withNav/types'

function buildBreadcrumbs (sections: IArticleNavProps['sections'], path: string): string[] {
  for (const section of sections) {
    if (path.startsWith(section.path)) {
      if (section.sub) {
        const newPath = path.substring(section.path.length)
        return [section.text].concat(buildBreadcrumbs(section.sub, newPath))
      } else {
        return [section.text]
      }
    }
  }
  return []
}

export default memo(function TopNav (props: IArticleNavProps) {
  const [open, setOpen] = useState(false)
  const toggleDrawer = useCallback(() => {
    setOpen(open => !open)
  }, [setOpen])
  const currentPath = usePathname()
  const { sections, basePath } = props
  const breadCrumbs = buildBreadcrumbs(sections, currentPath.substring(basePath.length))
  return (
    <>
      <div className="flex flex-row w-full sm:hidden justify-between border-b-2 border-solid border-neutral px-4 py-2 items-center gap-x-2">
        <div className="font-semibold text-sm flex flex-row items-center flex-wrap">
          {breadCrumbs.map((text, i) => {
            return (
              <Fragment key={text}>
                <span>
                  {text}
                </span>
                {i !== breadCrumbs.length - 1 && (
                  <ArrowRightIcon className="p-0 min-h-0 min-w-0"/>
                )}
              </Fragment>
            )
          })}
        </div>
        <Button
          onClick={toggleDrawer}
          variant="contained"
          className="min-w-[30px] py-0 px-1"
        >
          <KeyboardArrowDownIcon/>
        </Button>
      </div>
      <Drawer
        anchor={'top'}
        open={open}
        onClose={toggleDrawer}
        classes={{
          paper: 'max-h-[75vh]'
        }}
      >
        <Nav
          {...props}
          onNavigate={toggleDrawer}
        />
      </Drawer>
    </>
  )
})
