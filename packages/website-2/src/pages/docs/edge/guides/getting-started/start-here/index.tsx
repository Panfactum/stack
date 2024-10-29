import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Start Here',
}

export function Option(props: {
  href: string
  text: string
  description: string
}) {
  const { href, text, description } = props
  return (
    <div className="flex flex-col items-center">
      <h2 className="max-w-lg text-center text-xl sm:text-2xl">{text}</h2>
      <h3 className="max-w-4xl text-center mb-5 mt-2 text-sm sm:text-base italic font-normal">
        {description}
      </h3>
      <a
        href={href}
        className="bg-primary text-lg sm:text-xl font-bold text-white px-6 sm:px-8 py-2 sm:py-4 inline-block rounded-xl"
      >
        Start Here
      </a>
    </div>
  )
}

export function Or() {
  return (
    <div className="flex items-center gap-4 justify-center">
      <div className="bg-black h-1 w-4" />
      <span className="text-black text-2xl font-bold">OR</span>
      <div className="bg-black h-1 w-4" />
    </div>
  )
}
