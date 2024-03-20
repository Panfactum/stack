import type { ImageProps } from 'next/image'
import Image from 'next/image'

export default function MarkdownSVGImage (props: ImageProps) {
  return (
    <Image
      sizes="(max-width: 380px) 380px, (max-width: 520px) 520px, (max-width: 640px) 640px, (max-width: 768px) 768px, 1024px"
      {...props}
      alt={props.alt}
      className="w-[80%] mx-auto block max-w-full object-contain h-fit py-4"
    />
  )
}
