import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration'
import relativeTime from 'dayjs/plugin/relativeTime'
import utc from 'dayjs/plugin/utc'
import { memo } from 'react'

import DefaultTooltipLazy from '@/components/tooltip/DefaultTooltipLazy'

dayjs.extend(duration)
dayjs.extend(relativeTime)
dayjs.extend(utc)

export interface ITimeFromNowFieldProps {
  unixSeconds?: number | null
}
export default memo(function TimeFromNowField (props: ITimeFromNowFieldProps) {
  const { unixSeconds } = props
  const time = unixSeconds ? dayjs.unix(unixSeconds) : null
  return (
    <div className='py-1 text-xs xl:text-base text-ellipsis w-full overflow-hidden'>
      {time
        ? (
          <DefaultTooltipLazy title={time.local().format('ddd MM/DD/YYYY hh:mm:ss a Z')}>
            <div className="text-ellipsis overflow-hidden">
              {time.fromNow()}
            </div>
          </DefaultTooltipLazy>
        )
        : '-'}
    </div>
  )
})
