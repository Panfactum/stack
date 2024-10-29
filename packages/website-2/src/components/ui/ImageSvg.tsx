export default function ImageSvg({ src, ...props }) {
  return (
    <image
      src={`data:image/svg+xml;utf8,${encodeURIComponent(src)}`}
      {...props}
      alt={props.alt}
      className="w-[80%] mx-auto block max-w-full object-contain h-fit py-4"
    />
  )
}
