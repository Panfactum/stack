import { memo } from 'react'

interface ITextFieldProps {
  value?: string | null
}
export default memo(function TextField ({ value }: ITextFieldProps) {
  return (
    <div className='py-1 text-xs xl:text-base text-ellipsis w-full overflow-hidden'>
      {value || '-'}
    </div>
  )
})
