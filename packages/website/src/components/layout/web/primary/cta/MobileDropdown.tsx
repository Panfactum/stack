'use client'

import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Modal from '@mui/material/Modal'
import { LogIn, Menu as MenuIcon, Cube } from 'iconoir-react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { MouseEvent } from 'react'
import { useCallback, useState, useContext } from 'react'

import githubImg from '@/components/layout/web/primary/cta/githubBlack.svg'
import VersionedDocsLink from '@/components/ui/VersionedDocsLink'
import type { VersionSlug } from '@/lib/constants'
import { DOCS_VERSIONS, isValidVersionSlug } from '@/lib/constants'
import { DocsVersionContext } from '@/lib/contexts/web/DocsVersion'

export default function MobileDropdown () {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const open = Boolean(anchorEl)
  const handleClick = useCallback((event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }, [setAnchorEl])
  const handleClose = useCallback(() => {
    setAnchorEl(null)
  }, [setAnchorEl])

  const [versionModalOpen, setVersionModalOpen] = useState(false)
  const handleVersionModalOpen = useCallback(() => {
    handleClose()
    setVersionModalOpen(true)
  }, [handleClose, setVersionModalOpen])
  const handleVersionModalClose = useCallback(() => setVersionModalOpen(false), [setVersionModalOpen])

  const { version, setVersion } = useContext(DocsVersionContext)

  const path = usePathname()
  const router = useRouter()
  const pathSegments = path.split('/')

  // Only show if on a docs page
  const docsShowing = pathSegments.length >= 2 && pathSegments[1] === 'docs'

  const onVersionClick = useCallback((slug: VersionSlug) => {
    setVersion(slug)
    if (docsShowing && pathSegments.length >= 3 && isValidVersionSlug(pathSegments[2])) {
      router.push(`/docs/${slug}/${pathSegments.slice(3).join('/')}`)
    }
  }, [setVersion, docsShowing, pathSegments, router])

  return (
    <>
      <div
        aria-controls={open ? 'menu' : undefined}
        aria-expanded={open ? 'true' : undefined}
        aria-haspopup="true"
        onClick={handleClick}
        aria-label="menu"
        id="menu-button"
        className="bg-white text-primary rounded px-1 py-1 flex items-center max-w-[50px]"
      >
        <MenuIcon
          strokeWidth={3}
          width={40}
        />
      </div>

      <Menu
        id="menu"
        MenuListProps={{
          'aria-labelledby': 'menu-button'
        }}
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        classes={{
          paper: 'min-w-[200px] px-0'
        }}
      >
        {docsShowing
          ? (
            <MenuItem
              className="flex gap-3 text-black"
              onClick={handleVersionModalOpen}
            >
              <Cube
                width={30}
              />
              v:
              {' '}
              {DOCS_VERSIONS.find(({ slug }) => slug === version)?.text}
            </MenuItem>
          )
          : (
            <VersionedDocsLink path="/guides/getting-started/start-here">
              <MenuItem
                className="flex gap-3 text-black"
                onClick={handleClose}
              >
                <LogIn
                  width={30}
                  strokeWidth={2.5}
                />
                Get Started
              </MenuItem>
            </VersionedDocsLink>
          )}

        <Link href={'https://github.com/Panfactum/stack'}>
          <MenuItem
            className="flex gap-3"
            onClick={handleClose}
          >
            <Image
              src={githubImg as string}
              height={30}
              width={30}
              alt="GitHub"
            />
            GitHub
          </MenuItem>
        </Link>

      </Menu>
      <Modal
        open={versionModalOpen}
        onClose={handleVersionModalClose}
        aria-labelledby="modal-version"
        aria-describedby="modal-select-the-documenation-version"
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-fit bg-white">
          <div className="text-lg font-semibold px-4 py-2">
            Select a version:
          </div>
          {DOCS_VERSIONS.map(({ text, slug }) => (
            <div
              className="py-4 hover:bg-primary hover:text-white hover:font-medium px-4"
              onClick={() => {
                onVersionClick(slug)
                handleVersionModalClose()
              }}
              key={slug}
            >
              {text}
              {version === slug ? ' (Active)' : ''}
            </div>
          ))}
        </div>
      </Modal>
    </>
  )
}
