import { clsx } from 'clsx'
import type { ImageProps } from 'next/image'
import Image from 'next/image'

export default function MarkdownGIF (props: ImageProps & {size?: 'small' | 'large'}) {
  const { size = 'large', ...imageProps } = props
  return (
    <Image
      {...imageProps}
      alt={props.alt}
      unoptimized={true} // cannot optimize animated images (use gifsicle -O3 --colors 64 --lossy=200 -o output.gif record.gif)
      className={clsx(size === 'large' ? 'max-w-full' : 'max-w-[50%]', 'block object-contain border-[2px] border-neutral h-fit my-2')}
    />
  )
}
