import { faGithub } from '@fortawesome/free-brands-svg-icons'
import { faBars, faXmark } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useStore } from '@nanostores/react'
import { useEffect, useState } from 'react'
import { HeaderNavMobile } from '@/components/layout/header-nav-mobile.tsx'
import { PanfactumLogo } from '@/components/panfactum-logo.tsx'
import { lastDocumentationPath } from '@/stores/documentation-store.ts'
import { Button } from '../ui/button.tsx'

export interface HeaderNav {
  currentPath: string
  darkBackground: boolean
}

export interface NavLinks {
  title: string
  url: string
  override?: string
}

export function HeaderNav({ currentPath, ...props }: HeaderNav) {
  const $lastDocumentationPath = useStore(lastDocumentationPath)
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

  // override url if lastDocumentationPath is set
  useEffect(() => {
    const newLinks = navLinks.map((link) => {
      if (link.title === 'Docs') {
        return {
          ...link,
          override: $lastDocumentationPath,
        }
      }
      return link
    })

    setNavLinks(newLinks)
  }, [])

  return (
    <>
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
                  className={`!px-0 hover:text-primary ${currentPath.includes(link.url) ? 'text-primary font-bold' : ''}`}
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
          <FontAwesomeIcon
            icon={faGithub}
            className="icon-fg-github"
            size={'2xl'}
          />
          <Button size="lg" variant="primary">
            Get Started
          </Button>
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
      {mobileOpened && (
        <HeaderNavMobile
          currentPath={currentPath}
          darkBackground={props.darkBackground}
          open={mobileOpened}
          setMobileOpened={setMobileOpened}
          navLinks={navLinks}
        />
      )}
    </>
  )
}
