import { faGithub } from '@fortawesome/free-brands-svg-icons'
import { faBars, faXmark } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useEffect, useState } from 'react'
import { HeaderNavMobile } from '@/components/layout/header-nav-mobile.tsx'
import { GetStarted } from '@/components/marketing/GetStarted.tsx'
import { PanfactumLogo } from '@/components/panfactum-logo.tsx'
import { useLastDocumentationPath } from '@/hooks/useNavReferenceLink.ts'
import { Button } from '../ui/button.tsx'
import './header-nav.css'

export interface HeaderNav {
  currentPath: string
  darkBackground: boolean
  hasBorder: boolean
}

export interface NavLinks {
  title: string
  url: string
  override?: string
}

const GITHUB_URL = 'https://github.com/Panfactum/stack'

export function HeaderNav({ currentPath, hasBorder, ...props }: HeaderNav) {
  const { link: documentationPath } = useLastDocumentationPath()

  const [mobileOpened, setMobileOpened] = useState(false)
  const [navLinks, setNavLinks] = useState<NavLinks[]>([
    {
      title: 'Pricing',
      url: '/pricing',
    },
    {
      title: 'Docs',
      url: '/docs',
    },
    {
      title: 'About',
      url: '/about',
    },
  ])

  useEffect(() => {
    const newLinks = navLinks.map((link) => {
      if (link.title === 'Docs') {
        return {
          ...link,
          override: documentationPath,
        }
      }
      return link
    })

    setNavLinks(newLinks)
  }, [documentationPath])


  return (
    <div
      className={`flex items-center justify-center h-20 border-b w-full ${hasBorder ? 'border-primary' : 'border-[transparent]'}`}
    >
      <div
        className={`container flex justify-between items-center self-stretch ${props.darkBackground ? 'dark' : ''} px-container-padding-mobile xl:px-container-padding-desktop`}
      >
        <div className="flex space-x-5xl">
          <a href="/">
            <PanfactumLogo />
          </a>
          <nav className="hidden gap-x-xl lg:gap-x-5xl self-stretch text-base md:flex button-text-tertiary-fg">
            {navLinks.map((link) => {
              return (
                <Button
                  variant="ghost"
                  size="lg"
                  className={`!px-0 ${props.darkBackground ? 'text-offWhite' : 'text-tertiary'} hover:text-primary shadow-none ${currentPath.includes(link.url) ? 'text-primary font-bold' : ''}`}
                  asChild={true}
                  key={link.title}
                >
                  <a href={`${link.url}/${link.override || ''}`}>
                    {link.title}
                  </a>
                </Button>
              )
            })}
          </nav>
        </div>
        <div className="hidden justify-end items-center space-x-lg md:flex ">
          <a href={GITHUB_URL}>
            <FontAwesomeIcon
              icon={faGithub}
              className="icon-fg-github"
              size={'2xl'}
            />
          </a>

          <GetStarted />
        </div>

        <div className="flex justify-end items-center space-x-lg md:hidden">
          <FontAwesomeIcon
            onClick={() => setMobileOpened(!mobileOpened)}
            icon={mobileOpened ? faXmark : faBars}
            size={'2xl'}
            className={`fg-secondary-text ${props.darkBackground ? 'dark' : ''}`}
          />
        </div>
      </div>
      <div className="block md:hidden">
        {mobileOpened && (
          <HeaderNavMobile
            currentPath={currentPath}
            darkBackground={props.darkBackground}
            open={mobileOpened}
            setMobileOpened={setMobileOpened}
            navLinks={navLinks}
          />
        )}
      </div>
    </div>
  )
}
