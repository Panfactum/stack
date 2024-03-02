import Link from 'next/link'

import BackButton from '@/components/button/BackButton'
import NotFoundLayout from '@/components/layout/web/primary/NotFoundLayout'

export default function NotFound () {
  return (
    <NotFoundLayout>
      <div className="p-4">
        <h1>Page Not found</h1>
        <p>
          If you have reached this page in error, please report it to our&nbsp;
          <Link
            href={'https://github.com/Panfactum/panfactum/issues'}
            className="text-primary underline cursor"
          >
            issue tracker.
          </Link>
        </p>
        <div className="flex gap-4 py-4">
          <BackButton/>
        </div>
      </div>

    </NotFoundLayout>
  )
}
