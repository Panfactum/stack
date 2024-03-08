import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {Fragment, memo, useCallback, useState } from 'react'

import type {
  IArticleNavLinkProps,
  IArticleNavProps,
  IArticleNavSectionProps,
  ITreeProps
} from '@/components/layout/web/article/withNav/types'

const NavLink = memo((props: IArticleNavLinkProps & ITreeProps) => {
  const { path, text, basePath, onNavigate } = props
  const currentPath = usePathname()
  const linkPath = `${basePath}${path}`
  const active = currentPath.startsWith(linkPath)

  // This allows long code identifiers (e.g., terraform module names) to be broken at their underscores
  const breakableText = text
    .split('_')
    .map(((t,i, l) => {
      return <Fragment key={t}>{t}{i === l.length - 1 ? '' : '_'}<wbr/></Fragment>
    }))

  return (
    <div className="flex items-center py-1">

      <Link
        href={linkPath}
        onClick={onNavigate}
        className={`${active ? 'text-black font-semibold' : 'text-secondary'} hover:cursor-pointer hover:text-black flex grow items-stretch justify-between leading-5 pr-1`}
      >
        <div>
          {breakableText}
        </div>
        {active
          ? (
            <div className={'self-stretch w-[4px] bg-primary rounded-[2px] z-10'}/>
          )
          : null}
      </Link>
    </div>
  )
})

const Section = memo((props: IArticleNavSectionProps & ITreeProps) => {
  const { text, sub, basePath, path, depth, onNavigate } = props
  const currentPath = usePathname()
  const sectionPath = `${basePath}${path}`
  const onPath = currentPath.startsWith(sectionPath)
  const [manualOpen, setManualOpen] = useState<boolean>(onPath)
  const newDepth = depth + 1
  const handleClick = useCallback(() => {
    setManualOpen(open => !open)
  }, [setManualOpen])

  const open = onPath || manualOpen

  return (
    <div>
      <div
        aria-controls={`${text}-content`}
        id={text}
        className={`py-1 flex flex-row justify-between items-center hover:cursor-pointer ${onPath ? 'text-black font-semibold' : 'text-secondary'} hover:text-black  border-solid`}
        onClick={handleClick}
      >
        <div className="flex items-center">
          {text}
        </div>
        <ExpandMoreIcon className={`${open ? 'rotate-180' : ''}`}/>
      </div>
      <div
        className={`${open ? '' : 'h-[0px]'} overflow-hidden`}
        style={{
          paddingLeft: 10 * newDepth
        }}
      >
        {sub.map(el => {
          if (el.sub !== undefined) {
            return (
              <Section
                key={el.text}
                {...el}
                depth={newDepth}
                basePath={sectionPath}
                onNavigate={onNavigate}
              />
            )
          } else {
            return (
              <NavLink
                key={el.text}
                {...el}
                depth={newDepth}
                basePath={sectionPath}
                onNavigate={onNavigate}
              />
            )
          }
        })}
      </div>
    </div>
  )
})

export default memo(function Nav (props: IArticleNavProps) {
  const { sections, basePath, onNavigate } = props
  return (
    <nav className="p-2">
      {sections.map(el => {
        if (el.sub !== undefined) {
          return (
            <Section
              key={el.text}
              {...el}
              depth={0}
              basePath={basePath}
              onNavigate={onNavigate}
            />
          )
        } else {
          return (
            <NavLink
              key={el.text}
              {...el}
              depth={0}
              basePath={basePath}
              onNavigate={onNavigate}
            />
          )
        }
      })}
    </nav>
  )
})
