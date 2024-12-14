import { faGithub } from '@fortawesome/free-brands-svg-icons'
import { faBars, faXmark } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useStore } from '@nanostores/react'
import { useEffect, useState } from 'react'
import { HeaderNavMobile } from '@/components/layout/header-nav-mobile.tsx'
import { PanfactumLogo } from '@/components/panfactum-logo.tsx'
import { lastDocumentationPath } from '@/stores/documentation-store.ts'
import { Button } from '../ui/button.tsx'
import './header-nav.css';

export interface HeaderNav {
  currentPath: string;
  darkBackground: boolean;
  hasBorder: boolean;
}

export interface NavLinks {
  title: string
  url: string
  override?: string
}

const GITHUB_URL = "https://github.com/Panfactum/stack"

const THEME_KEY = 'theme'
const DARK_CLASS = 'dark'

const getThemePreference = () => {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem(THEME_KEY)
  }
}

export function HeaderNav({ currentPath, hasBorder, ...props }: HeaderNav) {
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
  const [theme, setThemeState] = useState<
    "theme-light" | "dark" | "system"
  >("theme-light")

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
 
  useEffect(() => {
    /* const isDarkMode = document.documentElement.classList.contains("dark")
    console.log('trigger'); */
    const isDark = getThemePreference() === DARK_CLASS
    console.log('isDark: ', isDark);
    setThemeState(isDark ? "dark" : "theme-light")
  }, [])
 
  useEffect(() => {
    const isDark =
      theme === "dark" ||
      (theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches)
    document.documentElement.classList[isDark ? "add" : "remove"]("dark")
  }, [theme])

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
                  className={`!px-0 text-offWhite hover:text-primary shadow-none ${currentPath.includes(link.url) ? 'text-primary font-bold' : ''}`}
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
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={theme === "dark" ? true : false}
              onChange={(value: { target: { checked: boolean }}) => {
                setThemeState(!value.target.checked ? "theme-light" : "dark")
              }}
              />
            <span className="slider">
              <span className="slider-handle select-none">
                <img src={`/moon.svg`} alt="moon toggle icon" className={theme === "dark" ? 'block':'hidden'} />
                <img src={`/sun.svg`} alt="sun toggle icon" className={theme === "dark" ? 'hidden':'block'} />
              </span>
            </span>
          </label>
          <a href={GITHUB_URL}>
              <FontAwesomeIcon
                icon={faGithub}
                className="icon-fg-github"
                size={'2xl'}
              />
          </a>
          
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
