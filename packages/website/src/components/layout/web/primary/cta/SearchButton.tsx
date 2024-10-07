'use client'

import Modal from '@mui/material/Modal'
import Image from 'next/image'
import { useCallback, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'

import discordIconImg from '@/app/search.svg'
import Search from '@/components/layout/web/primary/cta/Search'

export default function SearchButton ({ docsShowing }: { docsShowing: boolean }) {
  const [searchModalOpen, setSearchModalOpen] = useState(false)

  const handleSearchModalOpen = useCallback(() => {
    setSearchModalOpen(true)
  }, [setSearchModalOpen])

  const handleSearchModalClose = useCallback(() => {
    setSearchModalOpen(false)
  }, [setSearchModalOpen])

  useHotkeys('esc', handleSearchModalClose, [searchModalOpen])
  useHotkeys(['ctrl + k'], handleSearchModalOpen, [searchModalOpen])

  return (
    <>
      <button
        title="ctrl + k"
        className={`bg-white text-primary py-1 px-2 rounded-lg font-semibold flex items-center cursor-pointer ${docsShowing ? 'block' : 'hidden'}`}
        onClick={handleSearchModalOpen}
      >
        <div className="flex items-center gap-1">
          <Image
            height={24}
            width={24}
            src={discordIconImg as string}
            alt={'Join the discord server'}
            className="h-[16px] sm:h-[16px] w-[16px] sm:w-[16px]"
          />
          <span className="hidden lg:inline-block">Search</span>
        </div>

      </button>
      <Modal
        open={searchModalOpen}
        onClose={handleSearchModalClose}
        aria-labelledby="modal-version"
        aria-describedby="modal-select-the-documenation-version"
      >
        <>
          <Search clicked={handleSearchModalClose}/>
        </>

      </Modal>
    </>
  )
}
