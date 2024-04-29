import Image from 'next/image'
import Link from 'next/link'

export default function Logo () {
  return (
    <Link
      href="/"
      className="text-white text-3xl flex items-center gap-x-1"
    >
      <Image
        alt="Panfactum Logo"
        src="/logo.svg"
        width={45}
        height={45}
      />
      <span className="inline sm:hidden lg:inline">Panfactum</span>
    </Link>
  )
}
