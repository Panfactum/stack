import { clsx } from 'clsx'
import type { ImageProps } from 'next/image'
import Image from 'next/image'

export default function MarkdownImage (props: ImageProps & {size?: 'small' | 'large'}) {
  const { size = 'large', ...imageProps } = props
  return (
    <Image
      sizes="(max-width: 380px) 380px, (max-width: 520px) 520px, (max-width: 640px) 640px, (max-width: 768px) 768px, 1024px"
      placeholder="blur"
      {...imageProps}
      alt={props.alt}
      className={clsx(size === 'large' ? 'max-w-full' : 'max-w-[50%]', 'block object-contain border-[2px] border-neutral h-fit my-2')}
    />
  )
}
