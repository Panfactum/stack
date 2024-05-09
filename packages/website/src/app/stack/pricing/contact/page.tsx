import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft'
import type { Metadata } from 'next'
import Link from 'next/link'

import Form from './Form'

export const metadata: Metadata = {
  title: 'License Request Form'
}

export default function Page () {
  return (
    <div className="flex flex-col items-center min-h-screen px-4 pt-8">
      <h1 className='font-semibold tracking-wide mb-3 text-2xl sm:text-3xl text-center'>Panfactum License Request</h1>
      <p className='mb-6 text-base sm:text-lg text-center'>Looking forward to running the Panfactum stack? Fill out this form and we will reach out shortly!</p>
      <Form/>
      <div className="w-full max-w-3xl pt-4">
        <Link
          href={'/stack/pricing'}
          rel="prev"
          className="bg-primary text-white py-2 px-4 flex w-fit rounded gap-2"
        >
          <KeyboardArrowLeftIcon/>
          <span>
            Back to Pricing
          </span>
        </Link>
      </div>
    </div>
  )
}
