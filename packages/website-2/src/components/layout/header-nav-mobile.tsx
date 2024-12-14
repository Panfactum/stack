import { faXmark } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { PanfactumLogo } from '@/components/panfactum-logo.tsx'
import { Button } from '@/components/ui/button.tsx'
import { HeaderNav, type NavLinks } from './header-nav.tsx'

interface MobileNav extends HeaderNav {
  open: boolean
  setMobileOpened: (open: boolean) => void
  navLinks: NavLinks[]
}

export function HeaderNavMobile({
  currentPath,
  setMobileOpened,
  ...props
}: MobileNav) {
  return (
    <div
      className={`bg-white fixed top-0 bottom-0 left-0 bottom-0 flex flex-col justify-between w-full h-full`}
    >
      <div className="bg-white">
        <div className="flex items-center justify-center h-20">
        <div className="container flex justify-between px-container-padding-mobile">
          <a href="/" onClick={() => setMobileOpened(false)}>
            <PanfactumLogo className={`fill-blue-500`} />
          </a>

          <FontAwesomeIcon
            onClick={() => setMobileOpened(false)}
            icon={faXmark}
            size={'2xl'}
            className={`fg-secondary-text ${props.darkBackground ? 'dark' : ''}`}
          />
        </div>

        <div className="flex justify-end items-center space-x-lg md:hidden"></div>
      </div>
      <div
        className={`flex flex-col gap-md py-3xl px-xl border-b border-secondary`}
      >
        {props.navLinks.map((link) => (
          <a
            key={link.title}
            href={`${link.url}/${link.override || ''}`}
            className={`text-tertiary text-md font-semibold py-lg ${currentPath.includes(link.url) ? '!text-primary !font-bold' : 'x'}`}
            onClick={() => setMobileOpened(false)}
          >
            {link.title}
          </a>
        ))}
      </div>
      </div>
      

      <div
        className={`flex flex-col py-3xl px-container-padding-mobile gap-4xl`}
      >
        <div className={`flex gap-3xl button-text-tertiary-fg`}>
          <div className={`flex flex-1 flex-col gap-lg`}>
            <a
              href="/login"
              className={`text-md font-semibold`}
              onClick={() => setMobileOpened(false)}
            >
              Roadmap
            </a>
            <a
              href="/login"
              className={`text-md font-semibold`}
              onClick={() => setMobileOpened(false)}
            >
              Careers
            </a>
            <a
              href="/login"
              className={`text-md font-semibold`}
              onClick={() => setMobileOpened(false)}
            >
              Legal
            </a>
          </div>

          <div className={`flex flex-1 flex-col gap-lg`}>
            <a
              href="/login"
              className={`text-md font-semibold`}
              onClick={() => setMobileOpened(false)}
            >
              Support
            </a>
            <a
              href="/login"
              className={`text-md font-semibold`}
              onClick={() => setMobileOpened(false)}
            >
              Contact
            </a>
            <a
              href="/login"
              className={`text-md font-semibold`}
              onClick={() => setMobileOpened(false)}
            >
              Sitemap
            </a>
          </div>
        </div>
        <div className={`flex flex-col gap-lg`}>
          <Button size="lg" variant="primary">
            Get Started
          </Button>

          <Button size="lg" variant="secondary-gray">
            Github
          </Button>
        </div>
      </div>
    </div>
  )
}
