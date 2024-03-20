import type { ImageProps } from 'next/image'
import Image from 'next/image'

export default function MarkdownImage (props: ImageProps) {
  return (
    <Image
      sizes="(max-width: 380px) 380px, (max-width: 520px) 520px, (max-width: 640px) 640px, (max-width: 768px) 768px, 1024px"
      placeholder="blur"
      {...props}
      alt={props.alt}
      className="max-w-full object-contain border-[2px] border-neutral h-fit"
    />
  )
}
